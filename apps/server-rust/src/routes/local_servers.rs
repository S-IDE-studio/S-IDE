//! Local servers discovery routes

use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::collections::BTreeSet;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

use crate::server::AppState;

const COMMAND_TIMEOUT_SECS: u64 = 5;
const MAX_SCAN_PORTS: usize = 500;

#[derive(Debug, Clone, Serialize)]
pub struct LocalServer {
    pub name: String,
    pub url: String,
    pub port: u16,
    pub status: String,
    #[serde(rename = "type")]
    pub server_type: String,
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/scan", get(scan_local_servers))
}

async fn scan_local_servers() -> Json<Vec<LocalServer>> {
    let mut ports = detect_listening_local_ports().await;
    if ports.is_empty() {
        ports = default_scan_ports();
    }

    let servers = ports
        .into_iter()
        .map(|port| LocalServer {
            name: format!("Local service on port {port}"),
            url: format!("http://127.0.0.1:{port}"),
            port,
            status: "running".to_string(),
            server_type: infer_server_type(port).to_string(),
        })
        .collect();

    Json(servers)
}

fn infer_server_type(port: u16) -> &'static str {
    match port {
        5173 | 5174 => "vite",
        8787 => "side-ide",
        _ => "local",
    }
}

fn default_scan_ports() -> Vec<u16> {
    vec![3000, 3001, 5173, 5174, 8000, 8080, 8787, 9000]
}

async fn detect_listening_local_ports() -> Vec<u16> {
    let commands: &[&[&str]] = match std::env::consts::OS {
        "windows" => &[&["netstat", "-ano", "-p", "tcp"]],
        "linux" => &[&["ss", "-ltnH"], &["netstat", "-ltn"]],
        "macos" => &[&["netstat", "-anv", "-p", "tcp"]],
        _ => &[],
    };

    for cmd in commands {
        if let Some((program, args)) = cmd.split_first() {
            let output = timeout(
                Duration::from_secs(COMMAND_TIMEOUT_SECS),
                Command::new(program).args(args).output(),
            )
            .await;

            let Ok(Ok(output)) = output else {
                continue;
            };

            if !output.status.success() {
                continue;
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            let ports = parse_listening_local_ports(&stdout, std::env::consts::OS);
            if !ports.is_empty() {
                return ports;
            }
        }
    }

    vec![]
}

fn parse_listening_local_ports(output: &str, os: &str) -> Vec<u16> {
    let mut ports = BTreeSet::new();

    for raw_line in output.lines() {
        let line = raw_line.trim();
        if line.is_empty() || !line.to_ascii_lowercase().contains("listen") {
            continue;
        }

        let address_token = resolve_address_token(line, os);
        let Some(address_token) = address_token else {
            continue;
        };

        if let Some(port) = parse_port(address_token) {
            ports.insert(port);
            if ports.len() >= MAX_SCAN_PORTS {
                break;
            }
        }
    }

    ports.into_iter().collect()
}

fn resolve_address_token<'a>(line: &'a str, os: &str) -> Option<&'a str> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 4 {
        return None;
    }

    match os {
        "windows" => parts.get(1).copied(),
        _ => {
            if parts
                .first()
                .map(|v| v.eq_ignore_ascii_case("listen"))
                .unwrap_or(false)
            {
                parts.get(3).copied()
            } else {
                parts.get(3).copied()
            }
        }
    }
}

fn parse_port(address_token: &str) -> Option<u16> {
    let token = address_token.trim();
    let mut last_sep_index = None;

    for (idx, ch) in token.char_indices() {
        if ch == ':' || ch == '.' {
            last_sep_index = Some(idx);
        }
    }

    let sep_index = last_sep_index?;
    let host = &token[..sep_index];
    let port_str = &token[sep_index + 1..];

    let port: u16 = port_str.parse().ok()?;
    if !is_local_bind_host(host) {
        return None;
    }

    Some(port)
}

fn is_local_bind_host(host: &str) -> bool {
    let normalized = host
        .trim()
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase();

    normalized == "*"
        || normalized == "localhost"
        || normalized == "0.0.0.0"
        || normalized == "::"
        || normalized == "::1"
        || normalized.starts_with("127.")
}

#[cfg(test)]
mod tests {
    use super::parse_listening_local_ports;

    #[test]
    fn parses_windows_netstat_output() {
        let output = r#"
  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:8787           0.0.0.0:0              LISTENING       2222
  TCP    [::1]:5173             [::]:0                 LISTENING       3333
  TCP    [::]:9229              [::]:0                 LISTENING       4444
"#;

        assert_eq!(
            parse_listening_local_ports(output, "windows"),
            vec![3000, 5173, 8787, 9229]
        );
    }

    #[test]
    fn parses_linux_ss_output() {
        let output = r#"
LISTEN 0      4096     127.0.0.1:3001      0.0.0.0:*
LISTEN 0      4096       0.0.0.0:8080      0.0.0.0:*
LISTEN 0      4096          [::1]:5174        [::]:*
LISTEN 0      4096             [::]:8788        [::]:*
"#;

        assert_eq!(
            parse_listening_local_ports(output, "linux"),
            vec![3001, 5174, 8080, 8788]
        );
    }
}

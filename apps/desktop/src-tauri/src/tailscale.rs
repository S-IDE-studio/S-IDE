//! Tailscale integration for "Remote Access" (status discovery and login URL).
//!
//! This module intentionally treats Tailscale as an external dependency:
//! we shell out to the `tailscale` CLI when available.

use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TailscaleStatusSummary {
    /// Whether the `tailscale` CLI appears to be installed and executable.
    pub installed: bool,
    /// Backend state (e.g. "Running", "NeedsLogin", ...), if available.
    pub backend_state: Option<String>,
    /// Login URL to authorize this device (when logged out), if available.
    pub auth_url: Option<String>,
    /// Device hostname, if available.
    pub self_hostname: Option<String>,
    /// Device MagicDNS name, if available.
    pub self_dns_name: Option<String>,
    /// Device Tailscale IPs (IPv4/IPv6).
    pub tailscale_ips: Vec<String>,
}

/// Parse `tailscale status --json` output into a stable summary shape.
///
/// This is resilient to schema changes by treating the payload as `serde_json::Value`
/// and extracting only the fields we care about.
pub fn parse_status_json(json: &str) -> Result<TailscaleStatusSummary, String> {
    let v: Value = serde_json::from_str(json).map_err(|e| format!("Invalid JSON: {e}"))?;

    let backend_state = v
        .get("BackendState")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let auth_url = v
        .get("AuthURL")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let self_obj = v.get("Self");

    let self_hostname = self_obj
        .and_then(|s| s.get("HostName"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let self_dns_name = self_obj
        .and_then(|s| s.get("DNSName"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let tailscale_ips = self_obj
        .and_then(|s| s.get("TailscaleIPs"))
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|ip| ip.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(TailscaleStatusSummary {
        installed: true,
        backend_state,
        auth_url,
        self_hostname,
        self_dns_name,
        tailscale_ips,
    })
}

/// Find a usable `tailscale` CLI command.
pub fn find_tailscale_command() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let common_paths = [
            r"C:\Program Files\Tailscale\tailscale.exe".to_string(),
            r"C:\Program Files (x86)\Tailscale\tailscale.exe".to_string(),
        ];

        for path in &common_paths {
            if PathBuf::from(path).exists() {
                return Some(path.clone());
            }
        }

        let mut cmd = std::process::Command::new("where");
        cmd.arg("tailscale.exe");
        
        // Hide console window
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
        
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                if let Some(path) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    let path = path.trim();
                    if !path.is_empty() {
                        return Some(path.to_string());
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if which::which("tailscale").is_ok() {
            return Some("tailscale".to_string());
        }
    }

    None
}

/// Fetch Tailscale status via CLI.
pub async fn get_status_summary() -> TailscaleStatusSummary {
    let cmd = match find_tailscale_command() {
        Some(c) => c,
        None => {
            return TailscaleStatusSummary {
                installed: false,
                backend_state: None,
                auth_url: None,
                self_hostname: None,
                self_dns_name: None,
                tailscale_ips: vec![],
            }
        }
    };

    let mut cmd = tokio::process::Command::new(cmd);
    cmd.args(["status", "--json"]);
    
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    let output = match cmd.output().await {
        Ok(o) => o,
        Err(_) => {
            return TailscaleStatusSummary {
                installed: true,
                backend_state: None,
                auth_url: None,
                self_hostname: None,
                self_dns_name: None,
                tailscale_ips: vec![],
            }
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    match parse_status_json(&stdout) {
        Ok(mut s) => {
            s.installed = true;
            s
        }
        Err(_) => TailscaleStatusSummary {
            installed: true,
            backend_state: None,
            auth_url: None,
            self_hostname: None,
            self_dns_name: None,
            tailscale_ips: vec![],
        },
    }
}


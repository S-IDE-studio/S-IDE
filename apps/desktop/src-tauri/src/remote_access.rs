//! Remote Access orchestration for Desktop app (Tailscale Serve).
//!
//! We use `tailscale serve` to provide HTTPS access to the local S-IDE server.

use crate::tailscale;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteAccessSettings {
    #[serde(default)]
    pub auto_start: bool,
}

impl Default for RemoteAccessSettings {
    fn default() -> Self {
        Self { auto_start: false }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoteAccessStatus {
    pub installed: bool,
    pub backend_state: Option<String>,
    pub auth_url: Option<String>,
    pub self_hostname: Option<String>,
    pub self_dns_name: Option<String>,
    pub tailscale_ips: Vec<String>,
    pub serve_enabled: bool,
    pub serve_url: Option<String>,
    pub settings: RemoteAccessSettings,
}

fn home_dir() -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(p) = std::env::var("USERPROFILE") {
            return Ok(std::path::PathBuf::from(p));
        }
    }
    if let Ok(p) = std::env::var("HOME") {
        return Ok(std::path::PathBuf::from(p));
    }
    Err("Could not determine home directory".to_string())
}

fn settings_path() -> Result<std::path::PathBuf, String> {
    Ok(home_dir()?.join(".side-ide").join("remote-access.json"))
}

pub async fn load_settings() -> RemoteAccessSettings {
    let path = match settings_path() {
        Ok(p) => p,
        Err(_) => return RemoteAccessSettings::default(),
    };

    // Ensure parent exists
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    match tokio::fs::read_to_string(&path).await {
        Ok(s) => serde_json::from_str::<RemoteAccessSettings>(&s).unwrap_or_default(),
        Err(_) => RemoteAccessSettings::default(),
    }
}

pub async fn save_settings(settings: &RemoteAccessSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
    }

    let data = serde_json::to_string_pretty(settings).map_err(|e| format!("Invalid JSON: {e}"))?;
    tokio::fs::write(&path, data)
        .await
        .map_err(|e| format!("Failed to write settings: {e}"))?;
    Ok(())
}

async fn run_tailscale(args: &[&str]) -> Result<std::process::Output, String> {
    let cmd = tailscale::find_tailscale_command().ok_or_else(|| "Tailscale not installed".to_string())?;
    tokio::process::Command::new(cmd)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run tailscale: {e}"))
}

fn is_serve_enabled_from_text(text: &str) -> bool {
    // Heuristic: status output includes "https://" or "http://" entries when configured.
    let t = text.to_lowercase();
    t.contains("https://") || t.contains("http://")
}

fn pick_serve_url_from_text(text: &str) -> Option<String> {
    // Best-effort: pick first https:// URL if present.
    for token in text.split_whitespace() {
        if token.starts_with("https://") {
            // Strip trailing punctuation
            return Some(token.trim_end_matches(['.', ',', ';', ')', ']', '}']).to_string());
        }
    }
    None
}

pub async fn get_serve_status() -> Result<(bool, Option<String>), String> {
    // Prefer JSON, then fall back to plain text.
    if let Ok(output) = run_tailscale(&["serve", "status", "--json"]).await {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&stdout) {
                // JSON shape typically includes:
                // { "Web": { "<dns>:<port>": { ... } }, "TCP": { "<port>": { "HTTPS": true } } }
                if let Some(web) = v.get("Web").and_then(|x| x.as_object()) {
                    if let Some((host_port, _)) = web.iter().next() {
                        let url = format!("https://{}/", host_port.trim_end_matches('/'));
                        return Ok((true, Some(url)));
                    }
                }
                // Some versions wrap under Foreground/Background maps.
                if let Some(fg) = v.get("Foreground").and_then(|x| x.as_object()) {
                    for (_id, cfg) in fg {
                        if let Some(web) = cfg.get("Web").and_then(|x| x.as_object()) {
                            if let Some((host_port, _)) = web.iter().next() {
                                let url = format!("https://{}/", host_port.trim_end_matches('/'));
                                return Ok((true, Some(url)));
                            }
                        }
                    }
                }
                if let Some(bg) = v.get("Background").and_then(|x| x.as_object()) {
                    for (_id, cfg) in bg {
                        if let Some(web) = cfg.get("Web").and_then(|x| x.as_object()) {
                            if let Some((host_port, _)) = web.iter().next() {
                                let url = format!("https://{}/", host_port.trim_end_matches('/'));
                                return Ok((true, Some(url)));
                            }
                        }
                    }
                }
            }

            // Last-ditch heuristic.
            let enabled = is_serve_enabled_from_text(&stdout);
            let url = pick_serve_url_from_text(&stdout);
            return Ok((enabled, url));
        }
    }

    let output = run_tailscale(&["serve", "status"]).await?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{stdout}\n{stderr}");
    Ok((is_serve_enabled_from_text(&combined), pick_serve_url_from_text(&combined)))
}

pub async fn start_https(local_port: u16) -> Result<(), String> {
    // Newer Tailscale CLI uses: `tailscale serve --bg --https <port> <target>`
    // where <target> can be a port number (e.g. 8787) for http://127.0.0.1:<target>.
    //
    // Prefer 443 (no port in URL). If it is already taken, fall back to 8443.
    let candidates = [443u16, 8443u16];

    for serve_port in candidates {
        let serve_port_s = serve_port.to_string();
        let target_s = local_port.to_string();
        let output =
            run_tailscale(&["serve", "--yes", "--bg", "--https", &serve_port_s, &target_s]).await?;
        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();

        // If 443 is already used, try the fallback port.
        if serve_port == 443 && (stderr.contains("listener already exists") || stdout.contains("listener already exists"))
        {
            continue;
        }

        return Err(format!("tailscale serve failed: {stdout}\n{stderr}").trim().to_string());
    }

    Err("tailscale serve failed: could not bind 443 or 8443".to_string())
}

pub async fn stop() -> Result<(), String> {
    // Reset all serve config.
    let output = run_tailscale(&["serve", "reset"]).await?;
    if output.status.success() {
        return Ok(());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!("tailscale serve reset failed: {stdout}\n{stderr}").trim().to_string())
}

pub async fn get_status() -> RemoteAccessStatus {
    let settings = load_settings().await;
    let ts = tailscale::get_status_summary().await;

    let (serve_enabled, serve_url) = if ts.installed {
        get_serve_status().await.unwrap_or((false, None))
    } else {
        (false, None)
    };

    RemoteAccessStatus {
        installed: ts.installed,
        backend_state: ts.backend_state,
        auth_url: ts.auth_url,
        self_hostname: ts.self_hostname,
        self_dns_name: ts.self_dns_name,
        tailscale_ips: ts.tailscale_ips,
        serve_enabled,
        serve_url,
        settings,
    }
}

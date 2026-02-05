//! Tunnel management for remote access via localtunnel

use crate::common;
use tokio::process::Child;
use tokio::sync::Mutex;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::sync::Arc;

/// Delay before checking tunnel URL (seconds)
pub const TUNNEL_URL_DELAY_SECS: u64 = 2;

/// Handle to a running tunnel process
pub struct TunnelHandle {
    /// The child process
    child: Child,
    /// The URL of the tunnel (available after startup)
    url: Arc<Mutex<Option<String>>>,
    /// The password for accessing the tunnel
    password: Arc<Mutex<Option<String>>>,
}

// Implement Drop to ensure process cleanup on orphaning
impl Drop for TunnelHandle {
    fn drop(&mut self) {
        // Try to kill the child process when handle is dropped
        // This prevents process orphaning
        let _ = self.child.start_kill();
    }
}

/// Starts a localtunnel on the specified port
///
/// # Errors
///
/// Returns an error if npx cannot be found or the tunnel fails to start
pub fn start(port: u16) -> Result<TunnelHandle, String> {
    // Validate port range
    common::validate_port(port)?;

    let npx_cmd = common::find_npx_command()?;

    let mut child = tokio::process::Command::new(&npx_cmd)
        .arg("localtunnel")
        .arg("--port")
        .arg(port.to_string())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start tunnel: {e}"))?;

    // Take stdout before moving child into TunnelHandle
    let stdout = child.stdout.take()
        .ok_or_else(|| "Failed to capture stdout from tunnel process".to_string())?;

    // Create the URL holder
    let url = Arc::new(Mutex::new(None));
    let password = Arc::new(Mutex::new(None));
    let url_clone = url.clone();
    let password_clone = password.clone();

    // Spawn background task to capture URL and password from stdout
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        // Read lines looking for the tunnel URL and password
        while let Ok(Some(line)) = lines.next_line().await {
            // localtunnel outputs: "your url is: https://xxx.loca.lt"
            if line.contains("your url is:") {
                if let Some(url_str) = line.split("your url is:").nth(1) {
                    let captured_url = url_str.trim().to_string();
                    println!("[Tunnel] URL captured: {}", captured_url);
                    *url_clone.lock().await = Some(captured_url);
                }
            }
            // localtunnel outputs: "your password is: xxx.xxx.xxx.xxx"
            if line.contains("your password is:") || line.contains("your ip:") {
                if let Some(pwd_str) = line.split("your password is:").nth(1).or_else(|| line.split("your ip:").nth(1)) {
                    let captured_pwd = pwd_str.trim().to_string();
                    println!("[Tunnel] Password captured: {}", captured_pwd);
                    *password_clone.lock().await = Some(captured_pwd);
                }
            }
        }
    });

    Ok(TunnelHandle { child, url, password })
}

/// Stops the tunnel
///
/// # Errors
///
/// Returns an error if the tunnel process fails to stop
pub async fn stop(mut handle: TunnelHandle) -> Result<(), String> {
    handle.child.kill()
        .await
        .map_err(|e| format!("Failed to stop tunnel: {e}"))?;
    Ok(())
}

/// Gets the URL of the tunnel
///
/// # Returns
///
/// Returns the tunnel URL if available, None otherwise
pub async fn get_url(handle: &TunnelHandle) -> Option<String> {
    handle.url.lock().await.clone()
}

/// Gets the password of the tunnel
///
/// # Returns
///
/// Returns the tunnel password if available, None otherwise
pub async fn get_password(handle: &TunnelHandle) -> Option<String> {
    handle.password.lock().await.clone()
}

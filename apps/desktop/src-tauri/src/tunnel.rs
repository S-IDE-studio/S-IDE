//! Tunnel management for remote access via localtunnel

use crate::common;
use tokio::process::Child;
use tokio::sync::Mutex;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::sync::Arc;

/// Delay before checking tunnel URL (seconds)
const TUNNEL_URL_DELAY_SECS: u64 = 2;

/// Handle to a running tunnel process
pub struct TunnelHandle {
    /// The child process
    child: Child,
    /// The URL of the tunnel (available after startup)
    url: Arc<Mutex<Option<String>>>,
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

    // Start a background task to monitor output and capture the URL
    let url = Arc::new(Mutex::new(None));
    let url_clone = url.clone();

    tokio::spawn(async move {
        // Take stdout from the child process
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            // Read lines looking for the tunnel URL
            while let Ok(Some(line)) = lines.next_line().await {
                // localtunnel outputs: "your url is: https://xxx.loca.lt"
                if line.contains("your url is:") {
                    if let Some(url_str) = line.split("your url is:").nth(1) {
                        let captured_url = url_str.trim().to_string();
                        *url_clone.lock().await = Some(captured_url);
                        println!("[Tunnel] URL captured: {}", captured_url);
                        break;
                    }
                }
            }
        }
    });

    Ok(TunnelHandle { child, url })
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

//! Tunnel management for remote access via localtunnel

use crate::common;
use tokio::process::Child;
use tokio::sync::Mutex;
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

    let child = tokio::process::Command::new(&npx_cmd)
        .arg("localtunnel")
        .arg("--port")
        .arg(port.to_string())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start tunnel: {e}"))?;

    // Start a background task to monitor output
    let url = Arc::new(Mutex::new(None));

    // Note: We can't easily read stdout after spawn in current design
    // For now, users will see the URL in their terminal or we can add proper logging later

    tokio::spawn(async move {
        // Give tunnel a moment to start and log its URL
        tokio::time::sleep(tokio::time::Duration::from_secs(TUNNEL_URL_DELAY_SECS)).await;
        // In production, you'd read stdout here and parse the URL
        // For now, user can check the terminal where npx is running
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

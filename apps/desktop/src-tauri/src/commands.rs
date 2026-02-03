//! Tauri commands for server and tunnel management

use crate::common::DEFAULT_PORT;
use crate::server;
use crate::tunnel;
use crate::ServerState;
use crate::TunnelState;
use tauri::State;

/// Error type for command results
type CommandResult<T> = Result<T, String>;

/// Starts the backend server on the specified port
///
/// # Errors
///
/// Returns an error if the server is already running or fails to start
#[tauri::command]
pub async fn start_server(
    state: State<'_, ServerState>,
    port: u16,
) -> CommandResult<String> {
    crate::common::validate_port(port)?;

    let mut server_state = state.0.lock().await;

    if server_state.is_some() {
        return Err("Server is already running".to_string());
    }

    let handle = server::start(port).map_err(|e| e.clone())?;
    *server_state = Some(handle);
    Ok(format!("Server started on port {port}"))
}

/// Stops the backend server
///
/// # Errors
///
/// Returns an error if the server is not running or fails to stop
#[tauri::command]
pub async fn stop_server(state: State<'_, ServerState>) -> CommandResult<String> {
    let mut server_state = state.0.lock().await;

    if server_state.is_none() {
        return Err("Server is not running".to_string());
    }

    let handle = server_state.take().unwrap();
    server::stop(handle).await.map_err(|e| e.clone())?;
    Ok("Server stopped".to_string())
}

/// Gets the current server status
///
/// # Errors
///
/// Returns an error if failed to read the server state
#[tauri::command]
pub async fn get_server_status(state: State<'_, ServerState>) -> CommandResult<ServerStatus> {
    let server_state = state.0.lock().await;
    let running = server_state.is_some();
    let port = server_state.as_ref().map_or(DEFAULT_PORT, |h| h.port);
    Ok(ServerStatus { running, port })
}

/// Gets the server logs
///
/// # Errors
///
/// Returns an error if log reading fails (not yet implemented)
#[tauri::command]
pub async fn get_server_logs() -> CommandResult<Vec<String>> {
    Ok(vec!["Server logging not yet implemented".to_string()])
}

/// Status information for the server
#[derive(serde::Serialize)]
pub struct ServerStatus {
    /// Whether the server is currently running
    pub running: bool,
    /// The port the server is running on
    pub port: u16,
}

// Tunnel commands

/// Starts a local tunnel for remote access
///
/// # Errors
///
/// Returns an error if the tunnel is already running or fails to start
#[tauri::command]
pub async fn start_tunnel(
    state: State<'_, TunnelState>,
    port: u16,
) -> CommandResult<String> {
    crate::common::validate_port(port)?;

    let mut tunnel_state = state.0.lock().await;

    if tunnel_state.is_some() {
        return Err("Tunnel is already running".to_string());
    }

    let handle = tunnel::start(port).map_err(|e| e.clone())?;
    let url = tunnel::get_url(&handle).await;

    *tunnel_state = Some(handle);

    match url {
        Some(u) => Ok(u),
        None => Err("Tunnel started but URL not available".to_string()),
    }
}

/// Stops the local tunnel
///
/// # Errors
///
/// Returns an error if the tunnel is not running or fails to stop
#[tauri::command]
pub async fn stop_tunnel(state: State<'_, TunnelState>) -> CommandResult<String> {
    let mut tunnel_state = state.0.lock().await;

    if tunnel_state.is_none() {
        return Err("Tunnel is not running".to_string());
    }

    let handle = tunnel_state.take().unwrap();
    tunnel::stop(handle).await.map_err(|e| e.clone())?;
    Ok("Tunnel stopped".to_string())
}

/// Gets the current tunnel status
///
/// # Errors
///
/// Returns an error if failed to read the tunnel state
#[tauri::command]
pub async fn get_tunnel_status(state: State<'_, TunnelState>) -> CommandResult<TunnelStatus> {
    let tunnel_state = state.0.lock().await;
    let running = tunnel_state.is_some();
    let url = if let Some(handle) = tunnel_state.as_ref() {
        tunnel::get_url(handle).await
    } else {
        None
    };
    Ok(TunnelStatus { running, url })
}

/// Status information for the tunnel
#[derive(serde::Serialize)]
pub struct TunnelStatus {
    /// Whether the tunnel is currently running
    pub running: bool,
    /// The public URL of the tunnel (if available)
    pub url: Option<String>,
}

// Environment check commands

/// Checks the environment for required tools (Node.js, npm, pnpm)
///
/// # Errors
///
/// Returns an error if environment check fails
#[tauri::command]
pub async fn check_environment() -> CommandResult<EnvironmentInfo> {
    let node_info = check_command_version("node", &["--version"]).await;
    let npm_info = check_command_version("npm", &["--version"]).await;
    let pnpm_info = check_command_version("pnpm", &["--version"]).await;

    Ok(EnvironmentInfo {
        node: node_info,
        npm: npm_info,
        pnpm: pnpm_info,
    })
}

/// Checks if a specific port is available
///
/// # Errors
///
/// Returns an error if port check fails
#[tauri::command]
pub async fn check_port(port: u16) -> CommandResult<PortStatus> {
    use std::net::TcpListener;

    crate::common::validate_port(port)?;

    let available = TcpListener::bind(format!("127.0.0.1:{port}")).is_ok();

    Ok(PortStatus {
        port,
        available,
        in_use: !available,
    })
}

/// Information about the development environment
#[derive(serde::Serialize)]
pub struct EnvironmentInfo {
    /// Node.js availability and version
    pub node: CommandInfo,
    /// npm availability and version
    pub npm: CommandInfo,
    /// pnpm availability and version
    pub pnpm: CommandInfo,
}

/// Information about a command-line tool
#[derive(serde::Serialize)]
pub struct CommandInfo {
    /// Whether the command is available
    pub available: bool,
    /// The version string (if available)
    pub version: Option<String>,
}

/// Status information for a specific port
#[derive(serde::Serialize)]
pub struct PortStatus {
    /// The port number
    pub port: u16,
    /// Whether the port is available
    pub available: bool,
    /// Whether the port is in use
    pub in_use: bool,
}

/// Checks the version of a command-line tool
async fn check_command_version(command: &str, args: &[&str]) -> CommandInfo {
    match tokio::process::Command::new(command)
        .args(args)
        .output()
        .await
    {
        Ok(output) => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();
            CommandInfo {
                available: true,
                version: if version.is_empty() { None } else { Some(version) },
            }
        }
        Err(_) => CommandInfo {
            available: false,
            version: None,
        },
    }
}

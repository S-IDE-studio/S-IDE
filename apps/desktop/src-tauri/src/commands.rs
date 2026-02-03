use crate::server;
use crate::tunnel;
use crate::updater;
use crate::ServerState;
use crate::TunnelState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn start_server(
    state: State<'_, ServerState>,
    port: u16,
) -> Result<String, String> {
    let mut server_state = state.0.lock().await;
    if server_state.is_some() {
        return Err("Server is already running".to_string());
    }

    let handle = server::start(port).await.map_err(|e| e.to_string())?;
    *server_state = Some(handle);
    Ok(format!("Server started on port {}", port))
}

#[tauri::command]
pub async fn stop_server(state: State<'_, ServerState>) -> Result<String, String> {
    let mut server_state = state.0.lock().await;
    if server_state.is_none() {
        return Err("Server is not running".to_string());
    }

    let handle = server_state.take().unwrap();
    server::stop(handle).await.map_err(|e| e.to_string())?;
    Ok("Server stopped".to_string())
}

#[tauri::command]
pub async fn get_server_status(state: State<'_, ServerState>) -> Result<ServerStatus, String> {
    let server_state = state.0.lock().await;
    let running = server_state.is_some();
    let port = server_state.as_ref().map(|h| h.port).unwrap_or(8787);
    Ok(ServerStatus { running, port })
}

#[tauri::command]
pub async fn get_server_logs() -> Result<Vec<String>, String> {
    // TODO: Implement actual log file reading
    // Read from server log file and return lines
    Ok(vec!["Server logging not yet implemented".to_string()])
}

#[derive(serde::Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
}

// Tunnel commands
#[tauri::command]
pub async fn start_tunnel(
    state: State<'_, TunnelState>,
    port: u16,
) -> Result<String, String> {
    let mut tunnel_state = state.0.lock().await;
    if tunnel_state.is_some() {
        return Err("Tunnel is already running".to_string());
    }

    let handle = tunnel::start(port).await.map_err(|e| e.to_string())?;
    let url = tunnel::get_url(&handle).await;

    *tunnel_state = Some(handle);

    match url {
        Some(u) => Ok(u),
        None => Err("Tunnel started but URL not available".to_string()),
    }
}

#[tauri::command]
pub async fn stop_tunnel(state: State<'_, TunnelState>) -> Result<String, String> {
    let mut tunnel_state = state.0.lock().await;
    if tunnel_state.is_none() {
        return Err("Tunnel is not running".to_string());
    }

    let handle = tunnel_state.take().unwrap();
    tunnel::stop(handle).await.map_err(|e| e.to_string())?;
    Ok("Tunnel stopped".to_string())
}

#[tauri::command]
pub async fn get_tunnel_status(state: State<'_, TunnelState>) -> Result<TunnelStatus, String> {
    let tunnel_state = state.0.lock().await;
    let running = tunnel_state.is_some();
    let url = if let Some(handle) = tunnel_state.as_ref() {
        tunnel::get_url(handle).await
    } else {
        None
    };
    Ok(TunnelStatus { running, url })
}

#[derive(serde::Serialize)]
pub struct TunnelStatus {
    pub running: bool,
    pub url: Option<String>,
}

// Environment check commands
#[tauri::command]
pub async fn check_environment() -> Result<EnvironmentInfo, String> {
    let node_info = check_command_version("node", &["--version"]).await;
    let npm_info = check_command_version("npm", &["--version"]).await;
    let pnpm_info = check_command_version("pnpm", &["--version"]).await;

    Ok(EnvironmentInfo {
        node: node_info,
        npm: npm_info,
        pnpm: pnpm_info,
    })
}

#[tauri::command]
pub async fn check_port(port: u16) -> Result<PortStatus, String> {
    use std::net::TcpListener;

    let available = TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok();

    Ok(PortStatus {
        port,
        available,
        in_use: !available,
    })
}

#[derive(serde::Serialize)]
pub struct EnvironmentInfo {
    pub node: CommandInfo,
    pub npm: CommandInfo,
    pub pnpm: CommandInfo,
}

#[derive(serde::Serialize)]
pub struct CommandInfo {
    pub available: bool,
    pub version: Option<String>,
}

#[derive(serde::Serialize)]
pub struct PortStatus {
    pub port: u16,
    pub available: bool,
    pub in_use: bool,
}

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

// Update commands
#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<updater::UpdateInfo>, String> {
    updater::check_for_updates(&app).await
}

#[tauri::command]
pub async fn download_and_install(app: AppHandle) -> Result<(), String> {
    updater::download_and_install(&app).await?;
    // Trigger app restart after successful install (will not return)
    app.restart();
}

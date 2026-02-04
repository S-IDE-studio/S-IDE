//! Tauri commands for server and tunnel management

use std::time::Duration;

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

    // Check if port is already in use by an external server
    use std::net::TcpListener;
    match TcpListener::bind(format!("127.0.0.1:{port}")) {
        Ok(listener) => {
            // Port is available, immediately release the listener
            drop(listener);
        }
        Err(e) => {
            // Check if it's specifically an "address in use" error
            if e.kind() == std::io::ErrorKind::AddrInUse {
                // Port is in use by an external process - this is actually OK
                // We just can't manage it, but we should report the server as running
                return Ok(format!("Server already running on port {port}"));
            } else {
                // Some other error (permission denied, network issue, etc.)
                return Err(format!("Cannot check port: {}", e));
            }
        }
    }

    // Port is available, start our managed server
    let handle = server::start(port).map_err(|e| e)?;
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

    // Use if let instead of unwrap to avoid race condition
    if let Some(handle) = server_state.take() {
        server::stop(handle).await.map_err(|e| e)?;
        Ok("Server stopped".to_string())
    } else {
        Err("Server is not running".to_string())
    }
}

/// Gets the current server status
///
/// # Errors
///
/// Returns an error if failed to read the server state
#[tauri::command]
pub async fn get_server_status(state: State<'_, ServerState>) -> CommandResult<ServerStatus> {
    let server_state = state.0.lock().await;

    // Check if we have a managed server
    if server_state.is_some() {
        let port = server_state.as_ref().map(|h| h.port).unwrap_or(DEFAULT_PORT);
        return Ok(ServerStatus { running: true, port });
    }

    // Check if an external server is running on the default port
    use std::net::TcpListener;
    let port = DEFAULT_PORT;
    let port_in_use = TcpListener::bind(format!("127.0.0.1:{port}")).is_err();

    Ok(ServerStatus {
        running: port_in_use,
        port,
    })
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

    let handle = tunnel::start(port).map_err(|e| e)?;
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

    // Use if let instead of unwrap to avoid race condition
    if let Some(handle) = tunnel_state.take() {
        tunnel::stop(handle).await.map_err(|e| e)?;
        Ok("Tunnel stopped".to_string())
    } else {
        Err("Tunnel is not running".to_string())
    }
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

// Server scanning commands

/// Detected server information
#[derive(serde::Serialize)]
pub struct DetectedServer {
    pub name: String,
    pub url: String,
    pub port: u16,
    pub status: String,
    pub type_: String,
}

/// Scan localhost for running servers
#[tauri::command]
pub async fn scan_local_servers() -> CommandResult<Vec<DetectedServer>> {
    let mut servers = Vec::new();

    // Common development ports to scan
    let ports_to_scan = vec![
        (3000, "dev"),
        (3001, "dev"),
        (5173, "vite"),
        (5174, "vite"),
        (8000, "dev"),
        (8080, "dev"),
        (8787, "side-ide"),
        (9000, "dev"),
    ];

    // Scan ports in parallel
    let mut scan_tasks = Vec::new();
    for (port, default_type) in ports_to_scan {
        scan_tasks.push(tokio::spawn(probe_server(port, default_type)));
    }

    // Collect results
    for task in scan_tasks {
        if let Ok(Some(server)) = task.await {
            servers.push(server);
        }
    }

    Ok(servers)
}

/// Probe a single port to detect a server
async fn probe_server(port: u16, default_type: &str) -> Option<DetectedServer> {
    use std::time::Duration;

    // Try to connect with timeout
    match tokio::time::timeout(
        Duration::from_millis(200),
        tokio::net::TcpStream::connect(&format!("127.0.0.1:{}", port))
    ).await {
        Ok(_) => {
            // Port is open, try to get server info
            fetch_server_info(port, default_type).await
        }
        Err(_) => None,
    }
}

/// Fetch detailed server information via HTTP
async fn fetch_server_info(port: u16, default_type: &str) -> Option<DetectedServer> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
        .ok()?;

    let base_url = format!("http://127.0.0.1:{}", port);

    // Try /health endpoint first
    if let Ok(resp) = client.get(&format!("{}/health", base_url)).send().await {
        if resp.status().is_success() {
            return Some(DetectedServer {
                name: detect_server_name(&base_url, &client).await.unwrap_or_else(|| default_type.to_string()),
                url: base_url,
                port,
                status: "running".to_string(),
                type_: default_type.to_string(),
            });
        }
    }

    // Fallback: try root endpoint
    if let Ok(resp) = client.get(&base_url).send().await {
        if resp.status().is_success() {
            return Some(DetectedServer {
                name: detect_server_name(&base_url, &client).await.unwrap_or_else(|| default_type.to_string()),
                url: base_url,
                port,
                status: "running".to_string(),
                type_: default_type.to_string(),
            });
        }
    }

    None
}

/// Detect server name from HTML or response
async fn detect_server_name(base_url: &str, client: &reqwest::Client) -> Option<String> {
    // Try to get server name from HTML title
    if let Ok(resp) = client.get(base_url).send().await {
        if let Ok(html) = resp.text().await {
            if let Some(title) = extract_title_from_html(&html) {
                return Some(title);
            }
        }
    }
    None
}

/// Extract title from HTML
fn extract_title_from_html(html: &str) -> Option<String> {
    html.split("<title>")
        .nth(1)
        .and_then(|s| s.split("</title>").next())
        .map(|s| s.trim().to_string())
}

/// Get MCP servers from a specific server
#[tauri::command]
pub async fn get_mcp_servers(server_url: String) -> CommandResult<Vec<MCPStatus>> {
    // Validate URL is localhost only to prevent SSRF attacks
    let parsed_url: url::Url = server_url.parse()
        .map_err(|_| "Invalid URL format".to_string())?;

    // Only allow localhost URLs
    match parsed_url.host_str() {
        Some("localhost") | Some("127.0.0.1") | Some("::1") | None => {
            // Allow localhost or unspecified (file://)
        }
        Some(host) => {
            return Err(format!("Only localhost URLs are allowed, got: {}", host));
        }
    }

    // Only allow http/https schemes
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err("Only http/https schemes are allowed".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(2000))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let mcp_url = format!("{}/api/mcp-status", server_url.trim_end_matches('/'));

    let response = client
        .get(&mcp_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch MCP servers: {}", e))?;

    if !response.status().is_success() {
        return Ok(vec![]); // MCP not available
    }

    let servers: Vec<MCPStatus> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse MCP response: {}", e))?;

    Ok(servers)
}

/// MCP server status
#[derive(serde::Serialize, serde::Deserialize)]
pub struct MCPStatus {
    pub name: String,
    pub status: String,
    pub capabilities: Vec<String>,
}

// Advanced scanning commands with nmap-style capabilities

/// Advanced scan with OS detection and version detection
/// Uses pistol-rs for port scanning with optional nmap subprocess fallback
#[tauri::command]
pub async fn scan_local_servers_advanced(
    ports: Option<Vec<u16>>,
    os_detection: bool,
    version_detection: bool,
    use_nmap: bool,
) -> CommandResult<Vec<crate::scanner::ScanResult>> {
    // Use nmap if requested and available
    if use_nmap && crate::scanner::is_nmap_available() {
        return crate::scanner::scan_with_nmap("127.0.0.1", ports, os_detection, version_detection).await;
    }

    // Use pistol-rs based scanner
    crate::scanner::scan_localhost(ports, os_detection, version_detection).await
}

/// Check if nmap is available on the system
#[tauri::command]
pub async fn check_nmap_available() -> CommandResult<bool> {
    Ok(crate::scanner::is_nmap_available())
}

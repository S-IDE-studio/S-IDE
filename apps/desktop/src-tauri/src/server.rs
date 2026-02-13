//! Server process management for the Node.js backend

use crate::common;
use tokio::process::{Command, Child};
use std::path::PathBuf;

/// Maximum number of parent directories to search when finding project root
pub const MAX_SEARCH_DEPTH: usize = 10;

/// Maximum number of parent directories to search from exe
pub const MAX_EXE_SEARCH_DEPTH: usize = 5;

/// Handle to a running server process
pub struct ServerHandle {
    /// The child process
    child: Child,
    /// The port the server is running on
    pub port: u16,
}

// Implement Drop to ensure process cleanup on orphaning
impl Drop for ServerHandle {
    fn drop(&mut self) {
        // Try to kill the child process when handle is dropped
        // This prevents process orphaning
        let _ = self.child.start_kill();
    }
}

/// Path to the bundled Node.js server executable
fn get_server_path() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {e}"))?;

    let exe_dir = exe_path.parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?;

    // In development/release builds, go up from target/debug or target/release to src-tauri
    let mut current: PathBuf = exe_dir.to_path_buf();

    // Try going up multiple levels to find src-tauri
    for _ in 0..MAX_SEARCH_DEPTH {
        // Check if src-tauri exists at this level
        let src_tauri = current.join("src-tauri");
        if src_tauri.exists() {
            let server_path = src_tauri.join("resources").join("server").join("index.js");
            if server_path.exists() {
                return Ok(server_path);
            }
        }

        // Check if resources/server exists directly at this level
        let server_path = current.join("resources").join("server").join("index.js");
        if server_path.exists() {
            return Ok(server_path);
        }

        // Go up one level
        match current.parent() {
            Some(p) => current = p.to_path_buf(),
            None => break,
        }
    }

    // Fallback to exe_dir/resources/server
    Ok(exe_dir.join("resources").join("server").join("index.js"))
}

/// Starts the server on the specified port
///
/// # Errors
///
/// Returns an error if the server fails to start
pub fn start(port: u16) -> Result<ServerHandle, String> {
    // Validate port range
    common::validate_port(port)?;

    // Check if we're running in development mode
    if is_development_mode() {
        Ok(start_dev_server(port)?)
    } else {
        Ok(start_production_server(port)?)
    }
}

/// Stops the server
///
/// # Errors
///
/// Returns an error if the server process fails to stop
pub async fn stop(mut handle: ServerHandle) -> Result<(), String> {
    handle.child.kill()
        .await
        .map_err(|e| format!("Failed to stop server: {e}"))?;
    Ok(())
}

/// Checks if we're running in development mode
pub fn is_development_mode() -> bool {
    // Check if we're running in development environment
    std::env::var("TAURI_DEV")
        .or_else(|_| std::env::var("DEBUG"))
        .is_ok()
        || !std::env::current_exe()
            .map(|p| p.extension().is_some())
            .unwrap_or(false)
}

/// Starts the server in development mode
///
/// # Errors
///
/// Returns an error if the project root cannot be found or npm fails to start
fn start_dev_server(port: u16) -> Result<ServerHandle, String> {
    // Find the project root (where package.json exists)
    let project_root = find_project_root()
        .map_err(|e| format!("Failed to find project root: {e}"))?;

    let server_dir = project_root.join("apps").join("server");

    // Find npm command using common module
    let npm_cmd = common::find_npm_command()?;

    println!("[Server] Using npm: {npm_cmd}");

    // On Windows, always use cmd.exe /c to run npm with hidden console
    #[cfg(target_os = "windows")]
    let spawn_result = {
        let mut cmd = Command::new("cmd.exe");
        cmd.arg("/c")
            .arg(&npm_cmd)
            .current_dir(&server_dir)
            .arg("run")
            .arg("dev")
            .env("DB_PATH", server_dir.join("data").join("deck-ide.db").to_string_lossy().to_string())
            .kill_on_drop(true);
        
        // Hide console window
        #[allow(unused_imports)]
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
        
        cmd.spawn()
    };

    #[cfg(not(target_os = "windows"))]
    let spawn_result = Command::new(&npm_cmd)
        .current_dir(&server_dir)
        .arg("run")
        .arg("dev")
        .env("DB_PATH", server_dir.join("data").join("deck-ide.db").to_string_lossy().to_string())
        .kill_on_drop(true)
        .spawn();

    let child = spawn_result
        .map_err(|e| format!("Failed to start dev server: {e}. Ensure npm is in PATH"))?;

    Ok(ServerHandle { child, port })
}

/// Starts the server in production mode
///
/// # Errors
///
/// Returns an error if the server executable is not found or fails to start
fn start_production_server(port: u16) -> Result<ServerHandle, String> {
    let server_path = get_server_path()?;

    if !server_path.exists() {
        return Err(format!(
            "Server executable not found at: {}. Ensure resources are bundled correctly.",
            server_path.display()
        ));
    }

    // Find Node.js executable using common module
    let node_exe = common::find_node_executable()?;

    // Convert paths to strings (don't canonicalize to avoid path issues)
    let server_script = server_path.to_string_lossy().to_string();

    // Set database path to resources/data directory
    let data_dir = server_path
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("data"))
        .unwrap_or_else(|| PathBuf::from("resources/data"));
    let db_path = data_dir.join("deck-ide.db");

    let mut cmd = Command::new(&node_exe);
    cmd.arg(&server_script)
        .env("PORT", port.to_string())
        .env("DB_PATH", db_path.to_string_lossy().to_string())
        .kill_on_drop(true);
    
    // Hide console window on Windows in production
    #[cfg(target_os = "windows")]
    {
        #[allow(unused_imports)]
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
    }
    
    let child = cmd.spawn()
        .map_err(|e| format!("Failed to start server: {e} (node: '{node_exe}', script: '{server_script}')"))?;

    Ok(ServerHandle { child, port })
}

/// Finds the project root by searching for package.json
///
/// # Errors
///
/// Returns an error if the project root cannot be found
fn find_project_root() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current dir: {e}"))?;

    let mut path = current_dir;

    // Search up for package.json
    for _ in 0..MAX_SEARCH_DEPTH {
        let package_json = path.join("package.json");
        if package_json.exists() {
            return Ok(path);
        }
        if !path.pop() {
            break;
        }
    }

    // Fallback: try relative paths from the exe
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {e}"))?;

    let mut search_path = exe_path;
    if !search_path.pop() {
        return Err("Could not determine exe parent directory".to_string());
    }

    let mut path = search_path;

    // Search up for package.json
    for _ in 0..MAX_SEARCH_DEPTH {
        let package_json = path.join("package.json");
        if package_json.exists() {
            return Ok(path);
        }
        if !path.pop() {
            break;
        }
    }

    // Fallback: try relative paths from the exe
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {e}"))?;

    let mut search_path = exe_path;
    search_path.pop();

    // In dev, exe is in target/debug, go up to project root
    for _ in 0..MAX_EXE_SEARCH_DEPTH {
        let package_json = search_path.join("package.json");
        if package_json.exists() {
            return Ok(search_path);
        }
        if !search_path.pop() {
            break;
        }
    }

    Err("Could not find project root (package.json)".to_string())
}

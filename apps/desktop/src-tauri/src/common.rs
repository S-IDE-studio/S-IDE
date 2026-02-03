//! Common utilities for command finding and validation

use std::path::PathBuf;

/// Minimum valid port number (ports below 1024 require special privileges)
pub const MIN_PORT: u16 = 1024;

/// Default port number to use when server is not running
pub const DEFAULT_PORT: u16 = 8787;

/// Validates that a port number is within the valid range (1024-65535)
/// Ports below 1024 require special privileges
///
/// # Errors
///
/// Returns an error if the port is below 1024 or is 0
pub fn validate_port(port: u16) -> Result<(), String> {
    if port < MIN_PORT {
        return Err(format!(
            "Port {port} is below {MIN_PORT}. Use a port between {MIN_PORT} and 65535."
        ));
    }
    if port == 0 {
        return Err("Port 0 is not valid".to_string());
    }
    Ok(())
}

/// Finds the npm command on the system
///
/// # Returns
///
/// Returns the path to the npm executable if found
///
/// # Errors
///
/// Returns an error if npm cannot be found in PATH or common installation locations
pub fn find_npm_command() -> Result<String, String> {
    // On Windows, prefer .cmd files and look in known locations first
    #[cfg(target_os = "windows")]
    {
        // Try common Node.js installation paths on Windows first
        if let Ok(username) = std::env::var("USERNAME") {
            let common_paths = [
                format!(r"C:\Users\{username}\AppData\Roaming\npm\npm.cmd"),
                r"C:\Program Files\nodejs\npm.cmd".to_string(),
                r"C:\Program Files (x86)\nodejs\npm.cmd".to_string(),
            ];
            for path in &common_paths {
                if PathBuf::from(path).exists() {
                    return Ok(path.clone());
                }
            }
        }

        // Try using where command on Windows (more reliable than which on Windows)
        if let Ok(output) = std::process::Command::new("where")
            .arg("npm.cmd")
            .output()
        {
            if output.status.success() {
                if let Some(path) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    let path = path.trim();
                    if !path.is_empty() {
                        return Ok(path.to_string());
                    }
                }
            }
        }

        // Fallback to regular npm which will use cmd.exe /c
        if let Ok(output) = std::process::Command::new("where")
            .arg("npm")
            .output()
        {
            if output.status.success() {
                if let Some(path) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    let path = path.trim();
                    if !path.is_empty() {
                        return Ok(path.to_string());
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Try to find npm using which crate on non-Windows
        if which::which("npm").is_ok() {
            return Ok("npm".to_string());
        }
    }

    Err("npm not found in PATH. Please install Node.js from https://nodejs.org/".to_string())
}

/// Finds the npx command on the system
///
/// # Returns
///
/// Returns the path to the npx executable if found
///
/// # Errors
///
/// Returns an error if npx cannot be found in PATH or common installation locations
pub fn find_npx_command() -> Result<String, String> {
    // On Windows, try .cmd files in known locations
    #[cfg(target_os = "windows")]
    {
        // Try common Node.js installation paths first
        if let Ok(username) = std::env::var("USERNAME") {
            let common_paths = [
                r"C:\Program Files\nodejs\npx.cmd".to_string(),
                r"C:\Program Files\nodejs\npx.exe".to_string(),
                format!(r"C:\Users\{username}\AppData\Roaming\npm\npx.cmd"),
                format!(r"C:\Users\{username}\AppData\Roaming\npm\npx.exe"),
            ];
            for path in &common_paths {
                if PathBuf::from(path).exists() {
                    return Ok(path.clone());
                }
            }
        }

        // Try using where command
        if let Ok(output) = std::process::Command::new("where")
            .arg("npx.cmd")
            .output()
        {
            if output.status.success() {
                if let Some(path) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    let path = path.trim();
                    if !path.is_empty() {
                        return Ok(path.to_string());
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Try to find npx using which on non-Windows
        if which::which("npx").is_ok() {
            return Ok("npx".to_string());
        }
    }

    // As a last resort, try to find npx relative to node
    if let Ok(node_path) = find_node_executable() {
        let node_path_buf = PathBuf::from(&node_path);
        let node_dir = node_path_buf
            .parent()
            .map(PathBuf::from)
            .unwrap_or_default();

        #[cfg(target_os = "windows")]
        let npx_path = node_dir.join("npx.cmd");
        #[cfg(not(target_os = "windows"))]
        let npx_path = node_dir.join("npx");

        if npx_path.exists() {
            return Ok(npx_path.to_string_lossy().to_string());
        }
    }

    Err("npx not found in PATH. Please install Node.js from https://nodejs.org/".to_string())
}

/// Finds the Node.js executable on the system
///
/// # Returns
///
/// Returns the path to the node executable if found
///
/// # Errors
///
/// Returns an error if node cannot be found in PATH or common installation locations
pub fn find_node_executable() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let candidates = ["node.exe", "node.cmd"];
    #[cfg(not(target_os = "windows"))]
    let candidates = ["node"];

    // Try to find node in PATH
    for cmd in &candidates {
        if which::which(cmd).is_ok() {
            return Ok((*cmd).to_string());
        }
    }

    // Try common installation paths on Windows
    #[cfg(target_os = "windows")]
    {
        let common_paths = [
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
            r"C:\Program Files\nodejs\node",
        ];
        for path in common_paths {
            if PathBuf::from(path).exists() {
                return Ok(path.to_string());
            }
        }

        // Try to find relative to npm
        if let Ok(npm_path) = find_npm_command() {
            let npm_path_buf = PathBuf::from(&npm_path);
            if let Some(node_dir) = npm_path_buf.parent() {
                let node_exe = node_dir.join("node.exe");
                if node_exe.exists() {
                    return Ok(node_exe.to_string_lossy().to_string());
                }
            }
        }
    }

    // Try common installation paths on macOS/Linux
    #[cfg(not(target_os = "windows"))]
    {
        let common_paths = [
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/opt/homebrew/bin/node",
        ];
        for path in common_paths {
            if PathBuf::from(path).exists() {
                return Ok(path.to_string());
            }
        }
    }

    Err("Node.js not found in PATH or common installation locations. Please install Node.js from https://nodejs.org/".to_string())
}

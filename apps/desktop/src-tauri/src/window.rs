//! Window setup and management for the Tauri application

use tauri::{Emitter, Manager};
use crate::common;
use crate::remote_access;
use tokio::sync::Mutex as TokioMutex;
use serde_json::json;

/// Global server handle for cleanup
static SERVER_HANDLE: TokioMutex<Option<tokio::process::Child>> = TokioMutex::const_new(None);

/// Label for the main window
const WINDOW_LABEL: &str = "main";

/// Delay before window initialization (milliseconds)
const WINDOW_INIT_DELAY_MS: u64 = 500;

/// Delay before server is ready (seconds)
const SERVER_READY_DELAY_SECS: u64 = 3;

/// Maximum number of parent directories to search for server
const MAX_SERVER_SEARCH_DEPTH: usize = 10;

/// Setup the main window
///
/// # Errors
///
/// Returns an error if the main window cannot be found
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get the main window
    let window = app.get_webview_window(WINDOW_LABEL)
        .ok_or("Main window not found")?;

    // Setup window behavior
    let _app_handle_for_cleanup = app.handle().clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            // Stop server when window is closing
            tauri::async_runtime::block_on(async move {
                let mut handle = SERVER_HANDLE.lock().await;
                if let Some(mut child) = handle.take() {
                    println!("[Desktop] Stopping server on window close");
                    let _ = child.kill().await;
                }
            });
        }
    });

    // Auto-start server when app launches
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        // Wait a moment for the window to initialize
        tokio::time::sleep(tokio::time::Duration::from_millis(WINDOW_INIT_DELAY_MS)).await;

        // Check if we're in development mode
        let is_dev = is_development_mode();
        println!("[Desktop] Running in {} mode", if is_dev { "development" } else { "production" });

        let server_dir = if is_dev {
            match find_server_directory() {
                Ok(dir) => dir,
                Err(e) => {
                    eprintln!("[Desktop] Failed to find server directory: {e}");
                    let _ = app_handle.emit("server-error", serde_json::json!({
                        "message": format!("Failed to find server directory: {e}")
                    }));
                    return;
                }
            }
        } else {
            // In production, we don't need a server_dir for the bundled server
            std::path::PathBuf::new()
        };

        // Find npm command using common module
        let npm_cmd = match common::find_npm_command() {
            Ok(cmd) => cmd,
            Err(e) => {
                eprintln!("[Desktop] Failed to find npm: {e}");
                let _ = app_handle.emit("server-error", serde_json::json!({
                    "message": format!("Failed to find npm: {e}\\n\\nPlease install Node.js from https://nodejs.org/")
                }));
                return;
            }
        };

        let spawn_result = if is_dev {
            // Development mode: use npm to run dev server
            println!("[Desktop] Using npm: {npm_cmd}");

            #[cfg(target_os = "windows")]
            let result = tokio::process::Command::new("cmd.exe")
                .arg("/c")
                .arg(&npm_cmd)
                .current_dir(&server_dir)
                .arg("run")
                .arg("dev")
                .kill_on_drop(true)
                .spawn();

            #[cfg(not(target_os = "windows"))]
            let result = tokio::process::Command::new(&npm_cmd)
                .current_dir(&server_dir)
                .arg("run")
                .arg("dev")
                .kill_on_drop(true)
                .spawn();

            result
        } else {
            // Production mode: use bundled Node.js server
            let server_path = match get_production_server_path() {
                Ok(path) => path,
                Err(e) => {
                    eprintln!("[Desktop] Failed to find bundled server: {e}");
                    let _ = app_handle.emit("server-error", serde_json::json!({
                        "message": format!("Failed to find bundled server: {e}")
                    }));
                    return;
                }
            };

            let node_exe = match common::find_node_executable() {
                Ok(exe) => exe,
                Err(e) => {
                    eprintln!("[Desktop] Failed to find Node.js: {e}");
                    let _ = app_handle.emit("server-error", serde_json::json!({
                        "message": format!("Failed to find Node.js: {e}")
                    }));
                    return;
                }
            };

            println!("[Desktop] Starting bundled server: {}", server_path.display());

            tokio::process::Command::new(&node_exe)
                .arg(&server_path)
                .kill_on_drop(true)
                .spawn()
        };

        match spawn_result {
            Ok(child) => {
                println!("[Desktop] Server started successfully");

                // Store server handle for cleanup
                let mut handle = SERVER_HANDLE.lock().await;
                *handle = Some(child);

                // Wait for server to be ready
                tokio::time::sleep(tokio::time::Duration::from_secs(SERVER_READY_DELAY_SECS)).await;

                // Notify frontend that server is ready using emit() instead of eval()
                let _ = app_handle.emit("server-ready", ());

                // Auto-start Remote Access (HTTPS) if enabled in Desktop settings.
                // This is best-effort: failures should not prevent app startup.
                let ra_settings = remote_access::load_settings().await;
                if ra_settings.auto_start {
                    let port = read_server_port_from_settings().unwrap_or(crate::common::DEFAULT_PORT);
                    println!("[Desktop] Remote Access auto-start enabled. Serving HTTPS for port {port}");
                    if let Err(e) = remote_access::start_https(port).await {
                        eprintln!("[Desktop] Failed to auto-start Remote Access: {e}");
                        let _ = app_handle.emit("remote-access-error", json!({
                            "message": format!("Failed to auto-start Remote Access: {e}")
                        }));
                    }
                }
            }
            Err(e) => {
                eprintln!("[Desktop] Failed to start server: {e}");
                // Show error to user using emit() instead of eval()
                let _ = app_handle.emit("server-error", serde_json::json!({
                    "message": format!("Failed to start backend server: {e}\\n\\nPlease make sure Node.js and npm are installed and accessible.")
                }));
            }
        }
    });

    Ok(())
}

/// Finds the server directory by searching for package.json
///
/// # Errors
///
/// Returns an error if the server directory cannot be found
fn find_server_directory() -> Result<std::path::PathBuf, String> {
    // Try to find the project root
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current dir: {e}"))?;

    let mut path = current_dir;

    // Search up for package.json
    for _ in 0..MAX_SERVER_SEARCH_DEPTH {
        let server_dir = path.join("apps").join("server");
        if server_dir.exists() && server_dir.join("package.json").exists() {
            return Ok(server_dir);
        }
        if !path.pop() {
            break;
        }
    }

    Err("Could not find server directory. Please run from the project root.".to_string())
}

/// Read configured server port from apps/server/settings.json (development).
///
/// In production builds, the server port may be fixed; we fall back to DEFAULT_PORT.
fn read_server_port_from_settings() -> Option<u16> {
    let server_dir = find_server_directory().ok()?;
    let settings_path = server_dir.join("settings.json");
    let raw = std::fs::read_to_string(settings_path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("port").and_then(|p| p.as_u64()).and_then(|p| u16::try_from(p).ok())
}

/// Checks if we're running in development mode
fn is_development_mode() -> bool {
    // Check if we're running in development environment
    std::env::var("TAURI_DEV")
        .or_else(|_| std::env::var("DEBUG"))
        .is_ok()
        || !std::env::current_exe()
            .map(|p| p.extension().is_some())
            .unwrap_or(false)
}

/// Path to the bundled Node.js server executable in production
fn get_production_server_path() -> Result<std::path::PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {e}"))?;

    let exe_dir = exe_path.parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?;

    // In production, the server is bundled at resources/server/index.js
    let server_path = exe_dir.join("resources").join("server").join("index.js");

    if server_path.exists() {
        Ok(server_path)
    } else {
        Err(format!("Bundled server not found at: {}", server_path.display()))
    }
}

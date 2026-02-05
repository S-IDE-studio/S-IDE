//! Window setup and management for the Tauri application

use tauri::{Emitter, Manager};
use crate::common;
use tokio::sync::Mutex as TokioMutex;

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

        // Find server directory
        let server_dir = match find_server_directory() {
            Ok(dir) => dir,
            Err(e) => {
                eprintln!("[Desktop] Failed to find server directory: {e}");
                let _ = app_handle.emit("server-error", serde_json::json!({
                    "message": format!("Failed to find server directory: {e}")
                }));
                return;
            }
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

        println!("[Desktop] Using npm: {npm_cmd}");

        // On Windows, always use cmd.exe /c to run npm
        #[cfg(target_os = "windows")]
        let spawn_result = tokio::process::Command::new("cmd.exe")
            .arg("/c")
            .arg(&npm_cmd)
            .current_dir(&server_dir)
            .arg("run")
            .arg("dev")
            .kill_on_drop(true)
            .spawn();

        #[cfg(not(target_os = "windows"))]
        let spawn_result = tokio::process::Command::new(&npm_cmd)
            .current_dir(&server_dir)
            .arg("run")
            .arg("dev")
            .kill_on_drop(true)
            .spawn();

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

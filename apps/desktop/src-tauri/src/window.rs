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

/// Server download URL (GitHub Releases)
const SERVER_DOWNLOAD_URL: &str = "https://github.com/S-IDE-studio/S-IDE/releases/download/v2.0.1/server-bundle.zip";

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

        let server_dir = if is_dev {
            match find_server_directory() {
                Ok(dir) => dir,
                Err(e) => {
                    let _ = app_handle.emit("server-error", serde_json::json!({
                        "message": format!("Failed to find server directory: {e}")
                    }));
                    return;
                }
            }
        } else {
            // Production mode: try to find bundled server or download it
            match get_production_server_directory().await {
                Ok(dir) => dir,
                Err(e) => {
                    eprintln!("[Desktop] Failed to get production server: {e}");
                    let _ = app_handle.emit("server-error", serde_json::json!({
                        "message": format!("Failed to get production server: {e}")
                    }));
                    return;
                }
            }
        };

        let node_exe = match common::find_node_executable() {
            Ok(exe) => exe,
            Err(e) => {
                eprintln!("[Desktop] Failed to find Node.js: {e}");
                let _ = app_handle.emit("server-error", serde_json::json!({
                    "message": format!("Failed to find Node.js: {e}\\n\\nPlease install Node.js from https://nodejs.org/")
                }));
                return;
            }
        };

        // Start the server with hidden console
        let spawn_result = spawn_server(&node_exe, &server_dir, is_dev);

        match spawn_result {
            Ok(child) => {
                // Store server handle for cleanup
                let mut handle = SERVER_HANDLE.lock().await;
                *handle = Some(child);

                // Wait for server to be ready
                tokio::time::sleep(tokio::time::Duration::from_secs(SERVER_READY_DELAY_SECS)).await;

                // Notify frontend that server is ready
                let _ = app_handle.emit("server-ready", ());

                // Auto-start Remote Access (HTTPS) if enabled in Desktop settings.
                let ra_settings = remote_access::load_settings().await;
                if ra_settings.auto_start {
                    let port = read_server_port_from_settings().unwrap_or(crate::common::DEFAULT_PORT);
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
                let _ = app_handle.emit("server-error", serde_json::json!({
                    "message": format!("Failed to start backend server: {e}\\n\\nPlease make sure Node.js is installed.")
                }));
            }
        }
    });

    Ok(())
}

/// Spawns the server process with hidden console on Windows
fn spawn_server(
    node_exe: &str,
    server_dir: &std::path::Path,
    _is_dev: bool,
) -> Result<tokio::process::Child, String> {
    let index_js = server_dir.join("index.js");

    if !index_js.exists() {
        return Err(format!("Server index.js not found at: {}", index_js.display()));
    }

    let mut cmd = tokio::process::Command::new(node_exe);
    cmd.arg(&index_js)
        .current_dir(server_dir)
        .kill_on_drop(true)
        // Suppress console output
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.spawn().map_err(|e| format!("Failed to spawn server: {e}"))
}

/// Gets or downloads the production server directory
async fn get_production_server_directory() -> Result<std::path::PathBuf, String> {
    // First, try to find bundled server
    if let Ok(dir) = find_bundled_server() {
        return Ok(dir);
    }

    // Try to find server in AppData (from previous download)
    if let Ok(dir) = find_downloaded_server() {
        return Ok(dir);
    }

    // Download and extract server
    download_and_extract_server().await
}

/// Finds the bundled server in resources directory
fn find_bundled_server() -> Result<std::path::PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {e}"))?;

    let exe_dir = exe_path.parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?;

    let server_path = exe_dir.join("resources").join("server");

    if server_path.exists() && server_path.join("index.js").exists() {
        Ok(server_path)
    } else {
        Err("Bundled server not found".to_string())
    }
}

/// Finds a previously downloaded server in AppData
fn find_downloaded_server() -> Result<std::path::PathBuf, String> {
    let app_data = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Failed to get AppData directory".to_string())?;

    let server_dir = std::path::PathBuf::from(app_data)
        .join("S-IDE")
        .join("server");

    if server_dir.exists() && server_dir.join("index.js").exists() {
        Ok(server_dir)
    } else {
        Err("Downloaded server not found".to_string())
    }
}

/// Downloads and extracts the server bundle
async fn download_and_extract_server() -> Result<std::path::PathBuf, String> {
    let app_data = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Failed to get AppData directory".to_string())?;

    let server_dir = std::path::PathBuf::from(app_data)
        .join("S-IDE")
        .join("server");

    // Create server directory
    std::fs::create_dir_all(&server_dir)
        .map_err(|e| format!("Failed to create server directory: {e}"))?;

    // Download server bundle
    eprintln!("[Desktop] Downloading server bundle...");

    let client = reqwest::Client::new();
    let response = client.get(SERVER_DOWNLOAD_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to download server: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download server: HTTP {}", response.status()));
    }

    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?;

    // Extract zip
    eprintln!("[Desktop] Extracting server bundle...");

    // Create a temporary file for the zip
    let temp_zip = server_dir.join("server-bundle.zip");
    std::fs::write(&temp_zip, &bytes)
        .map_err(|e| format!("Failed to write zip file: {e}"))?;

    // Extract the zip
    extract_zip(&temp_zip, &server_dir)?;

    // Clean up zip file
    let _ = std::fs::remove_file(&temp_zip);

    eprintln!("[Desktop] Server setup complete");

    Ok(server_dir)
}

/// Extracts a zip file to the destination directory
fn extract_zip(zip_path: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    use zip::read::ZipArchive;
    use std::io::Read;

    let file = std::fs::File::open(zip_path)
        .map_err(|e| format!("Failed to open zip: {e}"))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {e}"))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to get file {i}: {e}"))?;

        let path = dest.join(file.mangled_name().to_path_buf());

        if file.mangled_name().to_string_lossy().ends_with('/') {
            // Directory
            std::fs::create_dir_all(&path)
                .map_err(|e| format!("Failed to create directory {:?}: {e}", path))?;
        } else {
            // File
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {e}"))?;
            }

            let mut output = std::fs::File::create(&path)
                .map_err(|e| format!("Failed to create file {:?}: {e}", path))?;

            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file content: {e}"))?;

            std::io::Write::write_all(&mut output, &buffer)
                .map_err(|e| format!("Failed to write file: {e}"))?;
        }
    }

    Ok(())
}

/// Finds the server directory by searching for package.json
fn find_server_directory() -> Result<std::path::PathBuf, String> {
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current dir: {e}"))?;

    let mut path = current_dir;

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
fn read_server_port_from_settings() -> Option<u16> {
    let server_dir = find_server_directory().ok()?;
    let settings_path = server_dir.join("settings.json");
    let raw = std::fs::read_to_string(settings_path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("port").and_then(|p| p.as_u64()).and_then(|p| u16::try_from(p).ok())
}

/// Checks if we're running in development mode
fn is_development_mode() -> bool {
    // Check if running from a build output directory (target/debug or target/release)
    if let Ok(exe_path) = std::env::current_exe() {
        let path_str = exe_path.to_string_lossy();
        // If running from target/debug or target/release, it's a dev build
        if path_str.contains("target") && (path_str.contains("debug") || path_str.contains("release")) {
            return true;
        }
    }

    // Check for development environment variables
    std::env::var("TAURI_DEV")
        .or_else(|_| std::env::var("DEBUG"))
        .is_ok()
}

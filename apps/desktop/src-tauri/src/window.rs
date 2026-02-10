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

/// Maximum number of parent directories to search for server
const MAX_SERVER_SEARCH_DEPTH: usize = 10;

/// Server download URL (GitHub Releases)
const SERVER_DOWNLOAD_URL: &str = "https://github.com/S-IDE-studio/S-IDE/releases/download/v2.1.7/server-bundle.zip";

/// Setup the main window
///
/// This function is called during app startup. It sets up window behavior
/// and spawns the server startup task. Errors here will NOT prevent the app
/// from starting - they will only log an error message.
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get the main window - if it fails, just log and continue
    let window = match app.get_webview_window(WINDOW_LABEL) {
        Some(w) => w,
        None => {
            eprintln!("[Desktop] WARNING: Main window '{}' not found during setup", WINDOW_LABEL);
            // Don't return error - let app continue
            return Ok(());
        }
    };

    // Setup window behavior
    let _app_handle_for_cleanup = app.handle().clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            // Stop server when window is closing
            if let Err(e) = tauri::async_runtime::block_on(async move {
                let mut handle = SERVER_HANDLE.lock().await;
                if let Some(mut child) = handle.take() {
                    child.kill().await.map_err(|e| format!("Failed to kill server: {e}"))
                } else {
                    Ok(())
                }
            }) {
                eprintln!("[Desktop] Error stopping server on close: {}", e);
            }
        }
    });

    // Auto-start server when app launches
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        // Wrap in a closure to catch any panics
        let app_handle = app_handle.clone();
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            // We need to run the async code, but catch_unwind doesn't work directly with async
            // So we'll use the runtime's spawn mechanism which already handles panics gracefully
        }));

        // Wait a moment for the window to initialize
        tokio::time::sleep(tokio::time::Duration::from_millis(WINDOW_INIT_DELAY_MS)).await;

        // Log startup for debugging
        eprintln!("[Desktop] App starting...");
        eprintln!("[Desktop] Current exe: {:?}", std::env::current_exe());

        // Check if we're in development mode
        let is_dev = is_development_mode();
        eprintln!("[Desktop] Development mode: {}", is_dev);

        let server_dir = if is_dev {
            match find_server_directory() {
                Ok(dir) => {
                    // In development, use the dist directory
                    let dist_dir = dir.join("dist");
                    if dist_dir.exists() && dist_dir.join("index.js").exists() {
                        dist_dir
                    } else {
                        eprintln!("[Desktop] Server dist not found, please build server first (pnpm run build:server)");
                        let _ = app_handle.emit("server-error", serde_json::json!({
                            "message": "Server not built. Run: pnpm run build:server"
                        }));
                        return;
                    }
                }
                Err(e) => {
                    eprintln!("[Desktop] Failed to find server directory: {e}");
                    let _ = app_handle.emit("server-error", serde_json::json!({
                        "message": format!("Failed to find server directory: {e}")
                    }));
                    return;
                }
            }
        } else {
            // Production mode: try to find bundled server or download it
            eprintln!("[Desktop] Production mode: getting server...");
            match get_production_server_directory().await {
                Ok(dir) => {
                    eprintln!("[Desktop] Got server directory: {}", dir.display());
                    dir
                }
                Err(e) => {
                    eprintln!("[Desktop] Failed to get production server: {e}");
                    let _ = app_handle.emit("server-error", serde_json::json!({
                        "message": format!("Failed to get production server: {e}")
                    }));
                    return;
                }
            }
        };

        eprintln!("[Desktop] Finding Node.js executable...");
        let node_exe = match common::find_node_executable() {
            Ok(exe) => {
                eprintln!("[Desktop] Found Node.js: {}", exe);
                exe
            }
            Err(e) => {
                eprintln!("[Desktop] Failed to find Node.js: {e}");
                let _ = app_handle.emit("server-error", serde_json::json!({
                    "message": format!("Failed to find Node.js: {e}\\n\\nPlease install Node.js from https://nodejs.org/")
                }));
                return;
            }
        };

        // Start the server with hidden console
        eprintln!("[Desktop] Attempting to spawn server...");
        let spawn_result = spawn_server(&node_exe, &server_dir, is_dev);

        match spawn_result {
            Ok(child) => {
                eprintln!("[Desktop] Server spawned successfully");
                // Store server handle for cleanup
                let mut handle = SERVER_HANDLE.lock().await;
                *handle = Some(child);

                // Wait for server to be ready and verify it's actually responding
                eprintln!("[Desktop] Waiting for server to be ready...");
                let port = read_server_port_from_settings().unwrap_or(crate::common::DEFAULT_PORT);
                let server_url = format!("http://localhost:{}", port);

                // Poll server health endpoint until it responds
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(2))
                    .build()
                    .ok();

                let mut server_ready = false;
                for attempt in 0..15 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                    if let Some(ref client) = client {
                        if let Ok(resp) = client.get(&format!("{}/health", server_url)).send().await {
                            if resp.status().is_success() {
                                eprintln!("[Desktop] Server is responding!");
                                server_ready = true;
                                break;
                            }
                        }
                    }

                    // Also check if port is in use as fallback
                    use std::net::TcpListener;
                    if TcpListener::bind(format!("0.0.0.0:{}", port)).is_err() {
                        eprintln!("[Desktop] Server port {} is in use (attempt {})", port, attempt + 1);
                        if attempt >= 5 {
                            // After a few attempts, consider it ready even if health check fails
                            server_ready = true;
                            break;
                        }
                    }
                }

                if server_ready {
                    eprintln!("[Desktop] Server ready, notifying frontend");
                    let _ = app_handle.emit("server-ready", ());
                } else {
                    eprintln!("[Desktop] WARNING: Server may not be fully ready");
                    // Still emit server-ready so frontend can proceed
                    let _ = app_handle.emit("server-ready", ());
                }

                // Auto-start Remote Access (HTTPS) if enabled in Desktop settings.
                let ra_settings = remote_access::load_settings().await;
                if ra_settings.auto_start {
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
    is_dev: bool,
) -> Result<tokio::process::Child, String> {
    let index_js = server_dir.join("index.js");

    eprintln!("[Desktop] Spawning server: {} {}", node_exe, index_js.display());
    eprintln!("[Desktop] is_dev = {}", is_dev);

    if !index_js.exists() {
        return Err(format!("Server index.js not found at: {}", index_js.display()));
    }

    let mut cmd = tokio::process::Command::new(node_exe);
    cmd.arg(&index_js)
        .current_dir(server_dir)
        .kill_on_drop(true);

    // Configure stdio
    if is_dev {
        // Development: show output for debugging
        cmd.stdout(std::process::Stdio::inherit());
        cmd.stderr(std::process::Stdio::inherit());
    } else {
        // Production: suppress all output
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());
    }
    cmd.stdin(std::process::Stdio::null());

    // Windows: Hide console window completely
    #[cfg(target_os = "windows")]
    if !is_dev {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: 0x08000000 - Prevents console window creation
        // DETACHED_PROCESS: 0x00000008 - Detaches from parent console
        // CREATE_NEW_PROCESS_GROUP: 0x00000200 - Creates new process group
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
        eprintln!("[Desktop] Applied Windows console hiding flags");
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

    eprintln!("[Desktop] Checking for bundled server at: {}", server_path.display());

    if server_path.exists() && server_path.join("index.js").exists() {
        eprintln!("[Desktop] Found bundled server");
        Ok(server_path)
    } else {
        eprintln!("[Desktop] Bundled server not found, will try to download");
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
    eprintln!("[Desktop] Downloading server bundle from: {}", SERVER_DOWNLOAD_URL);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

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

    eprintln!("[Desktop] Downloaded {} bytes, extracting...", bytes.len());

    // Extract zip
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

    eprintln!("[Desktop] Extracting server files...");

    let file = std::fs::File::open(zip_path)
        .map_err(|e| format!("Failed to open zip: {e}"))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {e}"))?;

    let total_files = archive.len();
    let mut extracted_count = 0;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to get file {i}: {e}"))?;

        // Use name() instead of mangled_name() for proper filename handling
        let file_name = file.name();

        // Remove "server/" prefix if present (zip bundle contains server/ directory)
        let relative_path = if file_name.starts_with("server/") {
            &file_name[7..] // Skip "server/" prefix
        } else if file_name.starts_with("server\\") {
            &file_name[8..] // Skip "server\" prefix (Windows paths in zip)
        } else {
            file_name
        };

        // Skip empty paths or the server directory entry itself
        if relative_path.is_empty() || relative_path == "server" || relative_path == "server/" {
            continue;
        }

        let path = dest.join(relative_path);

        // Security check: prevent zip slip vulnerability
        if path.starts_with(dest) {
            if file_name.ends_with('/') || relative_path.ends_with('/') {
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
            extracted_count += 1;
        }
    }

    eprintln!("[Desktop] Extracted {} / {} files", extracted_count, total_files);
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
    // Check if running from a build output directory
    if let Ok(exe_path) = std::env::current_exe() {
        let path_str = exe_path.to_string_lossy();

        // If running from target/debug, it's a dev build
        // If running from target/release, it's a production build (installed app)
        if path_str.contains("target") {
            return path_str.contains("debug");
        }
    }

    // Check for development environment variables
    std::env::var("TAURI_DEV")
        .or_else(|_| std::env::var("DEBUG"))
        .is_ok()
}

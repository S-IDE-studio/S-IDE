//! Deck IDE Desktop Application
//!
//! A Tauri-based desktop application for the Deck IDE

mod common;
mod commands;
mod scanner;
mod server;
mod tailscale;
mod remote_access;
mod tunnel;
mod window;

// Test modules (only compiled when testing)
#[cfg(test)]
mod commands_tests;
#[cfg(test)]
mod server_tests;
#[cfg(test)]
mod tailscale_tests;
#[cfg(test)]
mod tunnel_tests;

use tokio::sync::Mutex as TokioMutex;

type ServerStateInner = TokioMutex<Option<server::ServerHandle>>;
type TunnelStateInner = TokioMutex<Option<tunnel::TunnelHandle>>;

/// Shared state for the server handle
struct ServerState(ServerStateInner);

/// Shared state for the tunnel handle
struct TunnelState(TunnelStateInner);

/// Runs the Tauri application
///
/// # Panics
///
/// Panics if the Tauri builder context cannot be generated or if the application fails to run
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ServerState(TokioMutex::new(None)))
        .manage(TunnelState(TokioMutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Setup window behavior and spawn server task
            // Errors here will NOT prevent app from starting
            if let Err(e) = window::setup(app) {
                eprintln!("[Desktop] Setup error (app will continue): {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_server,
            commands::stop_server,
            commands::get_server_status,
            commands::get_server_logs,
            commands::start_tunnel,
            commands::stop_tunnel,
            commands::get_tunnel_status,
            commands::get_tailscale_status,
            commands::get_remote_access_status,
            commands::get_remote_access_settings,
            commands::set_remote_access_settings,
            commands::start_remote_access_https,
            commands::stop_remote_access,
            commands::check_environment,
            commands::check_port,
            commands::scan_local_servers,
            commands::get_mcp_servers,
            commands::scan_local_servers_advanced,
            commands::check_nmap_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    // Hide console window in production builds on Windows
    #[cfg(all(target_os = "windows", not(debug_assertions)))]
    unsafe {
        // FreeConsole: Detaches the calling process from its console
        // This prevents the console window from showing
        windows::Win32::System::Console::FreeConsole();
    }

    run();
}

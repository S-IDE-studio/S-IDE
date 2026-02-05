//! Deck IDE Desktop Application
//!
//! A Tauri-based desktop application for the Deck IDE

mod common;
mod commands;
mod scanner;
mod server;
mod tunnel;
mod window;

// Test modules (only compiled when testing)
#[cfg(test)]
mod commands_tests;
#[cfg(test)]
mod server_tests;
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
        .setup(|app| {
            window::setup(app)?;
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
    run();
}

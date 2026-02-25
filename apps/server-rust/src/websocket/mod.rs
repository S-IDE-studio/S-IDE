//! WebSocket module for real-time terminal I/O

use axum::{
    extract::{ws::{Message, WebSocket}, State, WebSocketUpgrade},
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use crate::{
    server::AppState,
};

/// Handle WebSocket upgrade request for terminal
pub async fn terminal_websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    axum::extract::Path(terminal_id): axum::extract::Path<String>,
) -> Response {
    ws.on_upgrade(move |socket| handle_terminal_socket(socket, state.pty_manager, terminal_id))
}

/// Handle the WebSocket connection for a terminal
async fn handle_terminal_socket(
    socket: WebSocket,
    pty_manager: crate::terminal::manager::PtyManager,
    terminal_id: String,
) {
    info!("WebSocket connected for terminal: {}", terminal_id);

    let (mut sender, mut receiver) = socket.split();

    // Channel for PTY output -> WebSocket
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Spawn task to forward PTY output to WebSocket
    let pty_manager_clone = pty_manager.clone();
    let terminal_id_clone = terminal_id.clone();
    
    let forward_task = tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            
            // Check if session is still running
            match pty_manager_clone.is_running(&terminal_id_clone).await {
                Some(true) => {}
                Some(false) => {
                    let _ = tx.send("\r\n[Session ended]\r\n".to_string());
                    break;
                }
                None => {
                    let _ = tx.send("\r\n[Session not found]\r\n".to_string());
                    break;
                }
            }
        }
    });

    // Handle incoming messages
    loop {
        tokio::select! {
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Err(e) = pty_manager.write_to_session(&terminal_id, &text).await {
                            warn!("Failed to write to PTY: {}", e);
                            break;
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        if let Ok(cmd) = String::from_utf8(data.to_vec()) {
                            if cmd.starts_with("resize:") {
                                let parts: Vec<&str> = cmd[7..].split(',').collect();
                                if parts.len() == 2 {
                                    if let (Ok(cols), Ok(rows)) = (parts[0].parse::<u16>(), parts[1].parse::<u16>()) {
                                        if let Err(e) = pty_manager.resize_session(&terminal_id, crate::models::terminal::TerminalSize { cols, rows }).await {
                                            warn!("Failed to resize PTY: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        info!("WebSocket closed for terminal: {}", terminal_id);
                        break;
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            output = rx.recv() => {
                match output {
                    Some(data) => {
                        if sender.send(Message::Text(data.into())).await.is_err() {
                            break;
                        }
                    }
                    None => break,
                }
            }
        }
    }

    forward_task.abort();
    info!("WebSocket disconnected for terminal: {}", terminal_id);
}

/// WebSocket routes
pub fn routes() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/ws/terminal/:id", axum::routing::get(terminal_websocket_handler))
}

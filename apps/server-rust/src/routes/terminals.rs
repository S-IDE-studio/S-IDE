//! Terminals API routes

use axum::{
    extract::{Path as AxumPath, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::{
    models::terminal::{CreateTerminalRequest, Terminal, TerminalSize},
    repositories::terminal_repo::TerminalRepository,
    server::AppState,
};

#[derive(Debug, Serialize)]
pub struct ListTerminalsResponse {
    pub terminals: Vec<Terminal>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTerminalBody {
    pub workspace_id: Option<String>,
    pub deck_id: Option<String>,
    pub name: Option<String>,
    pub shell: Option<String>,
    pub cwd: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

#[derive(Debug, Deserialize)]
pub struct WriteToTerminalBody {
    pub data: String,
}

#[derive(Debug, Deserialize)]
pub struct ResizeTerminalBody {
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct TerminalCreatedResponse {
    pub terminal: Terminal,
    pub message: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_terminals))
        .route("/", post(create_terminal))
        .route("/:id", get(get_terminal))
        .route("/:id", delete(delete_terminal))
        .route("/:id/write", post(write_to_terminal))
        .route("/:id/resize", post(resize_terminal))
}

async fn list_terminals(State(state): State<AppState>) -> Json<ListTerminalsResponse> {
    let repo = TerminalRepository::new(&state.db_pool);
    match repo.list().await {
        Ok(terminals) => Json(ListTerminalsResponse { terminals }),
        Err(e) => {
            warn!("Failed to list terminals: {}", e);
            Json(ListTerminalsResponse { terminals: vec![] })
        }
    }
}

async fn get_terminal(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Terminal>, (StatusCode, Json<ErrorResponse>)> {
    let repo = TerminalRepository::new(&state.db_pool);

    match repo.get(&id).await {
        Ok(Some(terminal)) => Ok(Json(terminal)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Terminal '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
        Err(e) => {
            warn!("Failed to get terminal '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to retrieve terminal".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn create_terminal(
    State(state): State<AppState>,
    Json(body): Json<CreateTerminalBody>,
) -> Result<(StatusCode, Json<TerminalCreatedResponse>), (StatusCode, Json<ErrorResponse>)> {
    let repo = TerminalRepository::new(&state.db_pool);
    
    let req = CreateTerminalRequest {
        workspace_id: body.workspace_id,
        deck_id: body.deck_id,
        name: body.name,
        shell: body.shell,
        cwd: body.cwd,
    };

    match repo.create(req).await {
        Ok(terminal) => {
            // Create PTY session
            let size = TerminalSize {
                cols: body.cols.unwrap_or(80),
                rows: body.rows.unwrap_or(24),
            };
            
            match state.pty_manager.create_session(terminal.clone(), size).await {
                Ok(session_id) => {
                    info!("Created terminal via API: {} (pty: {})", terminal.name, session_id);
                    Ok((
                        StatusCode::CREATED,
                        Json(TerminalCreatedResponse {
                            terminal,
                            message: "Terminal created and PTY session started".to_string(),
                        }),
                    ))
                }
                Err(e) => {
                    warn!("Failed to create PTY session: {}", e);
                    // Return terminal but warn about PTY
                    Ok((
                        StatusCode::CREATED,
                        Json(TerminalCreatedResponse {
                            terminal,
                            message: format!("Terminal created but PTY failed: {}", e),
                        }),
                    ))
                }
            }
        }
        Err(e) => {
            warn!("Failed to create terminal: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create terminal".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn write_to_terminal(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Json(body): Json<WriteToTerminalBody>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    match state.pty_manager.write_to_session(&id, &body.data).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            warn!("Failed to write to terminal '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to write to terminal: {}", e),
                    code: "PTY_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn resize_terminal(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Json(body): Json<ResizeTerminalBody>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let size = TerminalSize {
        cols: body.cols,
        rows: body.rows,
    };

    match state.pty_manager.resize_session(&id, size).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            warn!("Failed to resize terminal '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to resize terminal: {}", e),
                    code: "PTY_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn delete_terminal(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Kill PTY session first
    if let Err(e) = state.pty_manager.kill_session(&id).await {
        warn!("Failed to kill PTY session '{}': {}", id, e);
        // Continue with deletion even if kill fails
    }

    let repo = TerminalRepository::new(&state.db_pool);

    match repo.delete(&id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Terminal '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
        Err(e) => {
            warn!("Failed to delete terminal '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to delete terminal".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

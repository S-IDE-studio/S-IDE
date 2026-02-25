//! Workspaces API routes

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::{
    models::workspace::{CreateWorkspaceRequest, UpdateWorkspaceRequest, Workspace},
    repositories::workspace_repo::WorkspaceRepository,
    server::AppState,
};

#[derive(Debug, Serialize)]
pub struct ListWorkspacesResponse {
    pub workspaces: Vec<Workspace>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceBody {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceBody {
    pub name: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_workspaces))
        .route("/", post(create_workspace))
        .route("/:id", get(get_workspace))
        .route("/:id", put(update_workspace))
        .route("/:id", delete(delete_workspace))
}

async fn list_workspaces(State(state): State<AppState>) -> Json<ListWorkspacesResponse> {
    let repo = WorkspaceRepository::new(&state.db_pool);
    match repo.list().await {
        Ok(workspaces) => Json(ListWorkspacesResponse { workspaces }),
        Err(e) => {
            warn!("Failed to list workspaces: {}", e);
            Json(ListWorkspacesResponse { workspaces: vec![] })
        }
    }
}

async fn get_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Workspace>, (StatusCode, Json<ErrorResponse>)> {
    let repo = WorkspaceRepository::new(&state.db_pool);
    match repo.get(&id).await {
        Ok(Some(workspace)) => Ok(Json(workspace)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Workspace '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
        Err(e) => {
            warn!("Failed to get workspace '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to retrieve workspace".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn create_workspace(
    State(state): State<AppState>,
    Json(body): Json<CreateWorkspaceBody>,
) -> Result<(StatusCode, Json<Workspace>), (StatusCode, Json<ErrorResponse>)> {
    if body.name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Workspace name cannot be empty".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ));
    }
    if body.path.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Workspace path cannot be empty".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ));
    }

    let repo = WorkspaceRepository::new(&state.db_pool);
    let req = CreateWorkspaceRequest {
        name: body.name,
        path: body.path,
    };

    match repo.create(req).await {
        Ok(workspace) => {
            info!("Created workspace via API: {} ({})", workspace.name, workspace.id);
            Ok((StatusCode::CREATED, Json(workspace)))
        }
        Err(e) => {
            warn!("Failed to create workspace: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create workspace".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn update_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateWorkspaceBody>,
) -> Result<Json<Workspace>, (StatusCode, Json<ErrorResponse>)> {
    let repo = WorkspaceRepository::new(&state.db_pool);
    let req = UpdateWorkspaceRequest {
        name: body.name,
        path: body.path,
    };

    match repo.update(&id, req).await {
        Ok(Some(workspace)) => Ok(Json(workspace)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Workspace '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
        Err(e) => {
            warn!("Failed to update workspace '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to update workspace".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn delete_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let repo = WorkspaceRepository::new(&state.db_pool);

    match repo.delete(&id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Workspace '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
        Err(e) => {
            warn!("Failed to delete workspace '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to delete workspace".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

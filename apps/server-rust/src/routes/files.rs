//! Files API routes
//!
//! Provides file system operations with path traversal protection.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

use crate::{
    server::AppState,
    utils::path_security::{contains_traversal, validate_path},
};

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ListFilesResponse {
    pub entries: Vec<FileEntry>,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct FileContentResponse {
    pub path: String,
    pub content: String,
    pub encoding: String,
}

#[derive(Debug, Deserialize)]
pub struct ReadFileQuery {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct WriteFileBody {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateDirBody {
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/list", get(list_files))
        .route("/read", get(read_file))
        .route("/write", post(write_file))
        .route("/mkdir", post(create_directory))
        .route("/delete", post(delete_file))
}

async fn list_files(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ListFilesResponse>, (StatusCode, Json<ErrorResponse>)> {
    let relative_path = params.get("path").map(|s| s.as_str()).unwrap_or(".");
    
    // Validate path
    if contains_traversal(relative_path) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Path traversal detected".to_string(),
                code: "FORBIDDEN".to_string(),
            }),
        ));
    }
    
    let workspace_root = &state.config.data_dir;
    let target_path = match validate_path(workspace_root, relative_path) {
        Ok(p) => p,
        Err(e) => {
            warn!("Path validation failed: {}", e);
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: e,
                    code: "FORBIDDEN".to_string(),
                }),
            ));
        }
    };
    
    if !target_path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Path '{}' not found", relative_path),
                code: "NOT_FOUND".to_string(),
            }),
        ));
    }
    
    if !target_path.is_dir() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("'{}' is not a directory", relative_path),
                code: "NOT_A_DIRECTORY".to_string(),
            }),
        ));
    }
    
    let mut entries = Vec::new();
    
    match std::fs::read_dir(&target_path) {
        Ok(dir_entries) => {
            for entry in dir_entries.flatten() {
                let metadata = entry.metadata().ok();
                let name = entry.file_name().to_string_lossy().to_string();
                let path = relative_path.trim_end_matches('/').to_string() + "/" + &name;
                
                entries.push(FileEntry {
                    name,
                    path,
                    is_directory: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                    size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
                    modified: metadata
                        .as_ref()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs()),
                });
            }
        }
        Err(e) => {
            warn!("Failed to read directory '{}': {}", target_path.display(), e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to read directory".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ));
        }
    }
    
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    
    Ok(Json(ListFilesResponse {
        entries,
        path: relative_path.to_string(),
    }))
}

async fn read_file(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<FileContentResponse>, (StatusCode, Json<ErrorResponse>)> {
    let relative_path = match params.get("path") {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Path parameter required".to_string(),
                    code: "BAD_REQUEST".to_string(),
                }),
            ));
        }
    };
    
    // Validate path
    if contains_traversal(relative_path) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Path traversal detected".to_string(),
                code: "FORBIDDEN".to_string(),
            }),
        ));
    }
    
    let workspace_root = &state.config.data_dir;
    let target_path = match validate_path(workspace_root, relative_path) {
        Ok(p) => p,
        Err(e) => {
            warn!("Path validation failed: {}", e);
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: e,
                    code: "FORBIDDEN".to_string(),
                }),
            ));
        }
    };
    
    if !target_path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("File '{}' not found", relative_path),
                code: "NOT_FOUND".to_string(),
            }),
        ));
    }
    
    if target_path.is_dir() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Cannot read a directory as a file".to_string(),
                code: "IS_DIRECTORY".to_string(),
            }),
        ));
    }
    
    // Check file size
    let metadata = match std::fs::metadata(&target_path) {
        Ok(m) => m,
        Err(e) => {
            warn!("Failed to get metadata for '{}': {}", target_path.display(), e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to read file".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ));
        }
    };
    
    if metadata.len() > state.config.max_file_size as u64 {
        return Err((
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(ErrorResponse {
                error: format!("File exceeds maximum size of {} bytes", state.config.max_file_size),
                code: "FILE_TOO_LARGE".to_string(),
            }),
        ));
    }
    
    match std::fs::read_to_string(&target_path) {
        Ok(content) => Ok(Json(FileContentResponse {
            path: relative_path.to_string(),
            content,
            encoding: "utf-8".to_string(),
        })),
        Err(e) => {
            warn!("Failed to read file '{}': {}", target_path.display(), e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to read file".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn write_file(
    State(state): State<AppState>,
    Json(body): Json<WriteFileBody>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Validate path
    if contains_traversal(&body.path) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Path traversal detected".to_string(),
                code: "FORBIDDEN".to_string(),
            }),
        ));
    }
    
    let workspace_root = &state.config.data_dir;
    let target_path = match validate_path(workspace_root, &body.path) {
        Ok(p) => p,
        Err(e) => {
            warn!("Path validation failed: {}", e);
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: e,
                    code: "FORBIDDEN".to_string(),
                }),
            ));
        }
    };
    
    // Create parent directories if they don't exist
    if let Some(parent) = target_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            warn!("Failed to create parent directories: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create directories".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ));
        }
    }
    
    match std::fs::write(&target_path, body.content) {
        Ok(_) => {
            info!("Wrote file: {}", target_path.display());
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            warn!("Failed to write file '{}': {}", target_path.display(), e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to write file".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn create_directory(
    State(state): State<AppState>,
    Json(body): Json<CreateDirBody>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Validate path
    if contains_traversal(&body.path) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Path traversal detected".to_string(),
                code: "FORBIDDEN".to_string(),
            }),
        ));
    }
    
    let workspace_root = &state.config.data_dir;
    let target_path = match validate_path(workspace_root, &body.path) {
        Ok(p) => p,
        Err(e) => {
            warn!("Path validation failed: {}", e);
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: e,
                    code: "FORBIDDEN".to_string(),
                }),
            ));
        }
    };
    
    match std::fs::create_dir_all(&target_path) {
        Ok(_) => {
            info!("Created directory: {}", target_path.display());
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            warn!("Failed to create directory '{}': {}", target_path.display(), e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create directory".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn delete_file(
    State(state): State<AppState>,
    Json(body): Json<CreateDirBody>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    // Validate path
    if contains_traversal(&body.path) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Path traversal detected".to_string(),
                code: "FORBIDDEN".to_string(),
            }),
        ));
    }
    
    let workspace_root = &state.config.data_dir;
    let target_path = match validate_path(workspace_root, &body.path) {
        Ok(p) => p,
        Err(e) => {
            warn!("Path validation failed: {}", e);
            return Err((
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: e,
                    code: "FORBIDDEN".to_string(),
                }),
            ));
        }
    };
    
    if !target_path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Path '{}' not found", body.path),
                code: "NOT_FOUND".to_string(),
            }),
        ));
    }
    
    let result = if target_path.is_dir() {
        std::fs::remove_dir_all(&target_path)
    } else {
        std::fs::remove_file(&target_path)
    };
    
    match result {
        Ok(_) => {
            info!("Deleted: {}", target_path.display());
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            warn!("Failed to delete '{}': {}", target_path.display(), e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to delete file or directory".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

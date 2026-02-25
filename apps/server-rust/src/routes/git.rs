//! Git API routes
//!
//! Provides git operations for repositories.

use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::warn;

use crate::{
    server::AppState,
    utils::path_security::{contains_traversal, validate_path},
};

#[derive(Debug, Serialize)]
pub struct GitStatusResponse {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<String>,
    pub unstaged: Vec<String>,
    pub untracked: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
}

#[derive(Debug, Serialize)]
pub struct GitBranchesResponse {
    pub branches: Vec<GitBranch>,
    pub current: String,
}

#[derive(Debug, Serialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize)]
pub struct GitLogResponse {
    pub commits: Vec<GitLogEntry>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct GitStatusQuery {
    pub path: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/status", get(git_status))
        .route("/branches", get(git_branches))
        .route("/log", get(git_log))
}

async fn git_status(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<GitStatusResponse>, (StatusCode, Json<ErrorResponse>)> {
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

    // Check if it's a git repository
    let git_dir = target_path.join(".git");
    if !git_dir.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not a git repository".to_string(),
                code: "NOT_A_REPO".to_string(),
            }),
        ));
    }

    // Open the repository
    let repo = match git2::Repository::open(&target_path) {
        Ok(r) => r,
        Err(e) => {
            warn!("Failed to open git repository: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to open git repository".to_string(),
                    code: "GIT_ERROR".to_string(),
                }),
            ));
        }
    };

    // Get current branch
    let head = match repo.head() {
        Ok(h) => h,
        Err(e) => {
            warn!("Failed to get HEAD: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to get current branch".to_string(),
                    code: "GIT_ERROR".to_string(),
                }),
            ));
        }
    };

    let branch_name = head
        .shorthand()
        .unwrap_or("HEAD (detached)")
        .to_string();

    // Get status
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    let statuses = match repo.statuses(None) {
        Ok(s) => s,
        Err(e) => {
            warn!("Failed to get git status: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to get git status".to_string(),
                    code: "GIT_ERROR".to_string(),
                }),
            ));
        }
    };

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("unknown").to_string();
        let status = entry.status();

        if status.is_index_new() || status.is_index_modified() || status.is_index_deleted() {
            staged.push(path);
        } else if status.is_wt_modified() || status.is_wt_deleted() {
            unstaged.push(path);
        } else if status.is_wt_new() {
            untracked.push(path);
        }
    }

    // Calculate ahead/behind (simplified - returns 0, 0 for now)
    // Full implementation would use git_graph_ahead_behind
    let (ahead, behind) = (0, 0);

    Ok(Json(GitStatusResponse {
        branch: branch_name,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
    }))
}

async fn git_branches(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<GitBranchesResponse>, (StatusCode, Json<ErrorResponse>)> {
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

    let repo = match git2::Repository::open(&target_path) {
        Ok(r) => r,
        Err(e) => {
            warn!("Failed to open git repository: {}", e);
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Not a git repository".to_string(),
                    code: "NOT_A_REPO".to_string(),
                }),
            ));
        }
    };

    let current = match repo.head() {
        Ok(h) => h.shorthand().unwrap_or("HEAD").to_string(),
        Err(_) => "HEAD".to_string(),
    };

    let mut branches = Vec::new();

    // Local branches
    if let Ok(local_branches) = repo.branches(Some(git2::BranchType::Local)) {
        for branch_result in local_branches {
            if let Ok((branch, _)) = branch_result {
                if let Some(name) = branch.name().ok().flatten() {
                    branches.push(GitBranch {
                        name: name.to_string(),
                        current: name == current,
                    });
                }
            }
        }
    }

    Ok(Json(GitBranchesResponse { branches, current }))
}

async fn git_log(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<GitLogResponse>, (StatusCode, Json<ErrorResponse>)> {
    let relative_path = params.get("path").map(|s| s.as_str()).unwrap_or(".");
    let limit = params
        .get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(20);

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

    let repo = match git2::Repository::open(&target_path) {
        Ok(r) => r,
        Err(e) => {
            warn!("Failed to open git repository: {}", e);
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Not a git repository".to_string(),
                    code: "NOT_A_REPO".to_string(),
                }),
            ));
        }
    };

    let mut commits = Vec::new();
    let mut revwalk = match repo.revwalk() {
        Ok(rw) => rw,
        Err(e) => {
            warn!("Failed to create revwalk: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to walk git history".to_string(),
                    code: "GIT_ERROR".to_string(),
                }),
            ));
        }
    };

    // Push HEAD to start from current commit
    if let Err(e) = revwalk.push_head() {
        warn!("Failed to push HEAD: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to get git log".to_string(),
                code: "GIT_ERROR".to_string(),
            }),
        ));
    }

    for (i, oid_result) in revwalk.enumerate() {
        if i >= limit {
            break;
        }

        let oid = match oid_result {
            Ok(o) => o,
            Err(_) => continue,
        };

        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let hash = oid.to_string();
        let short_hash = hash[..7].to_string();

        let message = commit.message().unwrap_or("").to_string();
        let author = commit
            .author()
            .name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let timestamp = commit.time().seconds();

        commits.push(GitLogEntry {
            hash,
            short_hash,
            message,
            author,
            timestamp,
        });
    }

    Ok(Json(GitLogResponse { commits }))
}

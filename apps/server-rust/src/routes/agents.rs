//! Agents API routes

use axum::{
    extract::{Path as AxumPath, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::{
    server::AppState,
};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub installed: bool,
    pub config: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAgentBody {
    pub enabled: Option<bool>,
    pub config: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ListAgentsResponse {
    pub agents: Vec<Agent>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_agents))
        .route("/:id", get(get_agent))
        .route("/:id", put(update_agent))
        .route("/:id/detect", post(detect_agent))
}

async fn list_agents(State(state): State<AppState>) -> Result<Json<ListAgentsResponse>, (StatusCode, Json<ErrorResponse>)> {
    let agents: Vec<Agent> = sqlx::query_as(
        r#"
        SELECT id, name, enabled, installed, config
        FROM agents
        ORDER BY name
        "#
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to list agents: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to list agents".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    Ok(Json(ListAgentsResponse { agents }))
}

async fn get_agent(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Agent>, (StatusCode, Json<ErrorResponse>)> {
    let agent: Option<Agent> = sqlx::query_as(
        r#"
        SELECT id, name, enabled, installed, config
        FROM agents
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to get agent: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to get agent".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    match agent {
        Some(a) => Ok(Json(a)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Agent '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
    }
}

async fn update_agent(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Json(body): Json<UpdateAgentBody>,
) -> Result<Json<Agent>, (StatusCode, Json<ErrorResponse>)> {
    // Get current agent
    let agent: Option<Agent> = sqlx::query_as(
        r#"
        SELECT id, name, enabled, installed, config
        FROM agents
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to get agent for update: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to update agent".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    if agent.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Agent '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        ));
    }

    // Build update query dynamically
    let mut updates = vec![];
    
    if let Some(enabled) = body.enabled {
        updates.push(("enabled", enabled as i32));
    }
    
    if let Some(config) = body.config {
        sqlx::query("UPDATE agents SET config = ? WHERE id = ?")
            .bind(config)
            .bind(&id)
            .execute(&state.db_pool)
            .await
            .map_err(|e| {
                warn!("Failed to update agent config: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to update agent".to_string(),
                        code: "INTERNAL_ERROR".to_string(),
                    }),
                )
            })?;
    }

    if let Some((_, enabled_val)) = updates.first() {
        sqlx::query("UPDATE agents SET enabled = ? WHERE id = ?")
            .bind(*enabled_val)
            .bind(&id)
            .execute(&state.db_pool)
            .await
            .map_err(|e| {
                warn!("Failed to update agent enabled status: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to update agent".to_string(),
                        code: "INTERNAL_ERROR".to_string(),
                    }),
                )
            })?;
    }

    // Fetch updated agent
    let agent: Agent = sqlx::query_as(
        r#"
        SELECT id, name, enabled, installed, config
        FROM agents
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to fetch updated agent: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to fetch updated agent".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    info!("Updated agent: {}", id);
    Ok(Json(agent))
}

async fn detect_agent(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<Agent>, (StatusCode, Json<ErrorResponse>)> {
    // Simple detection logic - check if command exists
    let installed = match id.as_str() {
        "claude" => which::which("claude").is_ok() || which::which("claude.exe").is_ok(),
        "codex" => which::which("codex").is_ok() || which::which("codex.exe").is_ok(),
        "copilot" => which::which("gh").is_ok(),
        "cursor" => which::which("cursor").is_ok() || which::which("cursor.exe").is_ok(),
        "kimi" => which::which("kimi").is_ok() || which::which("kimi.exe").is_ok(),
        _ => false,
    };

    // Update installed status
    sqlx::query("UPDATE agents SET installed = ? WHERE id = ?")
        .bind(installed as i32)
        .bind(&id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| {
            warn!("Failed to update agent installed status: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to update agent".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            )
        })?;

    // Fetch updated agent
    let agent: Agent = sqlx::query_as(
        r#"
        SELECT id, name, enabled, installed, config
        FROM agents
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to fetch agent after detection: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to fetch agent".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    info!("Detected agent {}: installed={}", id, installed);
    Ok(Json(agent))
}

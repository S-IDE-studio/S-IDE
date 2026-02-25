//! MCP Servers API routes

use axum::{
    extract::{Path as AxumPath, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::{
    server::AppState,
};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Option<String>,
    pub env: Option<String>,
    pub enabled: bool,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMcpServerBody {
    pub name: String,
    pub command: String,
    pub args: Option<Vec<String>>,
    pub env: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMcpServerBody {
    pub name: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<std::collections::HashMap<String, String>>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ListMcpServersResponse {
    pub servers: Vec<McpServer>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_mcp_servers))
        .route("/", post(create_mcp_server))
        .route("/:id", get(get_mcp_server))
        .route("/:id", put(update_mcp_server))
        .route("/:id", delete(delete_mcp_server))
        .route("/:id/start", post(start_mcp_server))
        .route("/:id/stop", post(stop_mcp_server))
}

async fn list_mcp_servers(State(state): State<AppState>) -> Result<Json<ListMcpServersResponse>, (StatusCode, Json<ErrorResponse>)> {
    let servers: Vec<McpServer> = sqlx::query_as(
        r#"
        SELECT id, name, command, args, env, enabled, status
        FROM mcp_servers
        ORDER BY name
        "#
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to list MCP servers: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to list MCP servers".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    Ok(Json(ListMcpServersResponse { servers }))
}

async fn get_mcp_server(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<McpServer>, (StatusCode, Json<ErrorResponse>)> {
    let server: Option<McpServer> = sqlx::query_as(
        r#"
        SELECT id, name, command, args, env, enabled, status
        FROM mcp_servers
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to get MCP server: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to get MCP server".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    match server {
        Some(s) => Ok(Json(s)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("MCP server '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
    }
}

async fn create_mcp_server(
    State(state): State<AppState>,
    Json(body): Json<CreateMcpServerBody>,
) -> Result<(StatusCode, Json<McpServer>), (StatusCode, Json<ErrorResponse>)> {
    let id = uuid::Uuid::new_v4().to_string();
    let args_json = body.args.map(|a| serde_json::to_string(&a).unwrap_or_default());
    let env_json = body.env.map(|e| serde_json::to_string(&e).unwrap_or_default());

    sqlx::query(
        r#"
        INSERT INTO mcp_servers (id, name, command, args, env, enabled, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&body.command)
    .bind(&args_json)
    .bind(&env_json)
    .bind(0i32) // disabled by default
    .bind("stopped")
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to create MCP server: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create MCP server".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    let server: McpServer = sqlx::query_as(
        r#"
        SELECT id, name, command, args, env, enabled, status
        FROM mcp_servers
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to fetch created MCP server: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to fetch created MCP server".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    info!("Created MCP server: {} ({})", body.name, id);
    Ok((StatusCode::CREATED, Json(server)))
}

async fn update_mcp_server(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Json(body): Json<UpdateMcpServerBody>,
) -> Result<Json<McpServer>, (StatusCode, Json<ErrorResponse>)> {
    // Build dynamic update
    if body.name.is_some() || body.command.is_some() || body.args.is_some() || body.env.is_some() || body.enabled.is_some() {
        let mut query = String::from("UPDATE mcp_servers SET ");
        let mut params: Vec<String> = vec![];

        if let Some(name) = body.name {
            query.push_str("name = ?");
            params.push(name);
        }
        if let Some(command) = body.command {
            if !params.is_empty() { query.push_str(", "); }
            query.push_str("command = ?");
            params.push(command);
        }
        if let Some(args) = body.args {
            if !params.is_empty() { query.push_str(", "); }
            query.push_str("args = ?");
            params.push(serde_json::to_string(&args).unwrap_or_default());
        }
        if let Some(env) = body.env {
            if !params.is_empty() { query.push_str(", "); }
            query.push_str("env = ?");
            params.push(serde_json::to_string(&env).unwrap_or_default());
        }
        if let Some(enabled) = body.enabled {
            if !params.is_empty() { query.push_str(", "); }
            query.push_str("enabled = ?");
            params.push(enabled.to_string());
        }

        query.push_str(" WHERE id = ?");

        // Execute query with params
        let mut q = sqlx::query(&query);
        for param in params {
            q = q.bind(param);
        }
        q = q.bind(&id);

        q.execute(&state.db_pool).await.map_err(|e| {
            warn!("Failed to update MCP server: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to update MCP server".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            )
        })?;
    }

    // Fetch updated server
    let server: McpServer = sqlx::query_as(
        r#"
        SELECT id, name, command, args, env, enabled, status
        FROM mcp_servers
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to fetch updated MCP server: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to fetch updated MCP server".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    info!("Updated MCP server: {}", id);
    Ok(Json(server))
}

async fn delete_mcp_server(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let result = sqlx::query("DELETE FROM mcp_servers WHERE id = ?")
        .bind(&id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| {
            warn!("Failed to delete MCP server: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to delete MCP server".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("MCP server '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        ));
    }

    info!("Deleted MCP server: {}", id);
    Ok(StatusCode::NO_CONTENT)
}

async fn start_mcp_server(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<McpServer>, (StatusCode, Json<ErrorResponse>)> {
    // Update status to running (actual process management would be more complex)
    sqlx::query("UPDATE mcp_servers SET status = ?, enabled = ? WHERE id = ?")
        .bind("running")
        .bind(1i32)
        .bind(&id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| {
            warn!("Failed to start MCP server: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to start MCP server".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            )
        })?;

    let server: McpServer = sqlx::query_as(
        r#"
        SELECT id, name, command, args, env, enabled, status
        FROM mcp_servers
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to fetch MCP server after start: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to fetch MCP server".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    info!("Started MCP server: {}", id);
    Ok(Json(server))
}

async fn stop_mcp_server(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<McpServer>, (StatusCode, Json<ErrorResponse>)> {
    // Update status to stopped
    sqlx::query("UPDATE mcp_servers SET status = ?, enabled = ? WHERE id = ?")
        .bind("stopped")
        .bind(0i32)
        .bind(&id)
        .execute(&state.db_pool)
        .await
        .map_err(|e| {
            warn!("Failed to stop MCP server: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to stop MCP server".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            )
        })?;

    let server: McpServer = sqlx::query_as(
        r#"
        SELECT id, name, command, args, env, enabled, status
        FROM mcp_servers
        WHERE id = ?
        "#
    )
    .bind(&id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        warn!("Failed to fetch MCP server after stop: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to fetch MCP server".to_string(),
                code: "INTERNAL_ERROR".to_string(),
            }),
        )
    })?;

    info!("Stopped MCP server: {}", id);
    Ok(Json(server))
}

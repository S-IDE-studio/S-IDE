//! Health check endpoints
//! 
//! Provides health status for monitoring and load balancers.

use axum::{
    extract::State,
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::server::AppState;

/// Health status response
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct HealthStatus {
    pub status: String,
    pub uptime: u64,
    pub pid: u32,
    pub version: String,
    pub ports: Ports,
    pub database: String,
    pub mcp_servers: McpServersStatus,
    pub agents: AgentsStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Ports {
    pub http: u16,
    pub ws: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpServersStatus {
    pub running: u32,
    pub error: u32,
    pub stopped: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentsStatus {
    pub enabled: u32,
    pub installed: u32,
}

/// Port status response
#[derive(Debug, Serialize, Deserialize)]
pub struct PortStatus {
    pub core_daemon: CoreDaemonPort,
    pub mcp_servers: Vec<McpServerPort>,
    pub conflicts: Vec<PortConflict>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CoreDaemonPort {
    pub port: u16,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpServerPort {
    pub name: String,
    pub port: Option<u16>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PortConflict {
    pub port: u16,
    pub services: Vec<String>,
}

/// Liveness probe response
#[derive(Debug, Serialize, Deserialize)]
pub struct LivenessResponse {
    pub status: String,
}

/// Readiness probe response
#[derive(Debug, Serialize, Deserialize)]
pub struct ReadinessResponse {
    pub status: String,
    pub checks: HashMap<String, bool>,
}

/// Create health routes (no auth required)
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_check))
}

/// Create API health routes (with state)
pub fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(health_check))
        .route("/ports", get(port_status))
        .route("/live", get(liveness_check))
        .route("/ready", get(readiness_check))
}

/// GET /health or /api/health - Detailed health status
async fn health_check(State(state): State<AppState>) -> Json<HealthStatus> {
    let uptime = state.start_time.elapsed().as_secs();
    let config = &state.config;
    
    // Check database connection
    let db_status = match sqlx::query("SELECT 1").fetch_one(&state.db_pool).await {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };
    
    // TODO: Get actual MCP server and agent status
    let health = HealthStatus {
        status: if db_status == "connected" {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
        uptime,
        pid: std::process::id(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        ports: Ports {
            http: config.port,
            ws: config.port,
        },
        database: db_status.to_string(),
        mcp_servers: McpServersStatus {
            running: 0,
            error: 0,
            stopped: 0,
        },
        agents: AgentsStatus {
            enabled: 0,
            installed: 0,
        },
    };
    
    Json(health)
}

/// GET /api/health/ports - Port usage status
async fn port_status(State(state): State<AppState>) -> Json<PortStatus> {
    let config = &state.config;
    
    let port_status = PortStatus {
        core_daemon: CoreDaemonPort {
            port: config.port,
            status: "listening".to_string(),
        },
        mcp_servers: vec![],
        conflicts: vec![],
    };
    
    Json(port_status)
}

/// GET /api/health/live - Liveness probe
async fn liveness_check() -> Json<LivenessResponse> {
    Json(LivenessResponse {
        status: "alive".to_string(),
    })
}

/// GET /api/health/ready - Readiness probe
async fn readiness_check(State(state): State<AppState>) -> (StatusCode, Json<ReadinessResponse>) {
    // Check database connection
    let db_connected = sqlx::query("SELECT 1").fetch_one(&state.db_pool).await.is_ok();
    
    let mut checks = HashMap::new();
    checks.insert("database".to_string(), db_connected);
    
    let status = if db_connected {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    
    let response = ReadinessResponse {
        status: if db_connected { "ready".to_string() } else { "not ready".to_string() },
        checks,
    };
    
    (status, Json(response))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use crate::server::AppState;
    use std::time::Instant;
    
    #[tokio::test]
    async fn test_liveness_check() {
        let response = liveness_check().await;
        assert_eq!(response.status, "alive");
    }
    
    #[tokio::test]
    #[ignore = "requires database setup - run integration tests separately"]
    async fn test_health_check() {
        // This test is ignored in unit test suite
        // Run with: cargo test -- --ignored
    }
}

//! HTTP Server setup for S-IDE Core Daemon

use axum::{
    body::Body,
    http::{header, Request},
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use std::time::Instant;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, warn};
use uuid::Uuid;

use crate::config::Config;
use crate::error::Result;
use crate::routes;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub start_time: Instant,
}

/// Create the Axum router with all routes and middleware
pub async fn create_server(config: Config) -> Result<Router> {
    let state = AppState {
        config: config.clone(),
        start_time: Instant::now(),
    };
    
    // CORS layer
    let cors = if let Some(origin) = &config.cors_origin {
        CorsLayer::new()
            .allow_origin(origin.parse::<header::HeaderValue>().unwrap_or_else(|_| {
                warn!("Invalid CORS origin: {}", origin);
                header::HeaderValue::from_static("*")
            }))
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    };
    
    // Build router
    let app = Router::new()
        // Health routes (no auth required)
        .merge(routes::health::routes())
        
        // API routes
        .nest("/api", api_routes())
        
        // Add middleware in correct order
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(middleware::from_fn(request_id_middleware))
                .layer(middleware::from_fn(logging_middleware))
        )
        .with_state(state);
    
    Ok(app)
}

/// API routes
fn api_routes() -> Router<AppState> {
    Router::new()
        .nest("/health", routes::health::api_routes())
    // TODO: Add more routes as they are implemented
    // .nest("/workspaces", routes::workspaces::routes())
    // .nest("/decks", routes::decks::routes())
    // .nest("/terminals", routes::terminals::routes())
    // .nest("/agents", routes::agents::routes())
}

/// Request ID middleware - adds unique request ID to each request
async fn request_id_middleware(
    mut request: Request<Body>,
    next: Next,
) -> Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string()[..8].to_string());
    
    request.extensions_mut().insert(request_id.clone());
    
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        "x-request-id",
        request_id.parse().unwrap(),
    );
    
    response
}

/// Logging middleware - logs request/response details
async fn logging_middleware(
    request: Request<Body>,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().clone();
    let request_id = request
        .extensions()
        .get::<String>()
        .cloned()
        .unwrap_or_default();
    
    let response = next.run(request).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    info!(
        request_id = %request_id,
        method = %method,
        uri = %uri,
        status = status.as_u16(),
        duration_ms = duration.as_millis(),
        "Request completed"
    );
    
    response
}

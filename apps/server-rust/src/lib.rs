//! S-IDE Core Daemon Library

pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod repositories;
pub mod routes;
pub mod server;
pub mod terminal;
pub mod utils;
pub mod websocket;

// Re-export commonly used types
pub use config::Config;
pub use error::Error;

/// Result type alias for convenience
pub type Result<T> = error::Result<T>;

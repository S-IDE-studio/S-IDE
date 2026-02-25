//! S-IDE Core Daemon Library

pub mod config;
pub mod error;
pub mod routes;
pub mod server;
pub mod utils;

// Re-export commonly used types
pub use config::Config;
pub use error::Error;

/// Result type alias for convenience
pub type Result<T> = error::Result<T>;

//! Database connection pool management

use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::time::Duration;
use tracing::info;

use crate::config::Config;

/// Create a new database connection pool
pub async fn create_pool(config: &Config) -> anyhow::Result<SqlitePool> {
    let database_url = config.database_url();
    
    info!("Creating database pool at: {}", config.db_path.display());
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&database_url)
        .await?;
    
    info!("Database pool created successfully");
    Ok(pool)
}

/// Setup database with required PRAGMAs
pub async fn setup_database(pool: &SqlitePool) -> anyhow::Result<()> {
    // Enable foreign keys
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;
    
    info!("Database setup complete");
    Ok(())
}

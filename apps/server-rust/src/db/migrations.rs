//! Database migrations

use sqlx::SqlitePool;
use tracing::info;

const MIGRATIONS: &[(&str, i32, &str)] = &[
    ("001_initial", 1, include_str!("../../migrations/001_initial.sql")),
];

/// Run all pending migrations
pub async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    info!("Running database migrations...");
    
    // Ensure migrations table exists
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL UNIQUE,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    )
    .execute(pool)
    .await?;
    
    for (name, version, sql) in MIGRATIONS {
        // Check if already applied
        let applied: Option<(i64,)> = sqlx::query_as(
            "SELECT 1 FROM _migrations WHERE version = ?"
        )
        .bind(version)
        .fetch_optional(pool)
        .await?;
        
        if applied.is_some() {
            info!("Migration {} ({}) already applied, skipping", name, version);
            continue;
        }
        
        info!("Applying migration {} ({})...", name, version);
        
        // Run migration in transaction
        let mut tx = pool.begin().await?;
        
        // Execute migration SQL
        sqlx::query(sql).execute(&mut *tx).await?;
        
        // Record migration
        sqlx::query(
            "INSERT INTO _migrations (version, name) VALUES (?, ?)"
        )
        .bind(version)
        .bind(name)
        .execute(&mut *tx)
        .await?;
        
        tx.commit().await?;
        
        info!("Migration {} ({}) applied successfully", name, version);
    }
    
    info!("All migrations completed");
    Ok(())
}

/// Get current migration version
pub async fn get_migration_version(pool: &SqlitePool) -> anyhow::Result<i32> {
    let version: Option<(i32,)> = sqlx::query_as(
        "SELECT COALESCE(MAX(version), 0) FROM _migrations"
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(version.map(|v| v.0).unwrap_or(0))
}

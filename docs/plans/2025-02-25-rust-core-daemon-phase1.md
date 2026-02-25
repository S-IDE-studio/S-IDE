# Rust Core Daemon Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement foundational database layer and core infrastructure for the Rust Core Daemon, enabling SQLite persistence with sqlx and migrations.

**Architecture:** Following the Node.js implementation pattern while adapting to Rust idioms. Database layer uses sqlx with compile-time checked queries. Migrations embedded in binary for single-file deployment.

**Tech Stack:** Rust, tokio, sqlx (SQLite), anyhow/thiserror, tracing, chrono, uuid

**Reference:** Node.js implementation in `apps/server/src/utils/database.ts`, `apps/server/src/utils/migrations.ts`

---

## Task 1: Database Connection Pool Setup

**Files:**
- Create: `apps/server-rust/src/db/mod.rs`
- Create: `apps/server-rust/src/db/pool.rs`
- Modify: `apps/server-rust/src/config.rs` (add database path)
- Test: `apps/server-rust/src/db/pool_tests.rs`

**Step 1: Add database configuration to Config**

Modify `apps/server-rust/src/config.rs`:

```rust
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub host: String,
    pub cors_origin: Option<String>,
    pub database_path: PathBuf,
    pub data_dir: PathBuf,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let data_dir = dirs::data_dir()
            .map(|d| d.join("side-ide"))
            .unwrap_or_else(|| PathBuf::from("./data"));
        
        std::fs::create_dir_all(&data_dir)?;
        
        Ok(Self {
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8787),
            host: std::env::var("HOST")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
            cors_origin: std::env::var("CORS_ORIGIN").ok(),
            database_path: data_dir.join("side.db"),
            data_dir,
        })
    }
}
```

**Step 2: Create database pool module**

Create `apps/server-rust/src/db/pool.rs`:

```rust
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::time::Duration;
use tracing::info;

use crate::config::Config;

pub async fn create_pool(config: &Config) -> anyhow::Result<SqlitePool> {
    let database_url = format!("sqlite:{}", config.database_path.display());
    
    info!("Creating database pool at: {}", config.database_path.display());
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&database_url)
        .await?;
    
    info!("Database pool created successfully");
    Ok(pool)
}

pub async fn setup_database(pool: &SqlitePool) -> anyhow::Result<()> {
    // Enable foreign keys
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await?;
    
    info!("Database setup complete");
    Ok(())
}
```

**Step 3: Create db module exports**

Create `apps/server-rust/src/db/mod.rs`:

```rust
pub mod pool;

pub use pool::{create_pool, setup_database};
```

**Step 4: Write the test**

Create `apps/server-rust/src/db/pool_tests.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::super::*;
    use tempfile::TempDir;
    
    async fn test_create_pool() {
        let temp_dir = TempDir::new().unwrap();
        let config = Config {
            port: 8787,
            host: "0.0.0.0".to_string(),
            cors_origin: None,
            database_path: temp_dir.path().join("test.db"),
            data_dir: temp_dir.path().to_path_buf(),
        };
        
        let pool = create_pool(&config).await.unwrap();
        setup_database(&pool).await.unwrap();
        
        // Verify connection works
        let row: (i64,) = sqlx::query_as("SELECT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        
        assert_eq!(row.0, 1);
    }
}
```

**Step 5: Update Cargo.toml dependencies**

Add to `apps/server-rust/Cargo.toml` under `[dependencies]`:

```toml
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite", "migrate", "chrono", "uuid"] }
```

Add to `[dev-dependencies]`:

```toml
tempfile = "3.0"
```

**Step 6: Run test**

```bash
cd apps/server-rust
cargo test db::pool_tests::tests::test_create_pool -- --nocapture
```

Expected: PASS

**Step 7: Commit**

```bash
git add apps/server-rust/
git commit -m "feat(core): add database pool setup with sqlx"
```

---

## Task 2: Database Migrations System

**Files:**
- Create: `apps/server-rust/src/db/migrations.rs`
- Create: `apps/server-rust/migrations/001_initial.sql`
- Modify: `apps/server-rust/src/db/mod.rs`
- Test: `apps/server-rust/src/db/migrations_tests.rs`

**Step 1: Create initial migration schema**

Create `apps/server-rust/migrations/001_initial.sql`:

```sql
-- Migration 001: Initial schema
-- Based on Node.js implementation in apps/server/src/utils/migrations.ts

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Decks table
CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Terminals table
CREATE TABLE IF NOT EXISTS terminals (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    deck_id TEXT,
    name TEXT NOT NULL,
    shell TEXT,
    cwd TEXT,
    buffer TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER DEFAULT 0,
    installed INTEGER DEFAULT 0,
    config TEXT, -- JSON configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MCP Servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args TEXT, -- JSON array
    env TEXT, -- JSON object
    enabled INTEGER DEFAULT 0,
    status TEXT DEFAULT 'stopped',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage records table (for cost tracking)
CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    session_id TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost REAL DEFAULT 0.0,
    duration_ms INTEGER DEFAULT 0,
    model TEXT,
    task_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial agent records
INSERT OR IGNORE INTO agents (id, name, enabled, installed) VALUES
    ('claude', 'Claude', 0, 0),
    ('codex', 'Codex', 0, 0),
    ('copilot', 'GitHub Copilot', 0, 0),
    ('cursor', 'Cursor', 0, 0),
    ('kimi', 'Kimi', 0, 0);
```

**Step 2: Create migrations module**

Create `apps/server-rust/src/db/migrations.rs`:

```rust
use sqlx::SqlitePool;
use tracing::{info, warn};

const MIGRATIONS: &[(&str, i32, &str)] = &[
    ("001_initial", 1, include_str!("../../migrations/001_initial.sql")),
];

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

pub async fn get_migration_version(pool: &SqlitePool) -> anyhow::Result<i32> {
    let version: Option<(i32,)> = sqlx::query_as(
        "SELECT COALESCE(MAX(version), 0) FROM _migrations"
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(version.map(|v| v.0).unwrap_or(0))
}
```

**Step 3: Update db module**

Modify `apps/server-rust/src/db/mod.rs`:

```rust
pub mod migrations;
pub mod pool;

pub use migrations::{run_migrations, get_migration_version};
pub use pool::{create_pool, setup_database};
```

**Step 4: Write tests**

Create `apps/server-rust/src/db/migrations_tests.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::config::Config;
    use tempfile::TempDir;
    
    async fn setup_test_db() -> (SqlitePool, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let config = Config {
            port: 8787,
            host: "0.0.0.0".to_string(),
            cors_origin: None,
            database_path: temp_dir.path().join("test.db"),
            data_dir: temp_dir.path().to_path_buf(),
        };
        
        let pool = pool::create_pool(&config).await.unwrap();
        pool::setup_database(&pool).await.unwrap();
        
        (pool, temp_dir)
    }
    
    #[tokio::test]
    async fn test_run_migrations() {
        let (pool, _temp) = setup_test_db().await;
        
        // Run migrations
        migrations::run_migrations(&pool).await.unwrap();
        
        // Check version
        let version = migrations::get_migration_version(&pool).await.unwrap();
        assert!(version >= 1);
        
        // Verify tables exist
        let tables: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        
        let table_names: Vec<String> = tables.into_iter().map(|t| t.0).collect();
        assert!(table_names.contains(&"workspaces".to_string()));
        assert!(table_names.contains(&"decks".to_string()));
        assert!(table_names.contains(&"terminals".to_string()));
        assert!(table_names.contains(&"agents".to_string()));
    }
    
    #[tokio::test]
    async fn test_migrations_idempotent() {
        let (pool, _temp) = setup_test_db().await;
        
        // Run twice
        migrations::run_migrations(&pool).await.unwrap();
        migrations::run_migrations(&pool).await.unwrap();
        
        // Should not error
        let version = migrations::get_migration_version(&pool).await.unwrap();
        assert!(version >= 1);
    }
}
```

**Step 5: Run tests**

```bash
cd apps/server-rust
cargo test db::migrations_tests -- --nocapture
```

Expected: All PASS

**Step 6: Commit**

```bash
git add apps/server-rust/
git commit -m "feat(core): add database migrations system"
```

---

## Task 3: Models and Repository Pattern

**Files:**
- Create: `apps/server-rust/src/models/mod.rs`
- Create: `apps/server-rust/src/models/workspace.rs`
- Create: `apps/server-rust/src/models/deck.rs`
- Create: `apps/server-rust/src/repositories/mod.rs`
- Create: `apps/server-rust/src/repositories/workspace_repo.rs`
- Test: `apps/server-rust/src/repositories/workspace_repo_tests.rs`

**Step 1: Create workspace model**

Create `apps/server-rust/src/models/workspace.rs`:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub path: Option<String>,
}

impl Workspace {
    pub fn new(name: String, path: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            path,
            created_at: now,
            updated_at: now,
        }
    }
}
```

**Step 2: Create deck model**

Create `apps/server-rust/src/models/deck.rs`:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Deck {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub path: Option<String>,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateDeckRequest {
    pub workspace_id: String,
    pub name: String,
    pub path: Option<String>,
}

impl Deck {
    pub fn new(workspace_id: String, name: String, path: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            workspace_id,
            name,
            path,
            created_at: now,
            updated_at: now,
        }
    }
}
```

**Step 3: Create models module**

Create `apps/server-rust/src/models/mod.rs`:

```rust
pub mod deck;
pub mod workspace;

pub use deck::{Deck, CreateDeckRequest};
pub use workspace::{Workspace, CreateWorkspaceRequest, UpdateWorkspaceRequest};
```

**Step 4: Create workspace repository**

Create `apps/server-rust/src/repositories/workspace_repo.rs`:

```rust
use sqlx::SqlitePool;
use tracing::{error, info};

use crate::models::workspace::{Workspace, CreateWorkspaceRequest, UpdateWorkspaceRequest};

pub struct WorkspaceRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> WorkspaceRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }
    
    pub async fn list(&self) -> anyhow::Result<Vec<Workspace>> {
        let workspaces = sqlx::query_as::<_, Workspace>(
            r#"
            SELECT id, name, path, created_at, updated_at
            FROM workspaces
            ORDER BY updated_at DESC
            "#
        )
        .fetch_all(self.pool)
        .await?;
        
        Ok(workspaces)
    }
    
    pub async fn get(&self, id: &str) -> anyhow::Result<Option<Workspace>> {
        let workspace = sqlx::query_as::<_, Workspace>(
            r#"
            SELECT id, name, path, created_at, updated_at
            FROM workspaces
            WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        
        Ok(workspace)
    }
    
    pub async fn create(&self, req: CreateWorkspaceRequest) -> anyhow::Result<Workspace> {
        let workspace = Workspace::new(req.name, req.path);
        
        sqlx::query(
            r#"
            INSERT INTO workspaces (id, name, path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            "#
        )
        .bind(&workspace.id)
        .bind(&workspace.name)
        .bind(&workspace.path)
        .bind(workspace.created_at)
        .bind(workspace.updated_at)
        .execute(self.pool)
        .await?;
        
        info!("Created workspace: {} ({})", workspace.name, workspace.id);
        
        Ok(workspace)
    }
    
    pub async fn update(&self, id: &str, req: UpdateWorkspaceRequest) -> anyhow::Result<Option<Workspace>> {
        let workspace = self.get(id).await?;
        
        if workspace.is_none() {
            return Ok(None);
        }
        
        let mut workspace = workspace.unwrap();
        
        if let Some(name) = req.name {
            workspace.name = name;
        }
        if let Some(path) = req.path {
            workspace.path = path;
        }
        workspace.updated_at = chrono::Utc::now();
        
        sqlx::query(
            r#"
            UPDATE workspaces
            SET name = ?, path = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(&workspace.name)
        .bind(&workspace.path)
        .bind(workspace.updated_at)
        .bind(id)
        .execute(self.pool)
        .await?;
        
        info!("Updated workspace: {} ({})", workspace.name, workspace.id);
        
        Ok(Some(workspace))
    }
    
    pub async fn delete(&self, id: &str) -> anyhow::Result<bool> {
        let result = sqlx::query("DELETE FROM workspaces WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await?;
        
        let deleted = result.rows_affected() > 0;
        
        if deleted {
            info!("Deleted workspace: {}", id);
        }
        
        Ok(deleted)
    }
}
```

**Step 5: Create repositories module**

Create `apps/server-rust/src/repositories/mod.rs`:

```rust
pub mod workspace_repo;

pub use workspace_repo::WorkspaceRepository;
```

**Step 6: Write tests**

Create `apps/server-rust/src/repositories/workspace_repo_tests.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::db::{create_pool, run_migrations, setup_database};
    use crate::config::Config;
    use tempfile::TempDir;
    
    async fn setup_test_repo() -> (WorkspaceRepository<'static>, SqlitePool, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let config = Config {
            port: 8787,
            host: "0.0.0.0".to_string(),
            cors_origin: None,
            database_path: temp_dir.path().join("test.db"),
            data_dir: temp_dir.path().to_path_buf(),
        };
        
        let pool = create_pool(&config).await.unwrap();
        setup_database(&pool).await.unwrap();
        run_migrations(&pool).await.unwrap();
        
        // Leak pool for simplicity in tests (in real code, use proper lifetime management)
        let pool_ref: &'static SqlitePool = Box::leak(Box::new(pool));
        let repo = WorkspaceRepository::new(pool_ref);
        
        (repo, pool_ref.clone(), temp_dir)
    }
    
    #[tokio::test]
    async fn test_create_and_get_workspace() {
        let (repo, _pool, _temp) = setup_test_repo().await;
        
        let req = CreateWorkspaceRequest {
            name: "Test Workspace".to_string(),
            path: "/tmp/test".to_string(),
        };
        
        let created = repo.create(req).await.unwrap();
        assert_eq!(created.name, "Test Workspace");
        
        let fetched = repo.get(&created.id).await.unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().name, "Test Workspace");
    }
    
    #[tokio::test]
    async fn test_list_workspaces() {
        let (repo, _pool, _temp) = setup_test_repo().await;
        
        // Create multiple workspaces
        for i in 0..3 {
            repo.create(CreateWorkspaceRequest {
                name: format!("Workspace {}", i),
                path: format!("/tmp/{}", i),
            }).await.unwrap();
        }
        
        let list = repo.list().await.unwrap();
        assert_eq!(list.len(), 3);
    }
    
    #[tokio::test]
    async fn test_update_workspace() {
        let (repo, _pool, _temp) = setup_test_repo().await;
        
        let created = repo.create(CreateWorkspaceRequest {
            name: "Original".to_string(),
            path: "/tmp/original".to_string(),
        }).await.unwrap();
        
        let updated = repo.update(&created.id, UpdateWorkspaceRequest {
            name: Some("Updated".to_string()),
            path: None,
        }).await.unwrap();
        
        assert!(updated.is_some());
        assert_eq!(updated.unwrap().name, "Updated");
    }
    
    #[tokio::test]
    async fn test_delete_workspace() {
        let (repo, _pool, _temp) = setup_test_repo().await;
        
        let created = repo.create(CreateWorkspaceRequest {
            name: "To Delete".to_string(),
            path: "/tmp/delete".to_string(),
        }).await.unwrap();
        
        let deleted = repo.delete(&created.id).await.unwrap();
        assert!(deleted);
        
        let fetched = repo.get(&created.id).await.unwrap();
        assert!(fetched.is_none());
    }
}
```

**Step 7: Run tests**

```bash
cd apps/server-rust
cargo test repositories::workspace_repo_tests -- --nocapture
```

Expected: All PASS

**Step 8: Commit**

```bash
git add apps/server-rust/
git commit -m "feat(core): add models and workspace repository"
```

---

## Task 4: Integrate Database into App State

**Files:**
- Modify: `apps/server-rust/src/server.rs`
- Modify: `apps/server-rust/src/main.rs`
- Modify: `apps/server-rust/src/lib.rs`

**Step 1: Update AppState to include database**

Modify `apps/server-rust/src/server.rs`:

```rust
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub start_time: Instant,
    pub db_pool: SqlitePool,
}

pub async fn create_server(config: Config, db_pool: SqlitePool) -> Result<Router> {
    let state = AppState {
        config: config.clone(),
        start_time: Instant::now(),
        db_pool,
    };
    // ... rest of the function
}
```

**Step 2: Update main.rs to initialize database**

Modify `apps/server-rust/src/main.rs`:

```rust
use side_core::db::{create_pool, run_migrations, setup_database};

// In the Start command handler:
let config = Config::load()?;
let db_pool = create_pool(&config).await?;
setup_database(&db_pool).await?;
run_migrations(&db_pool).await?;

let server = create_server(config, db_pool).await?;
// ... rest
```

**Step 3: Update lib.rs exports**

Modify `apps/server-rust/src/lib.rs`:

```rust
pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod repositories;
pub mod routes;
pub mod server;
pub mod utils;
```

**Step 4: Build and test**

```bash
cd apps/server-rust
cargo build
```

Expected: Build SUCCESS

**Step 5: Integration test**

```bash
cargo run -- status
# Then in another terminal:
cargo run --
# Check if server starts with database
```

**Step 6: Commit**

```bash
git add apps/server-rust/
git commit -m "feat(core): integrate database into app state"
```

---

## Task 5: Health Check Endpoint Enhancement

**Files:**
- Modify: `apps/server-rust/src/routes/health.rs`

**Step 1: Update health check to include database status**

Modify `apps/server-rust/src/routes/health.rs`:

```rust
use axum::{
    extract::State,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::time::Instant;

use crate::server::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    status: String,
    uptime: u64,
    pid: u32,
    version: String,
    database: String,
    ports: PortsInfo,
}

#[derive(Serialize)]
pub struct PortsInfo {
    http: u16,
}

#[derive(Serialize)]
pub struct PortsResponse {
    core_daemon: PortInfo,
}

#[derive(Serialize)]
pub struct PortInfo {
    port: u16,
    status: String,
}

pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    // Check database connectivity
    let db_status = match sqlx::query("SELECT 1").fetch_one(&state.db_pool).await {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };
    
    Json(HealthResponse {
        status: "healthy".to_string(),
        uptime: state.start_time.elapsed().as_secs(),
        pid: std::process::id(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        database: db_status.to_string(),
        ports: PortsInfo {
            http: state.config.port,
        },
    })
}

pub async fn ports_check(State(state): State<AppState>) -> Json<PortsResponse> {
    Json(PortsResponse {
        core_daemon: PortInfo {
            port: state.config.port,
            status: "listening".to_string(),
        },
    })
}

pub fn routes() -> Router<AppState> {
    Router::new()
}

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(health_check))
        .route("/ports", get(ports_check))
}
```

**Step 2: Run and test**

```bash
cargo run -- &
sleep 2
curl http://localhost:8787/api/health
# Should show database status
cargo run -- status
```

Expected: Health check shows database status

**Step 3: Commit**

```bash
git add apps/server-rust/
git commit -m "feat(core): enhance health check with database status"
```

---

## Phase 1 Completion Checklist

- [ ] Database pool with sqlx configured
- [ ] Migrations system working
- [ ] Core tables created (workspaces, decks, terminals, agents)
- [ ] Repository pattern for workspaces
- [ ] Database integrated into AppState
- [ ] Health check includes database status
- [ ] All tests passing
- [ ] Build succeeds

## Next Phase Preview

Phase 2 will implement:
1. Workspaces API routes (CRUD)
2. Decks API routes
3. Files API with path traversal protection
4. Git operations API

These will follow the Node.js implementation patterns in `apps/server/src/routes/`.

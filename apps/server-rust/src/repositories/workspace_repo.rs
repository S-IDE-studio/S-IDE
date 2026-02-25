//! Workspace repository

use sqlx::SqlitePool;
use tracing::info;

use crate::models::workspace::{CreateWorkspaceRequest, UpdateWorkspaceRequest, Workspace};

/// Repository for workspace operations
pub struct WorkspaceRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> WorkspaceRepository<'a> {
    /// Create a new workspace repository
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    /// List all workspaces
    pub async fn list(&self) -> anyhow::Result<Vec<Workspace>> {
        let workspaces = sqlx::query_as::<_, Workspace>(
            r#"
            SELECT id, name, path, created_at, updated_at
            FROM workspaces
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(self.pool)
        .await?;

        Ok(workspaces)
    }

    /// Get a workspace by ID
    pub async fn get(&self, id: &str) -> anyhow::Result<Option<Workspace>> {
        let workspace = sqlx::query_as::<_, Workspace>(
            r#"
            SELECT id, name, path, created_at, updated_at
            FROM workspaces
            WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;

        Ok(workspace)
    }

    /// Create a new workspace
    pub async fn create(&self, req: CreateWorkspaceRequest) -> anyhow::Result<Workspace> {
        let workspace = Workspace::new(req.name, req.path);

        sqlx::query(
            r#"
            INSERT INTO workspaces (id, name, path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
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

    /// Update a workspace
    pub async fn update(
        &self,
        id: &str,
        req: UpdateWorkspaceRequest,
    ) -> anyhow::Result<Option<Workspace>> {
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
            "#,
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

    /// Delete a workspace
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

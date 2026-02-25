//! Terminal repository

use sqlx::SqlitePool;
use tracing::info;

use crate::models::terminal::{CreateTerminalRequest, Terminal};

pub struct TerminalRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> TerminalRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn list(&self) -> anyhow::Result<Vec<Terminal>> {
        let terminals = sqlx::query_as::<_, Terminal>(
            r#"
            SELECT id, workspace_id, deck_id, name, shell, cwd, buffer, created_at, updated_at
            FROM terminals
            ORDER BY updated_at DESC
            "#,
        )
        .fetch_all(self.pool)
        .await?;

        Ok(terminals)
    }

    pub async fn list_by_workspace(&self, workspace_id: &str) -> anyhow::Result<Vec<Terminal>> {
        let terminals = sqlx::query_as::<_, Terminal>(
            r#"
            SELECT id, workspace_id, deck_id, name, shell, cwd, buffer, created_at, updated_at
            FROM terminals
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            "#,
        )
        .bind(workspace_id)
        .fetch_all(self.pool)
        .await?;

        Ok(terminals)
    }

    pub async fn get(&self, id: &str) -> anyhow::Result<Option<Terminal>> {
        let terminal = sqlx::query_as::<_, Terminal>(
            r#"
            SELECT id, workspace_id, deck_id, name, shell, cwd, buffer, created_at, updated_at
            FROM terminals
            WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;

        Ok(terminal)
    }

    pub async fn create(&self, req: CreateTerminalRequest) -> anyhow::Result<Terminal> {
        let terminal = Terminal::new(
            req.workspace_id,
            req.deck_id,
            req.name.unwrap_or_else(|| "Terminal".to_string()),
            req.shell,
            req.cwd,
        );

        sqlx::query(
            r#"
            INSERT INTO terminals (id, workspace_id, deck_id, name, shell, cwd, buffer, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&terminal.id)
        .bind(&terminal.workspace_id)
        .bind(&terminal.deck_id)
        .bind(&terminal.name)
        .bind(&terminal.shell)
        .bind(&terminal.cwd)
        .bind(&terminal.buffer)
        .bind(terminal.created_at)
        .bind(terminal.updated_at)
        .execute(self.pool)
        .await?;

        info!("Created terminal: {} ({})", terminal.name, terminal.id);

        Ok(terminal)
    }

    pub async fn delete(&self, id: &str) -> anyhow::Result<bool> {
        let result = sqlx::query("DELETE FROM terminals WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await?;

        let deleted = result.rows_affected() > 0;

        if deleted {
            info!("Deleted terminal: {}", id);
        }

        Ok(deleted)
    }

    pub async fn update_cwd(&self, id: &str, cwd: &str) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            UPDATE terminals
            SET cwd = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(cwd)
        .bind(chrono::Utc::now())
        .bind(id)
        .execute(self.pool)
        .await?;

        Ok(())
    }
}

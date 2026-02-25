//! Deck repository

use sqlx::SqlitePool;
use tracing::info;

use crate::models::deck::{CreateDeckRequest, Deck};

pub struct DeckRepository<'a> {
    pool: &'a SqlitePool,
}

impl<'a> DeckRepository<'a> {
    pub fn new(pool: &'a SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn list_by_workspace(&self, workspace_id: &str) -> anyhow::Result<Vec<Deck>> {
        let decks = sqlx::query_as::<_, Deck>(
            r#"
            SELECT id, workspace_id, name, path, created_at, updated_at
            FROM decks
            WHERE workspace_id = ?
            ORDER BY updated_at DESC
            "#,
        )
        .bind(workspace_id)
        .fetch_all(self.pool)
        .await?;

        Ok(decks)
    }

    pub async fn get(&self, id: &str) -> anyhow::Result<Option<Deck>> {
        let deck = sqlx::query_as::<_, Deck>(
            r#"
            SELECT id, workspace_id, name, path, created_at, updated_at
            FROM decks
            WHERE id = ?
            "#,
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;

        Ok(deck)
    }

    pub async fn create(&self, req: CreateDeckRequest) -> anyhow::Result<Deck> {
        let deck = Deck::new(req.workspace_id, req.name, req.path);

        sqlx::query(
            r#"
            INSERT INTO decks (id, workspace_id, name, path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&deck.id)
        .bind(&deck.workspace_id)
        .bind(&deck.name)
        .bind(&deck.path)
        .bind(deck.created_at)
        .bind(deck.updated_at)
        .execute(self.pool)
        .await?;

        info!("Created deck: {} ({}) in workspace {}", deck.name, deck.id, deck.workspace_id);

        Ok(deck)
    }

    pub async fn delete(&self, id: &str) -> anyhow::Result<bool> {
        let result = sqlx::query("DELETE FROM decks WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await?;

        let deleted = result.rows_affected() > 0;

        if deleted {
            info!("Deleted deck: {}", id);
        }

        Ok(deleted)
    }
}

//! Deck model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Deck entity
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

/// Request to create a deck
#[derive(Debug, Clone, Deserialize)]
pub struct CreateDeckRequest {
    pub workspace_id: String,
    pub name: String,
    pub path: Option<String>,
}

impl Deck {
    /// Create a new deck
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

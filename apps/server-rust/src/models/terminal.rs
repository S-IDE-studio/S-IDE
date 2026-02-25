//! Terminal model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Terminal session entity
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Terminal {
    pub id: String,
    pub workspace_id: Option<String>,
    pub deck_id: Option<String>,
    pub name: String,
    pub shell: Option<String>,
    pub cwd: Option<String>,
    #[serde(skip_serializing)]
    pub buffer: Option<String>,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub updated_at: DateTime<Utc>,
}

/// Request to create a terminal
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTerminalRequest {
    pub workspace_id: Option<String>,
    pub deck_id: Option<String>,
    pub name: Option<String>,
    pub shell: Option<String>,
    pub cwd: Option<String>,
}

/// Terminal session status
#[derive(Debug, Clone, Serialize)]
pub struct TerminalStatus {
    pub id: String,
    pub name: String,
    pub is_running: bool,
    pub pid: Option<u32>,
}

/// Terminal size for resize operations
#[derive(Debug, Clone, Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

impl Terminal {
    /// Create a new terminal session
    pub fn new(
        workspace_id: Option<String>,
        deck_id: Option<String>,
        name: String,
        shell: Option<String>,
        cwd: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            workspace_id,
            deck_id,
            name,
            shell,
            cwd,
            buffer: Some(String::new()),
            created_at: now,
            updated_at: now,
        }
    }
}

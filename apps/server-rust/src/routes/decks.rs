//! Decks API routes

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::{
    models::deck::{CreateDeckRequest, Deck},
    repositories::deck_repo::DeckRepository,
    server::AppState,
};

#[derive(Debug, Serialize)]
pub struct ListDecksResponse {
    pub decks: Vec<Deck>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDeckBody {
    pub name: String,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/workspace/:workspace_id", get(list_decks))
        .route("/", post(create_deck))
        .route("/:id", get(get_deck))
        .route("/:id", delete(delete_deck))
}

async fn list_decks(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
) -> Json<ListDecksResponse> {
    let repo = DeckRepository::new(&state.db_pool);
    match repo.list_by_workspace(&workspace_id).await {
        Ok(decks) => Json(ListDecksResponse { decks }),
        Err(e) => {
            warn!("Failed to list decks for workspace '{}': {}", workspace_id, e);
            Json(ListDecksResponse { decks: vec![] })
        }
    }
}

async fn get_deck(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Deck>, (StatusCode, Json<ErrorResponse>)> {
    let repo = DeckRepository::new(&state.db_pool);
    match repo.get(&id).await {
        Ok(Some(deck)) => Ok(Json(deck)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Deck '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
        Err(e) => {
            warn!("Failed to get deck '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to retrieve deck".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn create_deck(
    State(state): State<AppState>,
    Json(body): Json<CreateDeckBody>,
) -> Result<(StatusCode, Json<Deck>), (StatusCode, Json<ErrorResponse>)> {
    if body.name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Deck name cannot be empty".to_string(),
                code: "VALIDATION_ERROR".to_string(),
            }),
        ));
    }

    let repo = DeckRepository::new(&state.db_pool);
    
    let req = CreateDeckRequest {
        workspace_id: "default".to_string(),
        name: body.name,
        path: body.path,
    };

    match repo.create(req).await {
        Ok(deck) => {
            info!("Created deck via API: {} ({})", deck.name, deck.id);
            Ok((StatusCode::CREATED, Json(deck)))
        }
        Err(e) => {
            warn!("Failed to create deck: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to create deck".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

async fn delete_deck(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let repo = DeckRepository::new(&state.db_pool);

    match repo.delete(&id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Deck '{}' not found", id),
                code: "NOT_FOUND".to_string(),
            }),
        )),
        Err(e) => {
            warn!("Failed to delete deck '{}': {}", id, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to delete deck".to_string(),
                    code: "INTERNAL_ERROR".to_string(),
                }),
            ))
        }
    }
}

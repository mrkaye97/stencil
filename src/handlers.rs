use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use serde_json::{Value, json};
use sqlx::PgPool;

mod crud;

pub use crud::TracesRequest;
pub use crud::{flatten_spans_and_attrs, insert_span_attributes, insert_spans, insert_traces};

pub async fn insert_traces_handler(
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<TracesRequest>,
) -> Result<Json<Value>, StatusCode> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (traces, spans, span_attributes) =
        flatten_spans_and_attrs(&payload).map_err(|_| StatusCode::BAD_REQUEST)?;

    insert_traces(&traces, &mut tx).await?;
    insert_spans(&spans, &mut tx).await?;
    insert_span_attributes(&span_attributes, &mut tx).await?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "status": "success" })))
}

async fn health_check() -> &'static str {
    "OK"
}

pub fn create_router(pool: Arc<PgPool>) -> Router {
    Router::new()
        .route("/health", axum::routing::get(health_check))
        .route("/v1/traces", post(insert_traces_handler))
        .with_state(pool)
}

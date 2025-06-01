use std::sync::Arc;

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use crud::SearchTracesRequest;
use rust_decimal::prelude::ToPrimitive;
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::PgPool;

mod crud;

pub use crud::TracesRequest;
pub use crud::{flatten_spans_and_attrs, insert_span_attributes, insert_spans, insert_traces};
use time::OffsetDateTime;

async fn health_check() -> &'static str {
    "OK"
}

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

#[derive(Serialize)]
struct SpanSet {
    spans: i32,
    matched: i32,
}

#[derive(Serialize)]
struct ReadTrace {
    trace_id: String,
    root_service_name: String,
    root_trace_name: String,
    start_time_ns: i128,
    duration_ns: i64,
    span_set: SpanSet,
}

async fn search_traces_handler(
    State(pool): State<Arc<PgPool>>,
    Query(params): Query<SearchTracesRequest>,
) -> Result<Json<Vec<ReadTrace>>, StatusCode> {
    let limit = params
        .limit
        .unwrap_or(100)
        .to_i32()
        .ok_or(StatusCode::BAD_REQUEST)?;

    let min_duration = params
        .min_duration
        .map(|d| d.to_i64().and_then(|v| v.to_i32()))
        .unwrap_or(Some(0))
        .ok_or(StatusCode::BAD_REQUEST)?;

    let max_duration = params
        .max_duration
        .and_then(|d| d.to_i64())
        .unwrap_or(i64::MAX);

    let started_at = OffsetDateTime::from_unix_timestamp(params.start.to_i64().unwrap_or(0))
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let ended_at = OffsetDateTime::from_unix_timestamp(params.end.to_i64().unwrap_or(0))
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let traces = sqlx::query!(
        "
        SELECT *
        FROM trace
        WHERE
            started_at >= COALESCE($1, NOW() - INTERVAL '1 hour')
            AND ended_at <= COALESCE($2, NOW())
            AND duration_ns >= COALESCE($3, 0)
            AND duration_ns <= COALESCE($4, 9223372036854775807)
        LIMIT COALESCE($5, 100)
        ",
        started_at,
        ended_at,
        min_duration,
        max_duration,
        limit,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result: Vec<ReadTrace> = traces
        .into_iter()
        .map(|trace| {
            let span_set = SpanSet {
                spans: trace.span_count,
                matched: trace.span_count,
            };

            let duration_ns = trace.duration_ns.unwrap_or(0);
            let start_time_ns = trace.started_at.unwrap().unix_timestamp_nanos();

            ReadTrace {
                trace_id: trace.id,
                root_service_name: "".to_string(),
                root_trace_name: "".to_string(),
                start_time_ns,
                duration_ns,
                span_set,
            }
        })
        .collect();

    Ok(Json(result))
}
pub fn create_router(pool: Arc<PgPool>) -> Router {
    Router::new()
        .route("/health", axum::routing::get(health_check))
        .route("/api/echo", axum::routing::get(health_check))
        .route("/v1/traces", post(insert_traces_handler))
        .route("/api/search", get(search_traces_handler))
        .with_state(pool)
}

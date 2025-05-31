use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use serde_json::{Value, json, to_string, to_string_pretty};
use sqlx::PgPool;

mod types;
use time::OffsetDateTime;
pub use types::TracesRequest;

pub async fn traces_handler(
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<TracesRequest>,
) -> Result<Json<Value>, StatusCode> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut start_time = OffsetDateTime::now_utc();
    let mut end_time = OffsetDateTime::from_unix_timestamp(0).unwrap();
    let mut trace_id = String::new();

    for resource_span in payload.resource_spans.iter().clone() {
        for scope_span in resource_span.scope_spans.iter().clone() {
            for span in scope_span.spans.iter().clone() {
                let span_start_time = span.start_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                let span_end_time = span.end_time().map_err(|_| StatusCode::BAD_REQUEST)?;

                if start_time > span_start_time {
                    start_time = span_start_time;
                }

                if end_time < span_end_time {
                    end_time = span_end_time;
                }

                if let Ok(id) = span.trace_id_hex() {
                    trace_id = id;
                }
            }
        }
    }

    let duration_ns = if start_time < end_time {
        (end_time - start_time).whole_nanoseconds() as i64
    } else {
        0
    };

    sqlx::query!(
        r#"
                INSERT INTO traces (trace_id, start_time, end_time, duration_ns)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (trace_id) DO UPDATE SET
                    start_time = LEAST(traces.start_time, $2),
                    end_time = GREATEST(traces.end_time, $3),
                    duration_ns = GREATEST(traces.duration_ns, $4)
                "#,
        trace_id,
        start_time,
        end_time,
        duration_ns
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for resource_span in payload.resource_spans {
        for scope_span in resource_span.scope_spans {
            for span in scope_span.spans {
                let trace_id = span.trace_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;
                let start_time = span.start_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                let end_time = span.end_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                let duration_ns = span.duration_ns().map_err(|_| StatusCode::BAD_REQUEST)?;

                let span_id = span.span_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;
                sqlx::query!(
                    r#"
                INSERT INTO spans (
                    span_id, trace_id, parent_span_id, operation_name,
                    start_time, end_time, duration_ns, status_code, status_message
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (span_id) DO NOTHING
                "#,
                    span_id,
                    trace_id,
                    span.parent_span_id,
                    span.name,
                    start_time,
                    end_time,
                    duration_ns,
                    span.status_code(),
                    span.status_message()
                )
                .execute(&mut *tx)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

                for (key, value) in span.attributes_map() {
                    sqlx::query!(
                        r#"
                    INSERT INTO span_attributes (span_id, key, value)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (span_id, key) DO UPDATE SET value = $3
                    "#,
                        span_id,
                        key,
                        value
                    )
                    .execute(&mut *tx)
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                }
            }
        }
    }

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
        .route("/v1/traces", post(traces_handler))
        .with_state(pool)
}

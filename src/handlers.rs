use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json, to_string, to_string_pretty};
use sqlx::PgPool;

mod types;
pub use types::TracesRequest;

pub async fn traces_handler(
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<TracesRequest>,
) -> Result<Json<Value>, StatusCode> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut trace_id_to_start_and_end_times = HashMap::new();

    for resource_span in payload.resource_spans.iter().clone() {
        for scope_span in resource_span.scope_spans.iter().clone() {
            for span in scope_span.spans.iter().clone() {
                let span_start_time = span.start_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                let span_end_time = span.end_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                let trace_id = span.trace_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;

                use std::collections::hash_map::Entry;

                match trace_id_to_start_and_end_times.entry(trace_id.clone()) {
                    Entry::Vacant(e) => {
                        e.insert((span_start_time, span_end_time));
                    }
                    Entry::Occupied(mut e) => {
                        let (start_time, end_time) = e.get_mut();
                        if *start_time > span_start_time {
                            *start_time = span_start_time;
                        }
                        if *end_time < span_end_time {
                            *end_time = span_end_time;
                        }
                    }
                }
            }
        }
    }

    for (trace_id, (start_time, end_time)) in &trace_id_to_start_and_end_times {
        let duration_ns = (*end_time - *start_time).whole_nanoseconds().to_i64();

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
    }

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
                .map_err(|err| {
                    println!("Failed to insert span: {:?}", span);
                    eprintln!("Error: {}", span.status_message().unwrap_or_default());
                    println!("Error details: {:?}", err);

                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

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

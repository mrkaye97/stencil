use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json, to_string, to_string_pretty};
use sqlx::{PgPool, QueryBuilder};

mod types;
use time::OffsetDateTime;
pub use types::TracesRequest;

struct Trace {
    trace_id: String,
    start_time: OffsetDateTime,
    end_time: OffsetDateTime,
    duration_ns: Option<i64>,
}

struct Span {
    span_id: String,
    trace_id: String,
    parent_span_id: Option<String>,
    name: String,
    start_time: OffsetDateTime,
    end_time: OffsetDateTime,
    duration_ns: i64,
    status_code: i32,
    status_message: Option<String>,
}

struct SpanAttribute {
    span_id: String,
    key: String,
    value: String,
}

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

    let mut traces: Vec<Trace> = Vec::new();

    for (trace_id, (start_time, end_time)) in &trace_id_to_start_and_end_times {
        let duration_ns = (*end_time - *start_time).whole_nanoseconds().to_i64();
        let trace = Trace {
            trace_id: trace_id.clone(),
            start_time: *start_time,
            end_time: *end_time,
            duration_ns,
        };

        traces.push(trace);
    }

    let mut query_builder =
        QueryBuilder::new("INSERT INTO traces (trace_id, start_time, end_time, duration_ns) ");

    query_builder.push_values(traces, |mut b, trace| {
        b.push_bind(trace.trace_id)
            .push_bind(trace.start_time)
            .push_bind(trace.end_time)
            .push_bind(trace.duration_ns);
    });
    let query = query_builder.build();

    query
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut spans: Vec<Span> = Vec::new();
    let mut span_attributes: Vec<SpanAttribute> = Vec::new();

    for resource_span in payload.resource_spans {
        for scope_span in resource_span.scope_spans {
            for span in scope_span.spans {
                let trace_id = span.trace_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;
                let start_time = span.start_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                let end_time = span.end_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                let duration_ns = span.duration_ns().map_err(|_| StatusCode::BAD_REQUEST)?;
                let span_id = span.span_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;

                spans.push(Span {
                    span_id: span_id.clone(),
                    trace_id: trace_id.clone(),
                    parent_span_id: span.parent_span_id.clone(),
                    name: span.name.clone(),
                    start_time,
                    end_time,
                    duration_ns,
                    status_code: span.status_code(),
                    status_message: span.status_message().map(|s| s.to_string()),
                });

                for (key, value) in span.attributes_map() {
                    span_attributes.push(SpanAttribute {
                        span_id: span_id.clone(),
                        key: key.clone(),
                        value: value.clone(),
                    });
                }
            }
        }
    }

    let mut span_bulk_insert_builder = QueryBuilder::new(
        "INSERT INTO spans (
                    span_id, trace_id, parent_span_id, operation_name,
                    start_time, end_time, duration_ns, status_code, status_message
                ) ",
    );

    span_bulk_insert_builder.push_values(spans, |mut b, span| {
        b.push_bind(span.span_id)
            .push_bind(span.trace_id)
            .push_bind(span.parent_span_id)
            .push_bind(span.name)
            .push_bind(span.start_time)
            .push_bind(span.end_time)
            .push_bind(span.duration_ns)
            .push_bind(span.status_code)
            .push_bind(span.status_message);
    });

    let span_bulk_insert = span_bulk_insert_builder.build();

    span_bulk_insert
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut span_attribute_bulk_insert_builder =
        QueryBuilder::new("INSERT INTO span_attributes (span_id, key, value) ");

    span_attribute_bulk_insert_builder.push_values(span_attributes, |mut b, span| {
        b.push_bind(span.span_id)
            .push_bind(span.key)
            .push_bind(span.value);
    });

    let span_attribute_bulk_insert = span_attribute_bulk_insert_builder.build();

    span_attribute_bulk_insert
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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

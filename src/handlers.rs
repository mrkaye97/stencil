use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use crud::{SearchTracesRequest, SpanKind};
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
                root_service_name: "foo-bar".to_string(),
                root_trace_name: "foo-bar".to_string(),
                start_time_ns,
                duration_ns,
                span_set,
            }
        })
        .collect();

    Ok(Json(result))
}

#[derive(Serialize)]
pub struct TempoTraceResponse {
    batches: Vec<TempoBatch>,
}

#[derive(Serialize)]
pub struct TempoBatch {
    resource: TempoResource,
    #[serde(rename = "scopeSpans")]
    scope_spans: Vec<TempoScopeSpan>,
}

#[derive(Serialize)]
pub struct TempoResource {
    attributes: Vec<TempoAttribute>,
}

#[derive(Serialize)]
pub struct TempoScopeSpan {
    scope: TempoScope,
    spans: Vec<TempoSpan>,
}

#[derive(Serialize)]
pub struct TempoScope {}

#[derive(Serialize)]
pub struct TempoSpan {
    #[serde(rename = "traceId")]
    trace_id: String,
    #[serde(rename = "spanId")]
    span_id: String,
    #[serde(rename = "parentSpanId", skip_serializing_if = "Option::is_none")]
    parent_span_id: Option<String>,
    name: String,
    kind: i32,
    #[serde(rename = "startTimeUnixNano")]
    start_time_unix_nano: String,
    #[serde(rename = "endTimeUnixNano")]
    end_time_unix_nano: String,
    attributes: Vec<TempoAttribute>,
    status: TempoStatus,
}

#[derive(Serialize, Clone)]
pub struct TempoAttribute {
    key: String,
    value: TempoAttributeValue,
}

#[derive(Serialize, Clone)]
pub struct TempoAttributeValue {
    #[serde(rename = "stringValue")]
    string_value: String,
}

#[derive(Serialize)]
pub struct TempoStatus {
    code: i32,
    message: String,
}

pub async fn get_trace_handler(
    State(pool): State<Arc<PgPool>>,
    Path(trace_id): Path<String>,
) -> Result<Json<TempoTraceResponse>, StatusCode> {
    let spans = sqlx::query!(
        "SELECT id, trace_id, parent_span_id, operation_name, started_at, ended_at,
                status_code, status_message, kind AS \"kind: SpanKind\"
         FROM span
         WHERE trace_id = $1
         ORDER BY started_at",
        trace_id
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if spans.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }

    let span_ids: Vec<String> = spans.iter().map(|s| s.id.clone()).collect();
    let attributes = sqlx::query!(
        "SELECT span_id, key, value FROM span_attribute WHERE span_id = ANY($1)",
        &span_ids
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut span_attributes = HashMap::new();
    for attr in attributes {
        span_attributes
            .entry(attr.span_id)
            .or_insert_with(Vec::new)
            .push(TempoAttribute {
                key: attr.key,
                value: TempoAttributeValue {
                    string_value: attr.value,
                },
            });
    }

    let tempo_spans: Vec<TempoSpan> = spans
        .into_iter()
        .map(|span| {
            let kind = match span.kind {
                SpanKind::Internal => 1,
                SpanKind::Server => 2,
                SpanKind::Client => 3,
                SpanKind::Producer => 4,
                SpanKind::Consumer => 5,
                _ => 0,
            };

            let start_time_ns = span
                .started_at
                .map(|t| t.unix_timestamp_nanos())
                .unwrap_or(0);
            let end_time_ns = span
                .ended_at
                .map(|t| t.unix_timestamp_nanos())
                .unwrap_or(start_time_ns);

            let attributes = span_attributes.get(&span.id).cloned().unwrap_or_default();

            TempoSpan {
                trace_id: span.trace_id,
                span_id: span.id.clone(),
                parent_span_id: span.parent_span_id,
                name: span.operation_name.unwrap_or_default(),
                kind,
                start_time_unix_nano: start_time_ns.to_string(),
                end_time_unix_nano: end_time_ns.to_string(),
                attributes,
                status: TempoStatus {
                    code: span.status_code.unwrap_or(1),
                    message: span.status_message.unwrap_or_default(),
                },
            }
        })
        .collect();

    let response = TempoTraceResponse {
        batches: vec![TempoBatch {
            resource: TempoResource { attributes: vec![] },
            scope_spans: vec![TempoScopeSpan {
                scope: TempoScope {},
                spans: tempo_spans,
            }],
        }],
    };

    Ok(Json(response))
}

pub fn create_router(pool: Arc<PgPool>) -> Router {
    Router::new()
        .route("/health", axum::routing::get(health_check))
        .route("/api/echo", axum::routing::get(health_check))
        .route("/v1/traces", post(insert_traces_handler))
        .route("/api/search", get(search_traces_handler))
        .route("/api/traces/{trace_id}", get(get_trace_handler))
        .with_state(pool)
}

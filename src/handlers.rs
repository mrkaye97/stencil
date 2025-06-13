use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use opentelemetry_proto::tonic::collector::logs::v1::ExportLogsServiceRequest;
use prost::Message;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::PgPool;

use opentelemetry_proto::tonic::collector::trace::v1::ExportTraceServiceRequest;

mod crud;

pub use crud::{
    flatten_logs_and_attrs, flatten_spans_and_attrs, insert_log_attributes, insert_logs,
    insert_span_attributes, insert_spans, insert_traces,
};
use time::OffsetDateTime;

use crate::handlers::crud::{WriteableLog, WriteableSpan, WriteableTrace};

pub async fn insert_traces_handler(
    State(pool): State<Arc<PgPool>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Value>, StatusCode> {
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("application/x-protobuf")
        && !content_type.contains("application/protobuf")
    {
        return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }

    let payload = ExportTraceServiceRequest::decode(body).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (traces, spans, span_attributes) =
        flatten_spans_and_attrs(&payload).map_err(|_| StatusCode::BAD_REQUEST)?;

    insert_traces(&traces, &mut tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    insert_spans(&spans, &mut tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    insert_span_attributes(&span_attributes, &mut tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "status": "success" })))
}

pub async fn insert_logs_handler(
    State(pool): State<Arc<PgPool>>,
    body: Bytes,
) -> Result<Json<Value>, StatusCode> {
    use prost::Message;
    let payload =
        ExportLogsServiceRequest::decode(&body[..]).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (logs, log_attributes) =
        flatten_logs_and_attrs(&payload).map_err(|_| StatusCode::BAD_REQUEST)?;

    insert_logs(&logs, &mut tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    insert_log_attributes(&log_attributes, &mut tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "status": "success" })))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpanAttribute {
    pub key: String,
    pub value: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchTracesQuery {
    service_name: Option<String>,
    operation_name: Option<String>,
    min_duration_ns: Option<i64>,
    max_duration_ns: Option<i64>,
    status_code: Option<i32>,
    span_attributes: Option<Vec<SpanAttribute>>,
    offset: Option<i64>,
    limit: Option<i64>,
}

pub async fn search_traces_handler(
    State(pool): State<Arc<PgPool>>,
    Query(query): Query<SearchTracesQuery>,
) -> Result<Json<Vec<WriteableTrace>>, StatusCode> {
    let mut span_attribute_names: Vec<String> = Vec::new();
    let mut span_attribute_values: Vec<String> = Vec::new();
    if let Some(attrs) = &query.span_attributes {
        for attr in attrs {
            span_attribute_names.push(attr.key.clone());
            span_attribute_values.push(attr.value.clone());
        }
    }

    let records = sqlx::query!(
        r#"
        WITH attrs AS (
            SELECT
                UNNEST($6::TEXT[]) AS key,
                UNNEST($7::TEXT[]) AS value
        )

        SELECT DISTINCT
            t.id,
            t.started_at,
            t.ended_at,
            t.duration_ns,
            t.span_count
        FROM trace t
        LEFT JOIN span s ON t.id = s.trace_id
        WHERE
            ($1::TEXT IS NULL OR s.service_name = $1::TEXT)
            AND ($2::TEXT IS NULL OR s.operation_name = $2::TEXT)
            AND ($3::BIGINT IS NULL OR t.duration_ns >= $3::BIGINT)
            AND ($4::BIGINT IS NULL OR t.duration_ns <= $4::BIGINT)
            AND ($5::INTEGER IS NULL OR s.status_code = $5::INTEGER)
            AND (
                CARDINALITY($6::TEXT[]) = 0
                OR EXISTS (
                    SELECT 1
                    FROM span_attribute sa
                    JOIN attrs a ON (sa.key, sa.value) = (a.key, a.value)
                    WHERE sa.span_id = s.id
                )
            )
        ORDER BY started_at DESC
        LIMIT COALESCE($8::BIGINT, 100)
        OFFSET COALESCE($9::BIGINT, 0)
        "#,
        query.service_name.as_deref(),
        query.operation_name.as_deref(),
        query.min_duration_ns,
        query.max_duration_ns,
        query.status_code,
        &span_attribute_names,
        &span_attribute_values,
        query.limit.unwrap_or(100),
        query.offset.unwrap_or(0),
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let traces: Vec<WriteableTrace> = records
        .into_iter()
        .map(|record| WriteableTrace {
            trace_id: record.id,
            start_time: record
                .started_at
                .unwrap_or_else(|| OffsetDateTime::now_utc()),
            end_time: record.ended_at.unwrap_or_else(|| OffsetDateTime::now_utc()),
            duration_ns: record.duration_ns,
            span_count: record.span_count,
        })
        .collect();

    Ok(Json(traces))
}

pub async fn get_trace_handler(
    State(pool): State<Arc<PgPool>>,
    Path(trace_id): axum::extract::Path<String>,
) -> Result<Json<WriteableTrace>, StatusCode> {
    let maybe_record = sqlx::query!(
        r#"
        SELECT
            id,
            started_at,
            ended_at,
            duration_ns,
            span_count
        FROM trace
        WHERE id = $1
        "#,
        trace_id
    )
    .fetch_optional(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if maybe_record.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    let record = maybe_record.unwrap();

    let trace = WriteableTrace {
        trace_id: record.id,
        start_time: record
            .started_at
            .unwrap_or_else(|| OffsetDateTime::now_utc()),
        end_time: record.ended_at.unwrap_or_else(|| OffsetDateTime::now_utc()),
        duration_ns: record.duration_ns,
        span_count: record.span_count,
    };

    Ok(Json(trace))
}

pub async fn list_spans_handler(
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<Vec<WriteableSpan>>, StatusCode> {
    let records = sqlx::query!(
        r#"
        SELECT
            id,
            trace_id,
            parent_span_id,
            operation_name,
            started_at,
            ended_at,
            duration_ns,
            status_code,
            status_message,
            service_name,
            instrumentation_library
        FROM span
        ORDER BY started_at DESC
        LIMIT 100
        "#
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let spans: Vec<WriteableSpan> = records
        .into_iter()
        .map(|record| WriteableSpan {
            span_id: record.id,
            trace_id: record.trace_id,
            parent_span_id: record.parent_span_id,
            operation_name: record.operation_name,
            start_time: record.started_at,
            end_time: record.ended_at,
            duration_ns: record.duration_ns,
            status_code: record.status_code,
            status_message: record.status_message,
            span_kind: crud::DbSpanKind::Unspecified,
            instrumentation_library: record.instrumentation_library,
            service_name: record.service_name,
        })
        .collect();

    Ok(Json(spans))
}

pub async fn list_logs_handler(
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<Vec<WriteableLog>>, StatusCode> {
    let records = sqlx::query!(
        r#"
        SELECT
            id,
            trace_id,
            span_id,
            timestamp,
            observed_timestamp,
            severity_number,
            severity_text,
            body,
            instrumentation_library,
            service_name
        FROM log
        ORDER BY timestamp DESC
        LIMIT 100
        "#
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let logs: Vec<WriteableLog> = records
        .into_iter()
        .map(|record| WriteableLog {
            log_id: record.id,
            trace_id: record.trace_id,
            span_id: record.span_id,
            timestamp: record.timestamp,
            observed_timestamp: record.observed_timestamp,
            severity_number: record.severity_number,
            severity_text: record.severity_text,
            body: record.body,
            instrumentation_library: record.instrumentation_library,
            service_name: record.service_name,
        })
        .collect();

    Ok(Json(logs))
}

pub async fn get_trace_spans_handler(
    State(pool): State<Arc<PgPool>>,
    Path(trace_id): axum::extract::Path<String>,
) -> Result<Json<Vec<WriteableSpan>>, StatusCode> {
    let records = sqlx::query!(
        r#"
        SELECT
            id,
            trace_id,
            parent_span_id,
            operation_name,
            started_at,
            ended_at,
            duration_ns,
            status_code,
            status_message,
            instrumentation_library,
            service_name
        FROM span
        WHERE trace_id = $1
        ORDER BY started_at ASC
        "#,
        trace_id
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let spans: Vec<WriteableSpan> = records
        .into_iter()
        .map(|record| WriteableSpan {
            span_id: record.id,
            trace_id: record.trace_id,
            parent_span_id: record.parent_span_id,
            operation_name: record.operation_name,
            start_time: record.started_at,
            end_time: record.ended_at,
            duration_ns: record.duration_ns,
            status_code: record.status_code,
            status_message: record.status_message,
            span_kind: crud::DbSpanKind::Unspecified,
            instrumentation_library: record.instrumentation_library,
            service_name: record.service_name,
        })
        .collect();

    Ok(Json(spans))
}

async fn health_check() -> &'static str {
    "OK"
}

pub fn create_otel_router(pool: Arc<PgPool>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/v1/traces", post(insert_traces_handler))
        .route("/v1/logs", post(insert_logs_handler))
        .with_state(pool)
}

pub fn create_api_router(pool: Arc<PgPool>) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/traces", get(search_traces_handler))
        .route("/traces/{trace_id}", get(get_trace_handler))
        .route("/traces/{trace_id}/spans", get(get_trace_spans_handler))
        .route("/spans", get(list_spans_handler))
        .route("/logs", get(list_logs_handler))
        .with_state(pool)
}

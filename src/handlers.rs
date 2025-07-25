use core::panic;
use std::collections::HashMap;
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
use sqlx::{PgPool, Postgres, QueryBuilder, Row};

use opentelemetry_proto::tonic::collector::trace::v1::ExportTraceServiceRequest;

mod crud;

pub use crud::{
    flatten_logs_and_attrs, flatten_spans, insert_log_attributes, insert_logs, insert_spans,
    insert_traces,
};
use time::OffsetDateTime;

use crate::handlers::crud::{SpanAttributeValue, WriteableLog, WriteableSpan, WriteableTrace};

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

    let (traces, spans) = flatten_spans(&payload).map_err(|_| StatusCode::BAD_REQUEST)?;

    insert_traces(&traces, &mut tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    insert_spans(&spans, &mut tx)
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
    pub value: SpanAttributeValue,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchTracesQuery {
    service_name: Option<String>,
    operation_name: Option<String>,
    min_duration_ns: Option<i64>,
    max_duration_ns: Option<i64>,
    status_code: Option<i32>,
    span_attributes: Option<String>, // Change to String for JSON parsing
    offset: Option<i64>,
    limit: Option<i64>,
}

pub async fn search_traces_handler(
    State(pool): State<Arc<PgPool>>,
    Query(query): Query<SearchTracesQuery>,
) -> Result<Json<Vec<WriteableTrace>>, StatusCode> {
    let mut span_attribute_names: Vec<String> = Vec::new();
    let mut span_attribute_values: Vec<String> = Vec::new();
    if let Some(attrs_json) = &query.span_attributes {
        let attrs: Vec<SpanAttribute> =
            serde_json::from_str(attrs_json).map_err(|_| StatusCode::BAD_REQUEST)?;

        for attr in attrs {
            span_attribute_names.push(attr.key.clone());
            let value_str = match &attr.value {
                SpanAttributeValue::String(s) => s.clone(),
                SpanAttributeValue::Int(i) => i.to_string(),
                SpanAttributeValue::Float(f) => f.to_string(),
                SpanAttributeValue::Bool(b) => b.to_string(),
            };
            span_attribute_values.push(value_str);
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
                $6::TEXT[] IS NULL OR
                NOT EXISTS (
                    SELECT 1 FROM attrs
                    WHERE NOT (
                        s.attributes ? attrs.key AND
                        (s.attributes ->> attrs.key) = attrs.value
                    )
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

fn json_to_span_attributes(json: Option<Value>) -> HashMap<String, SpanAttributeValue> {
    if let Some(Value::Object(map)) = json {
        map.into_iter()
            .map(|(k, v)| {
                let value = match v {
                    Value::String(s) => SpanAttributeValue::String(s),
                    Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            SpanAttributeValue::Int(i)
                        } else if let Some(f) = n.as_f64() {
                            SpanAttributeValue::Float(f)
                        } else {
                            SpanAttributeValue::String(n.to_string())
                        }
                    }
                    _ => SpanAttributeValue::String(v.to_string()),
                };
                (k, value)
            })
            .collect()
    } else {
        HashMap::new()
    }
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
            instrumentation_library,
            attributes
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
            attributes: json_to_span_attributes(record.attributes),
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
            service_name,
            attributes
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
            attributes: json_to_span_attributes(record.attributes),
        })
        .collect();

    Ok(Json(spans))
}

pub async fn list_span_attributes_handler(
    State(pool): State<Arc<PgPool>>,
) -> Result<Json<Vec<String>>, StatusCode> {
    let records = sqlx::query!(
        r#"
        WITH attrs AS (
            SELECT t.key
            FROM span, LATERAL JSONB_EACH(attributes) AS t(key, value)
            WHERE attributes IS NOT NULL
        )

        SELECT DISTINCT key
        FROM attrs
        WHERE key IS NOT NULL
        ORDER BY KEY
        "#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let attributes: Vec<String> = records
        .into_iter()
        .filter_map(|record| record.key)
        .collect();

    Ok(Json(attributes))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum AggregateType {
    Count,
    Sum(String),
    Avg(String),
    Min(String),
    Max(String),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum TimeBin {
    Second,
    Minute,
    Hour,
    Day,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimeBinQuery {
    pub bin: TimeBin,
    pub value: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Filter {
    pub column: String,
    pub value: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum AggregateSource {
    SpanColumn,
    SpanAttribute,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Aggregate {
    pub agg_type: AggregateType,
    pub source: AggregateSource,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QuerySpec {
    aggregate: Aggregate,
    filters: Option<Vec<Filter>>,
    group: Option<String>,
    time_bin: Option<TimeBinQuery>,
}

fn time_bin_to_sql(input: &TimeBinQuery) -> String {
    match input.bin {
        TimeBin::Second => format!(
            "DATE_BIN(INTERVAL '{} second', started_at, '1970-01-01 00:00:00'::TIMESTAMPTZ) AS time_bin,",
            input.value
        ),
        TimeBin::Minute => format!(
            "DATE_BIN(INTERVAL '{} minute', started_at, '1970-01-01 00:00:00'::TIMESTAMPTZ) AS time_bin,",
            input.value
        ),
        TimeBin::Hour => format!(
            "DATE_BIN(INTERVAL '{} hour', started_at, '1970-01-01 00:00:00'::TIMESTAMPTZ) AS time_bin,",
            input.value
        ),
        TimeBin::Day => format!(
            "DATE_BIN(INTERVAL '{} day', started_at, '1970-01-01 00:00:00'::TIMESTAMPTZ) AS time_bin,",
            input.value
        ),
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimeSeriesValue {
    #[serde(with = "time::serde::rfc3339")]
    pub end_time: OffsetDateTime,
    pub value: f64,
    pub group: Option<String>,
}

fn build_query<'a>(params: &'a QuerySpec) -> QueryBuilder<'a, Postgres> {
    let allowed_columns = vec![
        "trace_id",
        "operation_name",
        "started_at",
        "ended_at",
        "duration_ns",
        "status_code",
        "kind",
        "instrumentation_library",
        "service_name",
    ];

    let mut builder: QueryBuilder<Postgres> = QueryBuilder::new("SELECT ");

    let time_bin = params.time_bin.as_ref().unwrap_or(&TimeBinQuery {
        bin: TimeBin::Minute,
        value: 1,
    });
    let time_bin_sql = time_bin_to_sql(time_bin);

    builder.push(time_bin_sql.as_str());

    if params.group.is_some() {
        let col = params.group.as_ref().unwrap();

        if col.is_empty() || !allowed_columns.contains(&col.as_str()) {
            panic!("Invalid grouping column: {}", col);
        }

        builder.push(&format!("\n{col} AS group, "));
    }

    match &params.aggregate.source {
        AggregateSource::SpanColumn => match &params.aggregate.agg_type {
            AggregateType::Count => {
                builder.push("\nCOUNT(*)::DOUBLE PRECISION AS value");
            }
            AggregateType::Sum(column) => {
                if column.is_empty() || !allowed_columns.contains(&column.as_str()) {
                    panic!("Invalid aggregate column: {}", column);
                }

                builder.push(&format!("\nSUM({})::DOUBLE PRECISION AS value", column));
            }
            AggregateType::Avg(column) => {
                if column.is_empty() || !allowed_columns.contains(&column.as_str()) {
                    panic!("Invalid aggregate column: {}", column);
                }
                builder.push(&format!("\nAVG({})::DOUBLE PRECISION AS value", column));
            }
            AggregateType::Min(column) => {
                if column.is_empty() || !allowed_columns.contains(&column.as_str()) {
                    panic!("Invalid aggregate column: {}", column);
                }
                builder.push(&format!("\nMIN({})::DOUBLE PRECISION AS value", column));
            }
            AggregateType::Max(column) => {
                if column.is_empty() || !allowed_columns.contains(&column.as_str()) {
                    panic!("Invalid aggregate column: {}", column);
                }
                builder.push(&format!("\nMAX({})::DOUBLE PRECISION AS value", column));
            }
        },
        AggregateSource::SpanAttribute => {
            match &params.aggregate.agg_type {
                AggregateType::Count => {
                    builder.push("COUNT(*)::DOUBLE PRECISION AS value");
                }
                AggregateType::Sum(key) => {
                    builder.push("COALESCE(SUM((attributes ->> ");
                    builder.push_bind(key);
                    builder.push(")::DOUBLE PRECISION), 0.0) AS value");
                }
                AggregateType::Avg(key) => {
                    builder.push("COALESCE(AVG((attributes ->> ");
                    builder.push_bind(key);
                    builder.push(")::DOUBLE PRECISION), 0.0) AS value");
                }
                AggregateType::Min(key) => {
                    builder.push("COALESCE(MIN((attributes ->> ");
                    builder.push_bind(key);
                    builder.push(")::DOUBLE PRECISION), 0.0) AS value");
                }
                AggregateType::Max(key) => {
                    builder.push("COALESCE(MAX((attributes ->> ");
                    builder.push_bind(key);
                    builder.push(")::DOUBLE PRECISION), 0.0) AS value");
                }
            };
        }
    }

    builder.push("\nFROM span ");

    let mut has_where_clause = false;

    if let Some(filters) = &params.filters {
        if !filters.is_empty() {
            builder.push("\nWHERE ");
            has_where_clause = true;

            for (i, filter) in filters.iter().enumerate() {
                if filter.column.is_empty() || !allowed_columns.contains(&filter.column.as_str()) {
                    panic!("Invalid filter column: {}", filter.column);
                }

                builder.push(&format!("{} = ", filter.column));
                builder.push_bind(filter.value.as_str());

                if i < filters.len() - 1 {
                    builder.push(" AND ");
                }
            }
        }
    }

    if &params.aggregate.source == &AggregateSource::SpanAttribute {
        if !has_where_clause {
            builder.push("\nWHERE ");
            has_where_clause = true;
        } else {
            builder.push(" AND ");
        }

        builder.push("attributes IS NOT NULL");

        match &params.aggregate.agg_type {
            AggregateType::Sum(key)
            | AggregateType::Avg(key)
            | AggregateType::Min(key)
            | AggregateType::Max(key) => {
                builder.push(" AND attributes ? ");
                builder.push_bind(key.as_str());
                builder.push("AND jsonb_typeof(attributes -> ");
                builder.push_bind(key.as_str());
                builder.push(") = 'number'");
            }
            _ => {}
        }
    }

    builder.push("\nGROUP BY time_bin");

    if params.group.is_some() {
        let col = params.group.as_ref().unwrap();

        if col.is_empty() || !allowed_columns.contains(&col.as_str()) {
            panic!("Invalid grouping column: {}", col);
        }

        builder.push(&format!(", {}", col));
    }

    builder.push("\nORDER BY time_bin");

    if params.group.is_some() {
        let col = params.group.as_ref().unwrap();

        if col.is_empty() || !allowed_columns.contains(&col.as_str()) {
            panic!("Invalid ordering column: {}", col);
        }

        builder.push(&format!(", {}", col));
    }

    builder
}

pub async fn query_handler(
    State(pool): State<Arc<PgPool>>,
    Json(query_spec): Json<QuerySpec>,
) -> Result<Json<Vec<TimeSeriesValue>>, StatusCode> {
    let mut builder = build_query(&query_spec);
    let query = builder.build();

    let results = query
        .fetch_all(&*pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut time_series_values = Vec::new();

    for r in results {
        let time_bin = r.get::<OffsetDateTime, _>("time_bin");
        let value: f64 = r.get("value");
        let mut group_value: Option<String> = None;

        if query_spec.group.is_some() {
            group_value = r.get("group");
        }

        time_series_values.push(TimeSeriesValue {
            end_time: time_bin,
            value,
            group: group_value,
        });
    }

    Ok(Json(time_series_values))
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
        .route("/span-attributes", get(list_span_attributes_handler))
        .route("/query", post(query_handler))
        .with_state(pool)
}

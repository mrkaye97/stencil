use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use rust_decimal::prelude::ToPrimitive;
use serde_json::{Value, json, to_string, to_string_pretty};
use sqlx::postgres::PgArguments;
use sqlx::{PgPool, Postgres, QueryBuilder};

mod types;
use time::OffsetDateTime;
pub use types::TracesRequest;

struct Trace {
    trace_id: String,
    start_time: OffsetDateTime,
    end_time: OffsetDateTime,
    duration_ns: Option<i64>,
}

#[derive(Clone, Debug)]
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

#[derive(Clone, Debug)]
struct SpanAttribute {
    span_id: String,
    key: String,
    value: String,
}

async fn insert_traces(
    traces: &Vec<Trace>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), StatusCode> {
    let mut query_builder: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO traces (trace_id, start_time, end_time, duration_ns) ");

    query_builder.push_values(traces, |mut b, trace| {
        b.push_bind(trace.trace_id.clone())
            .push_bind(trace.start_time)
            .push_bind(trace.end_time)
            .push_bind(trace.duration_ns);
    });

    let query = query_builder.build();
    query
        .execute(&mut **tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}

async fn insert_spans(
    spans: &Vec<Span>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), StatusCode> {
    let mut query_builder = QueryBuilder::new(
        "INSERT INTO spans (
                    span_id, trace_id, parent_span_id, operation_name,
                    start_time, end_time, duration_ns, status_code, status_message
                ) ",
    );

    query_builder.push_values(spans, |mut b, span| {
        b.push_bind(span.span_id.clone())
            .push_bind(span.trace_id.clone())
            .push_bind(span.parent_span_id.clone())
            .push_bind(span.name.clone())
            .push_bind(span.start_time)
            .push_bind(span.end_time)
            .push_bind(span.duration_ns)
            .push_bind(span.status_code)
            .push_bind(span.status_message.clone());
    });

    let query = query_builder.build();

    query
        .execute(&mut **tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}

async fn insert_span_attributes(
    span_attributes: &Vec<SpanAttribute>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), StatusCode> {
    let mut query_builder = QueryBuilder::new("INSERT INTO span_attributes (span_id, key, value) ");

    query_builder.push_values(span_attributes, |mut b, attr| {
        b.push_bind(attr.span_id.clone())
            .push_bind(attr.key.clone())
            .push_bind(attr.value.clone());
    });

    let query = query_builder.build();

    query
        .execute(&mut **tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}

fn flatten_spans_and_attrs(
    payload: &TracesRequest,
) -> Result<(Vec<Trace>, Vec<Span>, Vec<SpanAttribute>), StatusCode> {
    let mut trace_id_to_start_and_end_times = HashMap::new();

    for resource_span in payload.resource_spans.iter() {
        for scope_span in resource_span.scope_spans.iter() {
            for span in scope_span.spans.iter() {
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

    let spans_and_attrs: Result<Vec<(Span, Vec<SpanAttribute>)>, StatusCode> = payload
        .resource_spans
        .iter()
        .clone()
        .flat_map(|resource_span| {
            resource_span
                .scope_spans
                .iter()
                .clone()
                .flat_map(|scope_span| {
                    scope_span.spans.iter().clone().map(|s| {
                        let trace_id = s.trace_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;
                        let start_time = s.start_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                        let end_time = s.end_time().map_err(|_| StatusCode::BAD_REQUEST)?;
                        let duration_ns = s.duration_ns().map_err(|_| StatusCode::BAD_REQUEST)?;
                        let span_id = s.span_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;
                        let status_code = s.status_code();
                        let status_message = s.status_message().map(|s| s.to_string());

                        let span = Span {
                            span_id: span_id.clone(),
                            trace_id,
                            parent_span_id: s.parent_span_id.clone(),
                            name: s.name.clone(),
                            start_time,
                            end_time,
                            duration_ns,
                            status_code,
                            status_message,
                        };

                        let attrs: Result<Vec<SpanAttribute>, StatusCode> = s
                            .attributes_map()
                            .into_iter()
                            .map(|(k, v)| {
                                let span_id_for_attr =
                                    s.span_id_hex().map_err(|_| StatusCode::BAD_REQUEST)?;
                                Ok(SpanAttribute {
                                    span_id: span_id_for_attr,
                                    key: k.clone(),
                                    value: v.clone(),
                                })
                            })
                            .collect();

                        Ok((span, attrs?))
                    })
                })
        })
        .collect();

    let spans_and_attrs = spans_and_attrs?;

    let spans = spans_and_attrs
        .iter()
        .map(|(span, _)| span.clone())
        .collect::<Vec<Span>>();

    let span_attributes = spans_and_attrs
        .iter()
        .clone()
        .flat_map(|(_, attrs)| attrs.iter().map(|attr| attr.clone()))
        .collect::<Vec<SpanAttribute>>();

    Ok((traces, spans, span_attributes))
}

pub async fn traces_handler(
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
        .route("/v1/traces", post(traces_handler))
        .with_state(pool)
}

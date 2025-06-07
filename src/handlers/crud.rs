use rust_decimal::prelude::ToPrimitive;
use sqlx::{Postgres, QueryBuilder};
use std::collections::HashMap;
use time::OffsetDateTime;

use opentelemetry_proto::tonic::collector;
use opentelemetry_proto::tonic::collector::trace::v1::ExportTraceServiceRequest;
use opentelemetry_proto::tonic::common::v1::{AnyValue, any_value::Value};
use opentelemetry_proto::tonic::resource::v1::Resource;
use opentelemetry_proto::tonic::trace::v1::{ScopeSpans, Span};

#[derive(Clone, Debug, PartialEq, PartialOrd, sqlx::Type)]
#[sqlx(type_name = "span_kind", rename_all = "UPPERCASE")]
pub enum DbSpanKind {
    Unspecified = 0,
    Internal = 1,
    Server = 2,
    Client = 3,
    Producer = 4,
    Consumer = 5,
}

#[derive(Clone, Debug)]
pub struct WriteableSpan {
    span_id: String,
    trace_id: String,
    parent_span_id: Option<String>,
    operation_name: String,
    start_time: OffsetDateTime,
    end_time: OffsetDateTime,
    duration_ns: i64,
    status_code: i32,
    status_message: Option<String>,
    span_kind: DbSpanKind,
    instrumentation_library: Option<String>,
    service_name: Option<String>,
}

pub struct WriteableTrace {
    trace_id: String,
    start_time: OffsetDateTime,
    end_time: OffsetDateTime,
    duration_ns: Option<i64>,
    span_count: i32,
}

#[derive(Clone, Debug)]
pub struct WriteableSpanAttribute {
    span_id: String,
    key: String,
    value: String,
}

pub trait SpanExt {
    fn trace_id_hex(&self) -> Result<String, Box<dyn std::error::Error>>;
    fn span_id_hex(&self) -> Result<String, Box<dyn std::error::Error>>;
    fn parent_span_id_hex(&self) -> Option<String>;
    fn start_time(&self) -> Result<OffsetDateTime, Box<dyn std::error::Error>>;
    fn end_time(&self) -> Result<OffsetDateTime, Box<dyn std::error::Error>>;
    fn duration_ns(&self) -> Result<i64, Box<dyn std::error::Error>>;
    fn status_code(&self) -> i32;
    fn status_message(&self) -> Option<String>;
    fn attributes_map(&self) -> HashMap<String, String>;
    fn span_kind_to_db(&self) -> DbSpanKind;
}

impl SpanExt for Span {
    fn trace_id_hex(&self) -> Result<String, Box<dyn std::error::Error>> {
        if self.trace_id.len() != 16 {
            return Err("Invalid trace_id length - expected 16 bytes".into());
        }
        Ok(hex::encode(&self.trace_id))
    }

    fn span_id_hex(&self) -> Result<String, Box<dyn std::error::Error>> {
        if self.span_id.len() != 8 {
            return Err("Invalid span_id length - expected 8 bytes".into());
        }
        Ok(hex::encode(&self.span_id))
    }

    fn parent_span_id_hex(&self) -> Option<String> {
        if self.parent_span_id.is_empty() {
            None
        } else {
            Some(hex::encode(&self.parent_span_id))
        }
    }

    fn start_time(&self) -> Result<OffsetDateTime, Box<dyn std::error::Error>> {
        Ok(OffsetDateTime::from_unix_timestamp_nanos(
            self.start_time_unix_nano as i128,
        )?)
    }

    fn end_time(&self) -> Result<OffsetDateTime, Box<dyn std::error::Error>> {
        Ok(OffsetDateTime::from_unix_timestamp_nanos(
            self.end_time_unix_nano as i128,
        )?)
    }

    fn duration_ns(&self) -> Result<i64, Box<dyn std::error::Error>> {
        Ok((self.end_time_unix_nano - self.start_time_unix_nano) as i64)
    }

    fn status_code(&self) -> i32 {
        self.status.as_ref().map(|s| s.code as i32).unwrap_or(0)
    }

    fn status_message(&self) -> Option<String> {
        self.status.as_ref().and_then(|s| {
            if s.message.is_empty() {
                None
            } else {
                Some(s.message.clone())
            }
        })
    }

    fn attributes_map(&self) -> HashMap<String, String> {
        self.attributes
            .iter()
            .map(|kv| (kv.key.clone(), any_value_to_string(&kv.value)))
            .collect()
    }

    fn span_kind_to_db(&self) -> DbSpanKind {
        match self.kind {
            0 => DbSpanKind::Unspecified,
            1 => DbSpanKind::Internal,
            2 => DbSpanKind::Server,
            3 => DbSpanKind::Client,
            4 => DbSpanKind::Producer,
            5 => DbSpanKind::Consumer,
            _ => DbSpanKind::Unspecified,
        }
    }
}

fn any_value_to_string(value: &Option<AnyValue>) -> String {
    match value {
        Some(any_value) => match &any_value.value {
            Some(Value::StringValue(s)) => s.clone(),
            Some(Value::BoolValue(b)) => b.to_string(),
            Some(Value::IntValue(i)) => i.to_string(),
            Some(Value::DoubleValue(d)) => d.to_string(),
            Some(Value::ArrayValue(arr)) => {
                let values: Vec<String> = arr
                    .values
                    .iter()
                    .map(|v| any_value_to_string(&Some(v.clone())))
                    .collect();
                format!("[{}]", values.join(", "))
            }
            Some(Value::KvlistValue(kvlist)) => {
                let pairs: Vec<String> = kvlist
                    .values
                    .iter()
                    .map(|kv| format!("{}:{}", kv.key, any_value_to_string(&kv.value)))
                    .collect();
                format!("{{{}}}", pairs.join(", "))
            }
            Some(Value::BytesValue(bytes)) => hex::encode(bytes),
            None => String::new(),
        },
        None => String::new(),
    }
}

fn extract_service_name(resource: &Option<Resource>) -> Option<String> {
    resource
        .as_ref()?
        .attributes
        .iter()
        .find(|kv| kv.key == "service.name")
        .and_then(|kv| match &kv.value {
            Some(any_value) => match &any_value.value {
                Some(Value::StringValue(s)) => Some(s.clone()),
                _ => None,
            },
            None => None,
        })
}

fn extract_instrumentation_library(scope_spans: &ScopeSpans) -> Option<String> {
    Some(scope_spans.scope.as_ref()?.name.clone())
}

pub async fn insert_traces(
    traces: &Vec<WriteableTrace>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), tonic::Status> {
    if traces.is_empty() {
        return Ok(());
    }

    let mut query_builder: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO trace (id, started_at, ended_at, duration_ns, span_count) ");

    query_builder.push_values(traces, |mut b, trace| {
        b.push_bind(trace.trace_id.clone())
            .push_bind(trace.start_time)
            .push_bind(trace.end_time)
            .push_bind(trace.duration_ns)
            .push_bind(trace.span_count);
    });

    let query = query_builder.build();
    query
        .execute(&mut **tx)
        .await
        .map_err(|e| tonic::Status::internal(format!("Database error: {}", e)))?;

    Ok(())
}

pub async fn insert_spans(
    spans: &Vec<WriteableSpan>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), tonic::Status> {
    if spans.is_empty() {
        return Ok(());
    }

    let mut query_builder = QueryBuilder::new(
        "INSERT INTO span (
                    id, trace_id, parent_span_id, operation_name,
                    started_at, ended_at, duration_ns, status_code, status_message, kind, instrumentation_library, service_name
                ) ",
    );

    query_builder.push_values(spans, |mut b, span| {
        b.push_bind(span.span_id.clone())
            .push_bind(span.trace_id.clone())
            .push_bind(span.parent_span_id.clone())
            .push_bind(span.operation_name.clone())
            .push_bind(span.start_time)
            .push_bind(span.end_time)
            .push_bind(span.duration_ns)
            .push_bind(span.status_code)
            .push_bind(span.status_message.clone())
            .push_bind(span.span_kind.clone())
            .push_bind(span.instrumentation_library.clone())
            .push_bind(span.service_name.clone());
    });

    let query = query_builder.build();

    query
        .execute(&mut **tx)
        .await
        .map_err(|e| tonic::Status::internal(format!("Database error: {}", e)))?;

    Ok(())
}

pub async fn insert_span_attributes(
    span_attributes: &Vec<WriteableSpanAttribute>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), tonic::Status> {
    if span_attributes.is_empty() {
        return Ok(());
    }

    let mut query_builder = QueryBuilder::new("INSERT INTO span_attribute (span_id, key, value) ");

    query_builder.push_values(span_attributes, |mut b, attr| {
        b.push_bind(attr.span_id.clone())
            .push_bind(attr.key.clone())
            .push_bind(attr.value.clone());
    });

    let query = query_builder.build();

    query
        .execute(&mut **tx)
        .await
        .map_err(|e| tonic::Status::internal(format!("Database error: {}", e)))?;

    Ok(())
}

pub fn flatten_spans_and_attrs(
    payload: &ExportTraceServiceRequest,
) -> Result<
    (
        Vec<WriteableTrace>,
        Vec<WriteableSpan>,
        Vec<WriteableSpanAttribute>,
    ),
    tonic::Status,
> {
    let mut trace_id_to_info = HashMap::new();

    for resource_span in payload.resource_spans.iter() {
        for scope_span in resource_span.scope_spans.iter() {
            for span in scope_span.spans.iter() {
                let span_start_time = span.start_time().map_err(|e| {
                    tonic::Status::invalid_argument(format!("Invalid start time: {}", e))
                })?;
                let span_end_time = span.end_time().map_err(|e| {
                    tonic::Status::invalid_argument(format!("Invalid end time: {}", e))
                })?;
                let trace_id = span.trace_id_hex().map_err(|e| {
                    tonic::Status::invalid_argument(format!("Invalid trace ID: {}", e))
                })?;

                use std::collections::hash_map::Entry;

                match trace_id_to_info.entry(trace_id.clone()) {
                    Entry::Vacant(e) => {
                        e.insert((span_start_time, span_end_time, 1));
                    }
                    Entry::Occupied(mut e) => {
                        let (start_time, end_time, span_count) = e.get_mut();
                        if *start_time > span_start_time {
                            *start_time = span_start_time;
                        }
                        if *end_time < span_end_time {
                            *end_time = span_end_time;
                        }
                        *span_count += 1;
                    }
                }
            }
        }
    }

    let mut traces: Vec<WriteableTrace> = Vec::new();
    for (trace_id, (start_time, end_time, span_count)) in &trace_id_to_info {
        let duration_ns = (*end_time - *start_time).whole_nanoseconds().to_i64();
        let trace = WriteableTrace {
            trace_id: trace_id.clone(),
            start_time: *start_time,
            end_time: *end_time,
            duration_ns,
            span_count: *span_count,
        };
        traces.push(trace);
    }

    let spans_and_attrs: Result<Vec<(WriteableSpan, Vec<WriteableSpanAttribute>)>, tonic::Status> =
        payload
            .resource_spans
            .iter()
            .flat_map(|resource_span| {
                resource_span
                    .scope_spans
                    .iter()
                    .flat_map(move |scope_span| {
                        let instrumentation_library = extract_instrumentation_library(scope_span);
                        let service_name = extract_service_name(&resource_span.resource);

                        scope_span.spans.iter().map(move |span| {
                            let trace_id = span.trace_id_hex().map_err(|e| {
                                tonic::Status::invalid_argument(format!("Invalid trace ID: {}", e))
                            })?;
                            let span_id = span.span_id_hex().map_err(|e| {
                                tonic::Status::invalid_argument(format!("Invalid span ID: {}", e))
                            })?;
                            let start_time = span.start_time().map_err(|e| {
                                tonic::Status::invalid_argument(format!(
                                    "Invalid start time: {}",
                                    e
                                ))
                            })?;
                            let end_time = span.end_time().map_err(|e| {
                                tonic::Status::invalid_argument(format!("Invalid end time: {}", e))
                            })?;
                            let duration_ns = span.duration_ns().map_err(|e| {
                                tonic::Status::invalid_argument(format!("Invalid duration: {}", e))
                            })?;

                            let writeable_span = WriteableSpan {
                                span_id: span_id.clone(),
                                trace_id,
                                parent_span_id: span.parent_span_id_hex(),
                                operation_name: span.name.clone(),
                                start_time,
                                end_time,
                                duration_ns,
                                status_code: span.status_code(),
                                status_message: span.status_message(),
                                span_kind: span.span_kind_to_db(),
                                instrumentation_library: instrumentation_library.clone(),
                                service_name: service_name.clone(),
                            };

                            let attributes: Vec<WriteableSpanAttribute> = span
                                .attributes_map()
                                .into_iter()
                                .map(|(k, v)| WriteableSpanAttribute {
                                    span_id: span_id.clone(),
                                    key: k,
                                    value: v,
                                })
                                .collect();

                            Ok((writeable_span, attributes))
                        })
                    })
            })
            .collect();

    let spans_and_attrs = spans_and_attrs?;

    let spans = spans_and_attrs
        .iter()
        .map(|(span, _)| span.clone())
        .collect::<Vec<WriteableSpan>>();

    let span_attributes = spans_and_attrs
        .iter()
        .flat_map(|(_, attrs)| attrs.iter().cloned())
        .collect::<Vec<WriteableSpanAttribute>>();

    Ok((traces, spans, span_attributes))
}

use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use time::OffsetDateTime;

use rust_decimal::prelude::ToPrimitive;
use sqlx::{Postgres, QueryBuilder};

fn empty_string_as_none<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;
    match opt {
        Some(s) if s.is_empty() => Ok(None),
        Some(s) => Ok(Some(s)),
        None => Ok(None),
    }
}

impl<'de> Deserialize<'de> for StatusCode {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = u32::deserialize(deserializer)?;
        match value {
            0 => Ok(StatusCode::Unset),
            1 => Ok(StatusCode::Ok),
            2 => Ok(StatusCode::Error),
            _ => Ok(StatusCode::Unset),
        }
    }
}

impl<'de> Deserialize<'de> for SpanKind {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = u32::deserialize(deserializer)?;
        match value {
            0 => Ok(SpanKind::Unspecified),
            1 => Ok(SpanKind::Internal),
            2 => Ok(SpanKind::Server),
            3 => Ok(SpanKind::Client),
            4 => Ok(SpanKind::Producer),
            5 => Ok(SpanKind::Consumer),
            _ => Ok(SpanKind::Unspecified),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TracesRequest {
    #[serde(rename = "resourceSpans")]
    pub resource_spans: Vec<ResourceSpans>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ResourceSpans {
    pub resource: Option<Resource>,
    #[serde(rename = "scopeSpans")]
    pub scope_spans: Vec<ScopeSpans>,
    #[serde(rename = "schemaUrl", deserialize_with = "empty_string_as_none")]
    pub schema_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Resource {
    pub attributes: Option<Vec<KeyValue>>,
    #[serde(rename = "droppedAttributesCount")]
    pub dropped_attributes_count: Option<u32>,
    #[serde(rename = "entityRefs")]
    pub entity_refs: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ScopeSpans {
    pub scope: Option<InstrumentationScope>,
    pub spans: Vec<Span>,
    #[serde(rename = "schemaUrl", deserialize_with = "empty_string_as_none")]
    pub schema_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct InstrumentationScope {
    pub name: Option<String>,
    #[serde(deserialize_with = "empty_string_as_none")]
    pub version: Option<String>,
    pub attributes: Option<Vec<KeyValue>>,
    #[serde(rename = "droppedAttributesCount")]
    pub dropped_attributes_count: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Span {
    #[serde(rename = "traceId")]
    pub trace_id: String,
    #[serde(rename = "spanId")]
    pub span_id: String,
    #[serde(rename = "parentSpanId", deserialize_with = "empty_string_as_none")]
    pub parent_span_id: Option<String>,
    pub name: String,
    pub kind: Option<SpanKind>,
    #[serde(rename = "startTimeUnixNano")]
    pub start_time_unix_nano: String,
    #[serde(rename = "endTimeUnixNano")]
    pub end_time_unix_nano: String,
    pub attributes: Option<Vec<KeyValue>>,
    pub status: Option<Status>,
    #[serde(rename = "droppedAttributesCount")]
    pub dropped_attributes_count: Option<u32>,
    #[serde(rename = "droppedEventsCount")]
    pub dropped_events_count: Option<u32>,
    #[serde(rename = "droppedLinksCount")]
    pub dropped_links_count: Option<u32>,
    pub events: Option<Vec<Event>>,
    pub flags: Option<u32>,
    pub links: Option<Vec<Link>>,
    #[serde(rename = "traceState", deserialize_with = "empty_string_as_none")]
    pub trace_state: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct KeyValue {
    pub key: String,
    pub value: AnyValue,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum AnyValue {
    StringValue {
        #[serde(rename = "stringValue")]
        string_value: String,
    },
    BoolValue {
        #[serde(rename = "boolValue")]
        bool_value: bool,
    },
    IntValue {
        #[serde(rename = "intValue")]
        int_value: i64,
    },
    DoubleValue {
        #[serde(rename = "doubleValue")]
        double_value: f64,
    },
    ArrayValue {
        #[serde(rename = "arrayValue")]
        array_value: ArrayValue,
    },
    KvlistValue {
        #[serde(rename = "kvlistValue")]
        kvlist_value: KvListValue,
    },
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ArrayValue {
    pub values: Vec<AnyValue>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct KvListValue {
    pub values: Vec<KeyValue>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Event {
    pub name: String,
    #[serde(rename = "timeUnixNano")]
    pub time_unix_nano: String,
    pub attributes: Option<Vec<KeyValue>>,
    #[serde(rename = "droppedAttributesCount")]
    pub dropped_attributes_count: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Link {
    #[serde(rename = "traceId")]
    pub trace_id: String,
    #[serde(rename = "spanId")]
    pub span_id: String,
    #[serde(rename = "traceState")]
    pub trace_state: Option<String>,
    pub attributes: Option<Vec<KeyValue>>,
    #[serde(rename = "droppedAttributesCount")]
    pub dropped_attributes_count: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Status {
    pub code: Option<StatusCode>,
    #[serde(deserialize_with = "empty_string_as_none")]
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub enum StatusCode {
    Unset = 0,
    Ok = 1,
    Error = 2,
}

#[derive(Debug, Serialize)]
#[repr(u32)]
pub enum SpanKind {
    Unspecified = 0,
    Internal = 1,
    Server = 2,
    Client = 3,
    Producer = 4,
    Consumer = 5,
}

impl Span {
    pub fn trace_id_hex(&self) -> Result<String, Box<dyn std::error::Error>> {
        if self.trace_id.len() != 32 {
            return Err("Invalid trace_id length".into());
        }
        Ok(self.trace_id.clone())
    }

    pub fn span_id_hex(&self) -> Result<String, Box<dyn std::error::Error>> {
        if self.span_id.len() != 16 {
            return Err("Invalid span_id length".into());
        }
        Ok(self.span_id.clone())
    }

    pub fn start_time(&self) -> Result<OffsetDateTime, Box<dyn std::error::Error>> {
        let nanos: i128 = self.start_time_unix_nano.parse()?;
        Ok(OffsetDateTime::from_unix_timestamp_nanos(nanos)?)
    }

    pub fn end_time(&self) -> Result<OffsetDateTime, Box<dyn std::error::Error>> {
        let nanos: i128 = self.end_time_unix_nano.parse()?;
        Ok(OffsetDateTime::from_unix_timestamp_nanos(nanos)?)
    }

    pub fn duration_ns(&self) -> Result<i64, Box<dyn std::error::Error>> {
        let start: u64 = self.start_time_unix_nano.parse()?;
        let end: u64 = self.end_time_unix_nano.parse()?;
        Ok((end - start) as i64)
    }

    pub fn status_code(&self) -> i32 {
        self.status
            .as_ref()
            .and_then(|s| s.code.as_ref())
            .map(|c| c.clone() as i32)
            .unwrap_or(0)
    }

    pub fn status_message(&self) -> Option<String> {
        self.status.as_ref().and_then(|s| s.message.clone())
    }

    pub fn attributes_map(&self) -> HashMap<String, String> {
        self.attributes
            .as_ref()
            .map(|attrs| {
                attrs
                    .iter()
                    .map(|kv| (kv.key.clone(), kv.value.to_string()))
                    .collect()
            })
            .unwrap_or_default()
    }
}

impl std::fmt::Display for AnyValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnyValue::StringValue { string_value } => write!(f, "{}", string_value),
            AnyValue::BoolValue { bool_value } => write!(f, "{}", bool_value),
            AnyValue::IntValue { int_value } => write!(f, "{}", int_value),
            AnyValue::DoubleValue { double_value } => write!(f, "{}", double_value),
            AnyValue::ArrayValue { array_value } => {
                write!(
                    f,
                    "[{}]",
                    array_value
                        .values
                        .iter()
                        .map(|v| v.to_string())
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            }
            AnyValue::KvlistValue { kvlist_value } => {
                write!(
                    f,
                    "{{{}}}",
                    kvlist_value
                        .values
                        .iter()
                        .map(|kv| format!("{}:{}", kv.key, kv.value))
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            }
        }
    }
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
    service_name: Option<String>,
    span_kind: Option<String>,
    instrumentation_library: Option<String>,
}

pub struct WriteableTrace {
    trace_id: String,
    start_time: OffsetDateTime,
    end_time: OffsetDateTime,
    duration_ns: Option<i64>,
    service_name: Option<String>,
    span_count: i32,
}

#[derive(Clone, Debug)]
pub struct WriteableSpanAttribute {
    span_id: String,
    key: String,
    value: String,
}

pub async fn insert_traces(
    traces: &Vec<WriteableTrace>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), axum::http::StatusCode> {
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
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}

pub async fn insert_spans(
    spans: &Vec<WriteableSpan>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), axum::http::StatusCode> {
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
            .push_bind(span.operation_name.clone())
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
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}

pub async fn insert_span_attributes(
    span_attributes: &Vec<WriteableSpanAttribute>,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<(), axum::http::StatusCode> {
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
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(())
}

fn extract_service_name(resource: &Option<Resource>) -> Option<String> {
    resource
        .as_ref()?
        .attributes
        .as_ref()?
        .iter()
        .find(|kv| kv.key == "service.name")
        .and_then(|kv| match &kv.value {
            AnyValue::StringValue { string_value } => Some(string_value.clone()),
            _ => None,
        })
}

fn extract_instrumentation_library(scope: &Option<InstrumentationScope>) -> Option<String> {
    scope.as_ref()?.name.clone()
}

fn span_kind_to_string(kind: &Option<SpanKind>) -> Option<String> {
    kind.as_ref().map(|k| match k {
        SpanKind::Unspecified => "UNSPECIFIED".to_string(),
        SpanKind::Internal => "INTERNAL".to_string(),
        SpanKind::Server => "SERVER".to_string(),
        SpanKind::Client => "CLIENT".to_string(),
        SpanKind::Producer => "PRODUCER".to_string(),
        SpanKind::Consumer => "CONSUMER".to_string(),
    })
}

pub fn flatten_spans_and_attrs(
    payload: &TracesRequest,
) -> Result<
    (
        Vec<WriteableTrace>,
        Vec<WriteableSpan>,
        Vec<WriteableSpanAttribute>,
    ),
    axum::http::StatusCode,
> {
    let mut trace_id_to_info = HashMap::new();

    for resource_span in payload.resource_spans.iter() {
        let service_name = extract_service_name(&resource_span.resource);

        for scope_span in resource_span.scope_spans.iter() {
            let instrumentation_library = extract_instrumentation_library(&scope_span.scope);

            for span in scope_span.spans.iter() {
                let span_start_time = span
                    .start_time()
                    .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                let span_end_time = span
                    .end_time()
                    .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                let trace_id = span
                    .trace_id_hex()
                    .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;

                use std::collections::hash_map::Entry;

                match trace_id_to_info.entry(trace_id.clone()) {
                    Entry::Vacant(e) => {
                        e.insert((span_start_time, span_end_time, service_name.clone(), 1));
                    }
                    Entry::Occupied(mut e) => {
                        let (start_time, end_time, _, span_count) = e.get_mut();
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

    for (trace_id, (start_time, end_time, service_name, span_count)) in &trace_id_to_info {
        let duration_ns = (*end_time - *start_time).whole_nanoseconds().to_i64();
        let trace = WriteableTrace {
            trace_id: trace_id.clone(),
            start_time: *start_time,
            end_time: *end_time,
            duration_ns,
            service_name: service_name.clone(),
            span_count: *span_count,
        };

        traces.push(trace);
    }

    let spans_and_attrs: Result<
        Vec<(WriteableSpan, Vec<WriteableSpanAttribute>)>,
        axum::http::StatusCode,
    > = payload
        .resource_spans
        .iter()
        .flat_map(|resource_span| {
            resource_span
                .scope_spans
                .iter()
                .flat_map(move |scope_span| {
                    let instrumentation_library =
                        extract_instrumentation_library(&scope_span.scope);

                    scope_span.spans.iter().map(move |s| {
                        let trace_id = s
                            .trace_id_hex()
                            .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                        let start_time = s
                            .start_time()
                            .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                        let end_time = s
                            .end_time()
                            .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                        let duration_ns = s
                            .duration_ns()
                            .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                        let span_id = s
                            .span_id_hex()
                            .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                        let status_code = s.status_code();
                        let status_message = s.status_message();
                        let span_kind = span_kind_to_string(&s.kind);

                        let span = WriteableSpan {
                            span_id: span_id.clone(),
                            trace_id,
                            parent_span_id: s.parent_span_id.clone(),
                            operation_name: s.name.clone(),
                            start_time,
                            end_time,
                            duration_ns,
                            status_code,
                            status_message,
                            service_name: extract_service_name(&resource_span.resource),
                            span_kind,
                            instrumentation_library: instrumentation_library.clone(),
                        };

                        let attrs: Result<Vec<WriteableSpanAttribute>, axum::http::StatusCode> = s
                            .attributes_map()
                            .into_iter()
                            .map(|(k, v)| {
                                let span_id_for_attr = s
                                    .span_id_hex()
                                    .map_err(|_| axum::http::StatusCode::BAD_REQUEST)?;
                                Ok(WriteableSpanAttribute {
                                    span_id: span_id_for_attr,
                                    key: k,
                                    value: v,
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
        .collect::<Vec<WriteableSpan>>();

    let span_attributes = spans_and_attrs
        .iter()
        .flat_map(|(_, attrs)| attrs.iter().cloned())
        .collect::<Vec<WriteableSpanAttribute>>();

    Ok((traces, spans, span_attributes))
}

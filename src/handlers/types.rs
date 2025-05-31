use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use time::OffsetDateTime;

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
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Resource {
    pub attributes: Option<Vec<KeyValue>>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ScopeSpans {
    pub scope: Option<InstrumentationScope>,
    pub spans: Vec<Span>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct InstrumentationScope {
    pub name: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Span {
    #[serde(rename = "traceId")]
    pub trace_id: String,
    #[serde(rename = "spanId")]
    pub span_id: String,
    #[serde(rename = "parentSpanId")]
    pub parent_span_id: Option<String>,
    pub name: String,
    pub kind: Option<SpanKind>,
    #[serde(rename = "startTimeUnixNano")]
    pub start_time_unix_nano: String,
    #[serde(rename = "endTimeUnixNano")]
    pub end_time_unix_nano: String,
    pub attributes: Option<Vec<KeyValue>>,
    pub status: Option<Status>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct KeyValue {
    pub key: String,
    pub value: AnyValue,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum AnyValue {
    String(String),
    Bool(bool),
    Int(i64),
    Double(f64),
    ArrayValue { array_value: ArrayValue },
    KvlistValue { kvlist_value: KvListValue },
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
pub struct Status {
    pub code: Option<StatusCode>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub enum StatusCode {
    #[serde(rename = "STATUS_CODE_UNSET")]
    Unset = 0,
    #[serde(rename = "STATUS_CODE_OK")]
    Ok = 1,
    #[serde(rename = "STATUS_CODE_ERROR")]
    Error = 2,
}

#[derive(Debug, Deserialize, Serialize)]
pub enum SpanKind {
    #[serde(rename = "SPAN_KIND_UNSPECIFIED")]
    Unspecified = 0,
    #[serde(rename = "SPAN_KIND_INTERNAL")]
    Internal = 1,
    #[serde(rename = "SPAN_KIND_SERVER")]
    Server = 2,
    #[serde(rename = "SPAN_KIND_CLIENT")]
    Client = 3,
    #[serde(rename = "SPAN_KIND_PRODUCER")]
    Producer = 4,
    #[serde(rename = "SPAN_KIND_CONSUMER")]
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
            AnyValue::String(s) => write!(f, "{}", s),
            AnyValue::Bool(b) => write!(f, "{}", b),
            AnyValue::Int(i) => write!(f, "{}", i),
            AnyValue::Double(d) => write!(f, "{}", d),
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

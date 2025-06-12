export interface Trace {
  trace_id: string;
  start_time: string;
  end_time: string;
  duration_ns: number | null;
  span_count: number;
}

export interface Span {
  span_id: string;
  trace_id: string;
  parent_span_id: string | null;
  operation_name: string;
  start_time: string;
  end_time: string;
  duration_ns: number;
  status_code: number;
  status_message: string | null;
  span_kind: string;
  instrumentation_library: string | null;
  service_name: string | null;
}

export interface Log {
  log_id: string;
  trace_id: string | null;
  span_id: string | null;
  timestamp: string;
  observed_timestamp: string | null;
  severity_number: number;
  severity_text: string | null;
  body: string | null;
  instrumentation_library: string | null;
  service_name: string | null;
}

export interface SpanAttribute {
  span_id: string;
  key: string;
  value: string;
}

export interface LogAttribute {
  log_id: string;
  key: string;
  value: string;
}

-- Traces
CREATE TABLE trace (
    id VARCHAR(32) PRIMARY KEY,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_ns BIGINT,
    span_count INTEGER NOT NULL DEFAULT 0
);

-- Spans
CREATE TYPE span_kind AS ENUM (
    'UNSPECIFIED',
    'INTERNAL',
    'SERVER',
    'CLIENT',
    'PRODUCER',
    'CONSUMER'
);

CREATE TABLE span (
    id VARCHAR(16) PRIMARY KEY,
    trace_id VARCHAR(32) NOT NULL REFERENCES trace(id),
    parent_span_id VARCHAR(16),
    operation_name TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_ns BIGINT,
    status_code INTEGER,
    status_message TEXT,
    kind span_kind NOT NULL DEFAULT 'UNSPECIFIED',
    instrumentation_library TEXT,
    service_name TEXT
);

CREATE INDEX idx_span_trace_id_started_at ON span(trace_id, started_at);
CREATE INDEX idx_span_operation_name ON span(operation_name);
CREATE INDEX idx_span_duration_ns ON span(duration_ns);
CREATE INDEX idx_span_status_code ON span(status_code);
CREATE INDEX idx_trace_service_name ON span(service_name);

CREATE TABLE span_attribute (
    span_id VARCHAR(16) NOT NULL REFERENCES span(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (span_id, key)
);
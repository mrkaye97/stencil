-- Services
CREATE TABLE service (
    id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    name TEXT NOT NULL,

    PRIMARY KEY (id)
);

CREATE INDEX idx_service_name ON service(name);

-- Traces
CREATE TABLE trace (
    id VARCHAR(32) PRIMARY KEY,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_ns BIGINT,
    service_id UUID REFERENCES service(id),
    span_count INTEGER DEFAULT 0
);

CREATE INDEX idx_trace_service_id_started_at ON trace(service_id, started_at);

-- Spans
CREATE TYPE span_kind AS ENUM (
    'UNSPECIFIED',
    'INTERNAL',
    'SERVER',
    'CLIENT',
    'PRODUCER',
    'CONSUMER',
)

CREATE TABLE span (
    id VARCHAR(16) PRIMARY KEY,
    trace_id VARCHAR(32) REFERENCES trace(id),
    parent_span_id VARCHAR(16),
    operation_name TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_ns BIGINT,
    status_code INTEGER,
    status_message TEXT,
    kind span_kind NOT NULL DEFAULT 'UNSPECIFIED',
    instrumentation_library TEXT
);

CREATE INDEX idx_span_trace_id_started_at ON span(trace_id, started_at);
CREATE INDEX idx_span_operation_name ON span(operation_name);
CREATE INDEX idx_span_duration_ns ON span(duration_ns);
CREATE INDEX idx_span_status_code ON span(status_code);

CREATE TABLE span_attribute (
    span_id VARCHAR(16) REFERENCES span(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (span_id, key)
);
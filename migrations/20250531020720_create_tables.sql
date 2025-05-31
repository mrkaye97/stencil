CREATE TABLE traces (
    trace_id VARCHAR(32) PRIMARY KEY,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_ns BIGINT
);

CREATE TABLE spans (
    span_id VARCHAR(16) PRIMARY KEY,
    trace_id VARCHAR(32) REFERENCES traces(trace_id),
    parent_span_id VARCHAR(16),
    operation_name TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_ns BIGINT,
    status_code INTEGER,
    status_message TEXT
);

CREATE TABLE span_attributes (
    span_id VARCHAR(16) REFERENCES spans(span_id),
    key TEXT,
    value TEXT,
    PRIMARY KEY (span_id, key)
);
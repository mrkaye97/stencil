-- Add migration script here
ALTER TABLE span ADD COLUMN attributes JSONB;
CREATE INDEX idx_span_attributes ON span USING GIN (attributes);

WITH attributes AS (
    SELECT span_id, jsonb_object_agg(key, value) AS attrs
    FROM span_attribute
    GROUP BY span_id
)

UPDATE span
SET attributes = attrs
FROM attributes
WHERE span.id = attributes.span_id;

DROP TABLE span_attribute;
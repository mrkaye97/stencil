# Stencil

An overly-simple tool for (application) tracing, which is just a few tables in Postgres, but is compatible with the OpenTelemetry standard.

## Setup

1. `docker compose up -d` to run the database
2. Create a `.env` file with `DATABASE_URL=postgres://postgres:postgres@localhost:5462/stencil`
3. `cargo run` to start the server, which will run on port 4317.

## Sending Traces

To send traces from your application, use your OpenTelemetry client of choice, and configure it to send traces to `http://localhost:4317/v1/traces`.

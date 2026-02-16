-- telemetry_events: stores anonymized conversion events
-- Run once in Vercel Postgres dashboard after provisioning the database.

CREATE TABLE telemetry_events (
  id            SERIAL PRIMARY KEY,
  query         TEXT        NOT NULL,
  source_iana   TEXT,
  target_iana   TEXT,
  source_method TEXT,
  target_method TEXT,
  error_type    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_created_at ON telemetry_events (created_at);

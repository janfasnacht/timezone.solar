-- telemetry_events: stores anonymized conversion events
-- Run once via Turso CLI: turso db shell <db-name> < sql/telemetry-schema.sql

CREATE TABLE IF NOT EXISTS telemetry_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  query         TEXT,
  source_iana   TEXT,
  target_iana   TEXT,
  source_method TEXT,
  target_method TEXT,
  error_type    TEXT,
  session_id    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_events (created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_session_id ON telemetry_events (session_id);

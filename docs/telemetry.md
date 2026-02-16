# Query Telemetry

Anonymized conversion events stored in Vercel Postgres to power parser improvement and usage analytics.

## What's collected

| Field | Description |
|-------|-------------|
| `query` | Raw query text (truncated to 500 chars) |
| `source_iana` | Resolved source IANA timezone (null on parse failure) |
| `target_iana` | Resolved target IANA timezone (null on resolve failure) |
| `source_method` | How source was resolved: `entity`, `alias`, `state`, `abbreviation`, `city-db`, `fuzzy` |
| `target_method` | How target was resolved (same values) |
| `error_type` | `parse`, `resolve-source`, `resolve-target`, or null on success |
| `created_at` | Server timestamp |

No IP addresses, user agents, or session identifiers are stored.

## User opt-out

Settings > "Anonymous usage data" toggle. Stored in localStorage as `telemetryOptOut`. When opted out, `sendTelemetry()` is a no-op.

## Architecture

```
Browser                         Vercel
┌──────────────┐    POST /api/telemetry    ┌──────────────┐
│ sendTelemetry│ ──────────────────────────>│ _telemetry.ts│──> Postgres
│ (keepalive)  │    fire-and-forget         │ always 204   │
└──────────────┘                            └──────────────┘
```

- **Client** (`src/lib/telemetry.ts`): Checks opt-out, deduplicates consecutive identical queries, logs to console in dev mode, fire-and-forget fetch in production.
- **API** (`api/_telemetry.ts`): Validates POST, sanitizes enum fields (invalid → null), truncates query, inserts row. Returns 204 even on DB error — telemetry never blocks the user.
- **Bundle** (`scripts/bundle-api.mjs`): esbuild bundles `_telemetry.ts` → `telemetry.js` with `@vercel/postgres` as external.

## Database setup

Provision a Vercel Postgres database, then run the schema once in the dashboard:

```sql
-- sql/telemetry-schema.sql
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
```

Vercel automatically injects `POSTGRES_URL` environment variables when the database is linked to the project.

## Example queries against the data

```sql
-- Failed queries (parser improvement candidates)
SELECT query, error_type, created_at
FROM telemetry_events
WHERE error_type IS NOT NULL
ORDER BY created_at DESC LIMIT 50;

-- Most popular corridors
SELECT source_iana, target_iana, COUNT(*) as n
FROM telemetry_events
WHERE error_type IS NULL
GROUP BY source_iana, target_iana
ORDER BY n DESC LIMIT 20;

-- Resolve method distribution
SELECT source_method, COUNT(*) as n
FROM telemetry_events
WHERE source_method IS NOT NULL
GROUP BY source_method
ORDER BY n DESC;
```

## Local development

In dev mode (`npm run dev`), telemetry logs to `console.debug` prefixed with `[telemetry]` — no network requests are made.

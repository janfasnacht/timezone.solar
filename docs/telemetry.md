# Query Telemetry

Anonymized conversion events stored in Turso (libSQL) to power parser improvement and usage analytics.

## What's collected

| Field | Description |
|-------|-------------|
| `query` | Raw query text (truncated to 500 chars) |
| `source_iana` | Resolved source IANA timezone (null on parse failure) |
| `target_iana` | Resolved target IANA timezone (null on resolve failure) |
| `source_method` | How source was resolved: `entity`, `alias`, `state`, `abbreviation`, `city-db`, `fuzzy` |
| `target_method` | How target was resolved (same values) |
| `error_type` | `parse`, `resolve-source`, `resolve-target`, or null on success |
| `session_id` | Random UUID per browser session (not persisted across sessions) |
| `created_at` | Server timestamp |

No IP addresses, user agents, or personal data are stored. Session IDs are ephemeral — generated fresh on each page load and never written to localStorage.

## User opt-out

Telemetry is **on by default**. Users can disable it via Settings > "Help improve timezone.solar" toggle. Stored in localStorage as `telemetryOptOut`. When opted out, `sendTelemetry()` is a no-op.

## Vercel Web Analytics

In addition to the custom pipeline, the app uses `@vercel/analytics` for lightweight page-view tracking and Web Vitals. This is a separate system managed by Vercel and respects the browser's Do Not Track setting.

## Architecture

```
Browser                         Vercel                    Turso
┌──────────────┐    POST /api/telemetry    ┌──────────────┐
│ sendTelemetry│ ──────────────────────────>│ _telemetry.ts│──> libSQL DB
│ (keepalive)  │    fire-and-forget         │ always 204   │
└──────────────┘                            └──────────────┘
```

- **Client** (`src/lib/telemetry.ts`): Checks opt-out status, deduplicates consecutive identical queries, logs to console in dev mode, fire-and-forget fetch in production. Includes an ephemeral `session_id` for visitor counting.
- **API** (`api/_telemetry.ts`): Validates POST, sanitizes enum fields (invalid → null), truncates query, inserts row via `@libsql/client`. Returns 204 even on DB error — telemetry never blocks the user.
- **Bundle** (`scripts/bundle-api.mjs`): esbuild bundles `_telemetry.ts` → `telemetry.js` with `@libsql/client` as external.

## Database setup

1. Create a Turso database:
   ```bash
   turso db create timezone-telemetry
   ```

2. Run the schema:
   ```bash
   turso db shell timezone-telemetry < sql/telemetry-schema.sql
   ```

3. Create an auth token:
   ```bash
   turso db tokens create timezone-telemetry
   ```

4. Add env vars to Vercel (or use the Turso Vercel integration from the Marketplace):
   - `TURSO_DATABASE_URL` — `libsql://timezone-telemetry-<org>.turso.io`
   - `TURSO_AUTH_TOKEN` — the token from step 3

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

-- Unique sessions per day
SELECT DATE(created_at) AS day, COUNT(DISTINCT session_id) AS unique_sessions
FROM telemetry_events
WHERE session_id IS NOT NULL
GROUP BY day
ORDER BY day DESC LIMIT 30;
```

## Local development

In dev mode (`npm run dev`), telemetry logs to `console.debug` prefixed with `[telemetry]` — no network requests are made.

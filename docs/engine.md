# Engine Architecture

The engine is the core of timezone.solar — a pure-logic layer with zero React dependencies that converts natural language queries like `"3pm NYC to London"` into structured timezone conversion results.

## Pipeline Overview

```
Raw input
  │
  ▼
┌──────────┐     ┌────────────┐     ┌─────────────┐
│  Parser   │ ──▶ │  Resolver   │ ──▶ │  Converter   │
│           │     │             │     │              │
│ "3pm NYC  │     │ NYC → IANA  │     │ Luxon time   │
│  to London│     │ London →    │     │ math between │
│  tomorrow"│     │   IANA      │     │ two zones    │
└──────────┘     └────────────┘     └─────────────┘
  ParsedQuery      ResolvedTimezone    ConversionResult
```

Each stage is a pure function. The hook layer (`useConversion`) orchestrates the pipeline and manages React state, but the engine itself knows nothing about the UI.

## Stage 1: Parser

**File:** `src/engine/parser.ts`

Takes a raw string and produces a `ParsedQuery`:

```ts
{ sourceLocation, targetLocation, time, dateModifier, relativeMinutes }
```

### How it works

1. **Pre-process** — strip noise (`?`, `now`), extract relative time expressions (`"in 2 hours"`, `"in 30 minutes"`, `"in 1h30m"`) before tokenization so `"in"` isn't consumed as a connector.

2. **Tokenize** — split on whitespace, classify each token as `TIME`, `LOCATION`, `CONNECTOR`, or `DATE_MODIFIER`.
   - Time: regex for 12h (`6pm`, `3:30am`), 24h (`18:00`), and named times (`noon`, `midnight`).
   - Connectors: `to`, `in`, `from`, `at`, `→`, `->`, `=>`.
   - Date modifiers: `tomorrow`, `yesterday`, `today`.
   - Everything else: `LOCATION`.

3. **Merge locations** — adjacent `LOCATION` tokens combine into multi-word names (`"New York"`, `"San Francisco"`).

4. **Clean up** — strip leading connectors (`"from Boston to LA"` → `"Boston to LA"`), remove connectors before time (`"at 6pm"` → `"6pm"`).

5. **Pattern match** — the token type sequence (e.g., `LOCATION CONNECTOR LOCATION TIME`) is matched against 13 known patterns to extract source, target, and time. Single-location patterns leave `sourceLocation` null (the UI fills in the user's home city).

### Supported patterns

| # | Token pattern | Example |
|---|--------------|---------|
| 1 | LOC TIME CONN LOC | `Boston 6pm in LA` |
| 2 | TIME LOC CONN LOC | `6pm Boston to LA` |
| 3 | LOC CONN LOC TIME | `Boston to LA 6pm` |
| 4 | LOC TIME LOC | `Boston 6pm LA` |
| 5 | LOC CONN LOC | `Boston to LA` |
| 6 | TIME LOC LOC | `6pm Boston LA` |
| 7 | LOC LOC TIME | `Boston LA 6pm` |
| 8 | LOC LOC | `Boston LA` |
| 9 | TIME CONN LOC CONN LOC | `6pm in Boston to LA` |
| 10 | TIME CONN LOC | `6pm in LA` |
| 11 | LOC TIME | `London 5pm` |
| 12 | TIME LOC | `5pm London` |
| 13 | LOC | `Tokyo` |

Patterns 10–13 are single-location (implicit source = user's home city).

## Stage 2: Resolver

**File:** `src/engine/resolver.ts`

Maps a location string to an IANA timezone via a 6-layer priority pipeline. Returns a `ResolveResult` with a primary match and alternatives (for ambiguous cities like Portland).

### Resolution layers (checked in order)

| Layer | Source | Example | Lookup |
|-------|--------|---------|--------|
| 0. Entity | `city-entities.ts` — curated cities with stable slugs, aliases, metadata | `NYC` → New York | O(1) map + alias scan |
| 1. Alias | `aliases.ts` — legacy aliases (mostly migrated to entities) | — | O(1) map |
| 2. US State | `aliases.ts` — state/region → IANA | `California` → `America/Los_Angeles` | O(1) map |
| 3. TZ abbreviation | `constants.ts` — `EST`, `PST`, `JST`, etc. | `EST` → `America/New_York` | O(1) map |
| 4. City database | `city-timezones` npm package (86K+ cities), pre-normalized into a `Map<string, CityEntry[]>` at module load, buckets sorted by population | `Zürich` → `zurich` → entries | O(1) map |
| 5. Fuzzy search | Fuse.js over cities with pop > 100K, lazy-initialized, threshold 0.3 | `Tokyp` → Tokyo | O(n) search |

All inputs are normalized (lowercase, strip diacritics and punctuation) before lookup. Results are cached in a FIFO cache (500 entries).

When multiple cities share a name (e.g., Portland OR vs Portland ME), they're returned as alternatives sorted by population — the largest city wins the primary slot.

## Stage 3: Converter

**File:** `src/engine/converter.ts`

Takes two `ResolvedTimezone` objects, an optional time, date modifier, and relative minutes — produces a `ConversionResult` with everything the UI needs to render.

### What it does

1. **Build source DateTime** — using Luxon, in the source timezone:
   - If relative time: `now + N minutes`, shifted to source zone.
   - If explicit time: construct from hour/minute in source zone.
   - If neither: use current time in source zone.

2. **Apply date modifier** — `tomorrow` / `yesterday` / `today` shift the source DateTime.

3. **Temporal anchoring** — if no date modifier and the specified time has already passed today in the source zone, auto-advance to tomorrow (e.g., querying `"3pm NYC"` at 5pm NYC time shows tomorrow's 3pm). Sets `anchoredToTomorrow` flag and a human-readable `anchorNote`.

4. **Convert to target zone** — `sourceDt.setZone(target.iana)`.

5. **Compute metadata:**
   - **Offset difference** — e.g., `+5h`, `-8h 30m`.
   - **Day boundary** — `same day`, `tomorrow`, `yesterday`, or `±N days`.
   - **DST note** — flags when DST is active in either or both locations.
   - **Relative time** — e.g., `"in 3 hours"` (only when within ±24h of now).

6. **Swap** — `swapResult()` flips source/target while preserving all metadata, used by the UI's swap button.

### Output

```ts
{
  source: TimezoneInfo,      // city, country, IANA, formatted times, DST flag, offset
  target: TimezoneInfo,
  offsetDifference: "+5h",
  dayBoundary: "tomorrow",
  dstNote: "DST active in source location" | null,
  relativeTime: "in 3 hours" | null,
  anchoredToTomorrow: boolean,
  anchorNote: string | null,
}
```

## Supporting modules

| File | Role |
|------|------|
| `types.ts` | All shared types (`ParsedQuery`, `ResolvedTimezone`, `ConversionResult`, `ConversionError`) |
| `constants.ts` | TZ abbreviations, connector words, named times (`noon`/`midnight`), date modifier mappings |
| `aliases.ts` | US state → IANA mappings (city aliases mostly migrated to entities) |
| `city-entities.ts` | Curated city registry with slugs, aliases, coordinates, vibes, Wikidata IDs |

## Error handling

Errors are typed as `ConversionError` with a discriminated `type` field:

- `parse` — input couldn't be parsed into any known pattern
- `resolve-source` — source location not found
- `resolve-target` — target location not found
- `conversion` — Luxon failed (invalid timezone, etc.)

The resolver also provides `getSuggestion()` for typo recovery (fuzzy match with a relaxed threshold of 0.5).

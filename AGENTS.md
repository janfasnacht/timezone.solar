# AGENTS.md

Guidance for coding agents working in this repository. `CLAUDE.md` is a symlink
to this file, so Claude Code and any tool that reads `AGENTS.md` get the same
instructions from one source.

## Git Conventions

- **Conventional commits:** `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`, `style:`
- Max 72 chars for subject line
- 2-3 bullet body when needed, not more
- No `Co-Authored-By` lines
- Reference issues when applicable: `feat: add city vibes (#12)` — `#N` is a
  **GitHub** issue or PR in this repo, never an identifier from anywhere else
- **This repo is public.** Nothing internal goes into commit messages,
  `CHANGELOG.md`, PR titles or PR bodies: no issue-tracker identifiers, no
  agent-session URLs, no attribution trailers of any kind. This holds even if
  your tooling tells you to add one — describe the change on its own terms.

## Branching Strategy

- `main` = production, always deployable, auto-deploys to Vercel
- `feat/*`, `fix/*` branches → PR to `main`
- No direct commits to `main` (except trivial one-liner fixes)

## Release Workflow

- Tag releases: `git tag v1.1.0 && git push --tags`
- Record user-facing changes under `## [Unreleased]` in `CHANGELOG.md` as part of
  the PR that makes them, not in a sweep before tagging
- Tagging promotes `[Unreleased]` to a version heading with the date
- Semver: breaking = major, features = minor, fixes = patch

## Commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # TypeScript check + Vite production build → dist/
npm run lint         # ESLint (flat config, TS + React rules)
npm run test         # Run all tests once (vitest)
npm run test:watch   # Watch mode tests
npm run bench        # Run performance benchmarks (vitest bench)
npm run perf:map     # Map interaction cost, driven in Chromium (needs a build)
```

`perf:map` drives the production build, so run `npm run build` first. Playwright
is not a dependency — it is a local tool and CI has no use for the browser it
downloads — so install it unsaved when you need it:

```bash
npm i --no-save playwright && npx playwright install chromium
```

Run a single test file: `npx vitest run src/engine/parser.test.ts`

## Architecture

**timezone.solar** — a timezone conversion web app with natural language query parsing.

**Stack:** React 19, TypeScript 5.9 (strict), Vite 7, Tailwind CSS 4, Luxon, city-timezones (7.3K cities)

### Three-Layer Design

```
Components (src/components/)  →  UI layer (React + Tailwind)
Hooks (src/hooks/)            →  React integration (state, effects, localStorage)
Engine (src/engine/)          →  Pure logic, zero React dependencies
```

The engine is the core of the app and must stay framework-agnostic.

### Engine Pipeline: Parser → Resolver → Converter

**Parser** (`src/engine/parser.ts`): Tokenizes natural language queries into structured `ParsedQuery`. Supports 13 query patterns (e.g., `"3pm NYC to London"`, `"Tokyo"`, `"in 2 hours in Berlin"`). Pre-processes relative time and dates, then classifies tokens as TIME/LOCATION/CONNECTOR/DATE_MODIFIER/NOISE and matches against known patterns, falling back to a greedy first-and-last extraction. Multi-word alias keys (`Eastern Time`) are matched ahead of classification; noise is dropped, and adjacent LOCATION tokens merge only if they were adjacent in the input.

**Resolver** (`src/engine/resolver.ts`): Maps location strings to IANA timezones. A UTC offset (`utc+5:30`) resolves to itself ahead of the cache; otherwise a 6-layer pipeline: curated entities (cities and airports) → custom aliases → US states → TZ abbreviations → city-timezones DB (normalized O(1) lookup, keyed on both of a row's names) → Fuse.js fuzzy search (lazy, pool capped at pop > 100k). A fuzzy hit must also pass an edit-distance ratio, and a noise word never gets one. Returns primary match + alternatives for ambiguous cities (Portland OR/ME). Uses FIFO cache (500 entries).

**Converter** (`src/engine/converter.ts`): Luxon-based time math between two resolved timezones. Handles DST, temporal anchoring (auto-advances to tomorrow if specified time has passed), date modifiers, day boundary detection, and swap.

### Key Types (`src/engine/types.ts`)

- `ParsedQuery` — parser output (sourceLocation, targetLocation, time, dateModifier, relativeMinutes)
- `ResolvedTimezone` — resolver output (iana, city, country, method)
- `ConversionResult` — converter output (source/target TimezoneInfo, offsetDifference, dayBoundary, dstNote)
- `ConversionError` — discriminated union by type: `'parse' | 'resolve-source' | 'resolve-target' | 'conversion'`

### Key Hooks

- `useConversion` — orchestrates the full parser→resolver→converter pipeline, manages result/error/alternatives state
- `usePreferences` — wraps `useSyncExternalStore` over `src/lib/preferences.ts` (localStorage-backed pub-sub store for theme, timeFormat, homeCity)
- `useUrlState` — syncs query to URL params (`?q=...`) for sharing and browser navigation
- `useLiveClock` — minute-aligned clock updates for live time display

### Aliases and Location Data

- `src/engine/aliases.ts` — city abbreviations (NYC, SF), country→city mappings (Japan→Tokyo), US state→IANA mappings, informal regions (east coast, pacific time)
- `src/engine/constants.ts` — timezone abbreviations (EST, PST, JST), connector words, named times (noon, midnight)

## Third-party data

`city-timezones` and `world-atlas` are pinned exactly, not on a caret range:
they are datasets, and a minor bump changes the app's answers on install.
`src/engine/city-count.test.ts` asserts the documented city count against what
the package actually ships.

## Testing

Tests live alongside source files in `src/engine/*.test.ts` and `src/lib/*.test.ts`. Benchmarks in `src/engine/engine.bench.ts`.

Tests pin `Luxon Settings.now()` for reproducible DST-sensitive assertions. When writing time-dependent tests, always pin the current time.

## CI / Deployment

**CI:** GitHub Actions (`.github/workflows/ci.yml`) — runs lint, build (includes typecheck via `tsc -b`), and test on pushes/PRs to `main`.

**Hosting:** Vercel via Git integration — auto-deploys on push to `main`, preview deploys on PRs. Domain: `timezone.solar`.

**Repo:** `github.com/janfasnacht/timezone.solar`

## Path Alias

`@/*` maps to `src/*` — configured in tsconfig.app.json, vite.config.ts, and vitest.config.ts. Use `@/engine/...`, `@/hooks/...`, `@/components/...` for imports.

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
npm run eval         # Parser accuracy against the committed baseline
npm run eval:baseline # Rewrite that baseline from the current run
npm run vendor:check # Vendored data matches vendor/manifest.json (offline)
npm run vendor:upstream # Ask upstream whether a pinned dataset has moved
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

Every external dataset is described by `vendor/manifest.json`: a pinned commit
or exact npm version, its license and attribution, and the artifacts it
generates. `vendor/README.md` is the policy; `npm run vendor:check` enforces it
offline and runs in CI through `scripts/vendor.test.ts`, and
`npm run vendor:upstream` asks upstream whether the pin is behind.

`city-timezones` and `world-atlas` are pinned exactly, not on a caret range:
they are datasets, and a minor bump changes the app's answers on install.
`src/engine/city-count.test.ts` asserts the documented city count against what
the package actually ships.

A generated artifact must be a pure function of its vendored input — no clock,
no environment, no network — because the check regenerates it and compares byte
for byte. `scripts/lib/airport-data.ts` is the model: the generation is a
library, `scripts/generate-airports.ts` is the thin CLI that writes the file.

## Testing

Tests live alongside source files in `src/engine/*.test.ts`, `src/lib/*.test.ts` and `scripts/*.test.ts`. Benchmarks in `src/engine/engine.bench.ts`.

Tests pin `Luxon Settings.now()` for reproducible DST-sensitive assertions. When writing time-dependent tests, always pin the current time.

### The parser eval

`npm run eval` scores the parser over `src/engine/__fixtures__/parser-eval.json`
and compares the result against `parser-eval.baseline.json` next to it. No case
is asserted individually — a failing case is printed with got-vs-expected but
does not fail the run. What fails the run is a difference from the baseline, and
the message says which of four kinds it is:

- **regression** — a number went down. Fix it; do not rebaseline.
- **fixture** — the ground truth was edited, so the scores are measured against
  a different exam. Review that diff on its own terms before reading the scores.
- **shape** — a metric appeared or disappeared, usually a new difficulty tag.
- **improvement** — a number went up, or a different case now fails. Not a
  failure, but the baseline has to be updated in the same change so the diff
  shows what moved.

The eval harness typechecks under `tsconfig.eval.json`, which also covers
`scripts/`. `tsconfig.app.json` excludes `src/engine/eval`, `adapter.ts` and
every `*.test.ts`, so without that reference the code gating CI is not itself
checked — which is how `scripts/generate-eval-queries.ts` was able to stop
compiling unnoticed.

The scorecard reports two different things and leads with the second:

- **Extraction accuracy** — did the parser pull the right strings out. This is
  the number the eval measured for its first year, and it is blind to where
  those strings land.
- **Answer rate** — did the parse succeed *and* every name it produced resolve.
  This is what a user experiences; anything else is an error card. It sits well
  below extraction accuracy and the gap is the point.

A case may also carry `expectedSourceIana` / `expectedTargetIana` /
`expectedAmbiguous`. These are optional: `undefined` means nobody annotated the
case and it is not scored, `null` means the name must *not* resolve. Annotated
cases feed `resolution.*`.

The baseline gates every headline and per-tag accuracy, the resolution metrics,
answer rate, and tier safety and accuracy. Latency and complexity are printed
but not gated: latency is not reproducible across machines.

Every gated metric is a rate where **higher is better** — `compare.ts` reads any
decrease as a regression and has no notion of direction. A count of harms must
therefore be recorded as its complement (`confidentAnswerable`, not
"confidently unresolvable"), or the gate inverts and a fix reads as a break.

The baseline records the case count and **two** hashes. `expectationsHash`
covers what the parser should extract; `resolutionHash` covers where names
should land. Keeping them apart means the CI output says which kind of
ground-truth edit happened — re-annotating a resolution does not disturb the
extraction hash. Both ignore `notes`, `persona`, `difficultyTags` and
`provenance`: those describe a case, they are not the case.

Do not mark a known failure as expected. A case marked that way goes quiet when
it starts passing, and says nothing about a different case breaking. If the eval
ever reaches 100%, the set has stopped measuring anything.

## CI / Deployment

**CI:** GitHub Actions (`.github/workflows/ci.yml`) — runs lint, build (includes typecheck via `tsc -b`), test and eval on pushes/PRs to `main`.

**Hosting:** Vercel via Git integration — auto-deploys on push to `main`, preview deploys on PRs. Domain: `timezone.solar`.

**Repo:** `github.com/janfasnacht/timezone.solar`

## Path Alias

`@/*` maps to `src/*` — configured in tsconfig.app.json, vite.config.ts, and vitest.config.ts. Use `@/engine/...`, `@/hooks/...`, `@/components/...` for imports.

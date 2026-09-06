# Vendored data

Third-party data ships in this repo, so it is a dependency like any other and is
maintained like one. `manifest.json` is the record; everything below is how it is
kept true.

## Policy

Every external dataset — a vendored file, or an npm package whose payload is
data rather than code — has an entry in `manifest.json` carrying:

- **A pin.** A git commit SHA, or an exact npm version. Never a branch, never a
  caret range: a dataset that moves under you changes the app's answers on
  install, and that has to show up as a diff.
- **Source, license and attribution.** Recorded next to the data, not inferred
  from the URL it came from.
- **Its generated artifacts**, and the command that rebuilds them.

Two checks keep the record honest:

```sh
npm run vendor:check       # offline: does the tree match the manifest
npm run vendor:upstream    # network: has upstream moved, and would output differ
```

`vendor:check` runs in CI through `scripts/vendor.test.ts`. It fails when a
vendored file no longer hashes to what the manifest records, when a pinned npm
version drifts, and when a generated artifact does not regenerate byte-for-byte
from the input it names — so a stale artifact is a build failure, not a slow
divergence.

`vendor:upstream` runs weekly from `.github/workflows/vendor-upstream.yml`. It
compares each pin against upstream's current head and opens an issue only when
regenerating would actually change what ships. A commit that leaves the output
identical is not news.

To refresh a dataset: update the file, regenerate, then
`npm run vendor:check -- --write` and set the new commit in `manifest.json`.

## openflights-airports.dat

Source: `jpatokal/openflights`, `data/airports.dat`
Pinned at `e3bc6de` (2019-05-13) — the last commit to touch that path
License: Open Database License (ODbL) v1.0
Attribution: © OpenFlights.org

Generates `src/engine/airport-data.generated.ts` via `npm run airports:generate`.
Generation is a pure function of this file — no clock, no network — which is what
lets the test regenerate and compare.

Columns (no header in the file):

1. Airport ID
2. Name
3. City
4. Country
5. IATA (3-letter, `\N` if absent)
6. ICAO (4-letter, `\N` if absent)
7. Latitude
8. Longitude
9. Altitude (feet)
10. Timezone (UTC offset, decimal hours)
11. DST (E/A/S/O/Z/N/U)
12. Tz database time zone (IANA, `\N` if absent)
13. Type (airport / station / port / heliport / unknown)
14. Source

To refresh:

```sh
curl -fsSL -o vendor/openflights-airports.dat \
  https://raw.githubusercontent.com/jpatokal/openflights/<commit>/data/airports.dat
npm run airports:generate
npm run vendor:check -- --write
```

## npm-sourced data

`city-timezones` and `world-atlas` are pinned to exact versions in
`package.json`. `vendor:check` fails if either grows a range or if the installed
version disagrees with the manifest; `src/engine/city-count.test.ts` separately
guards the city count the docs claim.

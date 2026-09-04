# timezone.solar

Natural language timezone converter — results appear in shareable cards and a pretty live map.

**Live at [timezone.solar](https://timezone.solar)**

## Features

- Natural language queries (`3pm NYC to London`, `tomorrow noon in Tokyo`, `in 2 hours in Berlin`, `14 march 9am Tokyo`)
- 7,300+ cities with fuzzy search and disambiguation, plus 800+ airports by IATA code
- Timezone abbreviations (`EST`, `JST`) and UTC offsets (`utc+5:30`), which light up their band on the map
- Interactive world map: pan and zoom, timezone overlays, city and airport labels that thin out by density
- Live-as-you-type conversion, shareable URLs, and calendar export
- DST-aware with temporal anchoring
- Dark/light theme, responsive down to phones

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173).

## Architecture

```
Components (src/components/)  →  UI layer (React + Tailwind)
Hooks (src/hooks/)            →  React integration (state, effects, localStorage)
Engine (src/engine/)          →  Pure logic, zero React dependencies
```

The engine processes queries through a three-stage pipeline: **Parser** (natural language → structured query) → **Resolver** (location → IANA timezone) → **Converter** (Luxon time math with DST handling).

## Development

```bash
npm run dev          # Vite dev server with HMR
npm run build        # TypeScript check + production build
npm run test         # Run all tests
npm run lint         # ESLint
npm run eval         # Parser accuracy against the query fixture
npm run bench        # Engine benchmarks
```

**Branching:** `feat/*` or `fix/*` → PR to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Luxon, D3 for the map

`city-timezones` and `world-atlas` are pinned to exact versions rather than a
caret range — they are datasets, and a minor bump would change the app's
answers on install.

## License

[MIT](LICENSE)

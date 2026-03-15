# timezone.solar

Natural language timezone converter — results appear in shareable cards and a pretty live map.

**Live at [timezone.solar](https://timezone.solar)**

## Features

- Natural language queries with noise-tolerant parser (`3pm NYC to London`, `tomorrow noon in Tokyo`)
- 86,000+ cities with fuzzy search and disambiguation
- Interactive world map with timezone overlays
- Mobile-responsive with bottom tab navigation
- Live-as-you-type conversion
- DST-aware with temporal anchoring
- Dark/light theme

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
```

**Branching:** `feat/*` or `fix/*` → PR to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Luxon

## License

[MIT](LICENSE)

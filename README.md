# timezone.solar

Natural language timezone converter. Type queries like `3pm NYC to London` or `tomorrow noon in Tokyo` and get instant results.

**Live at [timezone.solar](https://timezone.solar)**

## Features

- Natural language queries with 13 supported patterns
- 86,000+ cities with fuzzy search and disambiguation
- DST-aware conversions with temporal anchoring
- Dark/light theme with system preference detection
- Keyboard-first: Cmd+/, arrow history, instant focus

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

The engine processes queries through a three-stage pipeline:

1. **Parser** — tokenizes natural language into structured queries
2. **Resolver** — maps locations to IANA timezones (aliases, city DB, fuzzy search)
3. **Converter** — Luxon-based time math with DST and day boundary handling

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

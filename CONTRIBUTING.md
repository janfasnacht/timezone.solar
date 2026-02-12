# Contributing

Thanks for your interest in contributing to timezone.solar!

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run checks: `npm run lint && npm run test`
5. Commit with [conventional commits](https://www.conventionalcommits.org/): `feat: add city vibes`
6. Push and open a PR to `main`

## Commit Format

Use conventional commit prefixes:

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring (no behavior change)
- `test:` — adding or updating tests
- `chore:` — tooling, dependencies, config
- `docs:` — documentation changes
- `style:` — formatting, whitespace

Keep subject lines under 72 characters.

## Code Style

- Follow existing patterns in the codebase
- TypeScript strict mode — no `any` types
- Engine code (`src/engine/`) must have zero React dependencies
- Tests live alongside source files (`*.test.ts`)

## Before Large Changes

Open an issue first to discuss the approach. This avoids wasted effort if the direction doesn't align with the project.

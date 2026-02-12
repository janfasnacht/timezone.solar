# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-12

### Added

- CityEntity data model with 81 curated city entries for enhanced display
- Project infrastructure: LICENSE, README, CONTRIBUTING, conventional commits
- Git conventions and branching strategy documented in CLAUDE.md

### Changed

- Renamed repo from `timezone` to `timezone.solar`
- Moved internal dev notes to gitignored `dev/` directory
- Updated package.json with proper metadata (author, license, repository)

## [1.0.0] - 2026-02-12

### Added

- Natural language timezone conversion with 13 query patterns
- 5-layer location resolver (aliases, US states, TZ abbreviations, city DB, fuzzy search)
- DST-aware time conversion with temporal anchoring
- Live clock display (minute-aligned updates)
- Dark/light theme with system preference detection
- Keyboard shortcuts (Cmd+/, Escape, arrow history)
- URL state sync for sharing and browser navigation
- Recent query history
- City disambiguation for ambiguous names (Portland OR/ME)
- Relative time expressions ("in 2 hours", "in 30 minutes")
- Date modifiers (tomorrow, yesterday)

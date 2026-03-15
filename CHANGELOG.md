# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-03-10

### Added

- Interactive world map with timezone overlays, city dots, and layers panel
- Sidebar navigation with settings (theme, time format, home city)
- Mobile-responsive layout with bottom tab bar and touch gestures
- Map pan/zoom on mobile with density controls
- Canonical URLs for shareable timezone conversions
- SEO foundations with dynamic page titles
### Changed

- Replaced settings dog-ear with sidebar + /about route
- Redesigned card back with compact conversion summary

### Fixed

- Mobile touch targets and spacing
- Share URL canonicalization for "now" queries

## [1.2.0] - 2026-02-15

### Added

- v2 parser with confidence scoring, noise tolerance, and day-of-week resolution
- Sharing features — OG images, download, copy, mobile share
- Flippable result card with city icons and vibes
- Live-as-you-type conversion with debounce
- Orange dot favicon

### Changed

- Replaced modals with page-level dog-ear flip pattern
- Removed v1 parser, flattened v2 to top-level

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

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Zoom and pan the map with a mouse: wheel and trackpad pinch anchored on the
  pointer, drag to pan, double-click to zoom in, and a zoom control that reads
  the current level
- City and airport names on the map, thinned by zoom and by how crowded the view
  is, and spread across regions rather than clustered where the population is

### Changed

- Cities, airports and labels each get their own None / Few / Auto / All scale in
  the layers menu. Airports no longer ride along with the city density, and each
  scale responds to zoom: the resting view names only well-known places, and at
  full zoom Auto shows everything in view
- Every mark on the map holds one size on screen as you zoom — dots, the arc and
  its offset, coastlines, borders, and the timezone tooltip
- Hovering the source or target no longer enlarges its dot; the card it opens
  already says which one it is
- Tooltips only name controls that are not already named. The view switcher, the
  zoom stepper and the zoom read-out at rest have lost theirs
- The settings and map layers menus now share one set of controls: the same rows,
  the same segmented choices and the same switches, sized and worded alike. The
  home-city field is a shade lighter and no longer reads as a hole in the panel

### Fixed

- Escape closed a popover and cleared the query with it. A menu that closes on
  Escape now spends the key press
- Hover states in dark mode did nothing: the muted colour was identical to the
  surface it sat on, so the city suggestions, the view switcher and the recent
  searches all highlighted invisibly
- Hover cards were positioned against the wrong viewBox, so they drifted further
  from their dot the more you zoomed and flickered on far-northern cities. They
  now track their dot while you pan and zoom, and flip below it early enough to
  stay clear of the search bar
- The map could not be panned on touch, and did not fill the screen
- Tooltips no longer appear on touch devices, where they had no way to dismiss
- The search box sat too high on the landing screen on phones

## [1.4.0] - 2026-09-01

### Added

- Absolute dates in queries — `14 march`, `march 14`, ISO, and `14/03` read in
  the browser's own date-part order
- Share as a third view alongside Card and Map, with calendar export
- Landing examples now teach the query language: nine shapes including dates,
  relative times, abbreviations and bare `A to B`, drawn mostly from a curated
  list of recognisable cities and airports

### Changed

- Chrome rebuilt on one vocabulary: a single popover surface, a single tooltip,
  and one view switcher at the bottom centre on every screen size
- Settings moved from the desktop sidebar into a quiet top-right cluster that
  states where you are and what time it is there
- Landing is its own screen rather than the card view rendered empty
- The time control edits the query rather than holding separate state, so the
  search bar and URL always describe what is shown
- About rebuilt to a single screen and linked as Usage

### Fixed

- `5 pm` (with a space) parsed as 5 AM
- Cities whose names carry diacritics lost their map pin, label and arc — the
  resolver answers `Zürich` where the curated entity is `Zurich`
- Asking about the city you are already in blanked the map entirely
- The compact logo reserved invisible width in the header row

### Removed

- Desktop sidebar, mobile tab bar, and the flippable result card

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

_Never tagged; recorded here for continuity._

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

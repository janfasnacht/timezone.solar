import { getEntityBySlug } from './city-entities'

export interface LandingRoute {
  fromSlug: string
  toSlug: string
}

/**
 * Parse a landing page path like "/new-york-to-london" into from/to slugs.
 * Returns null for non-matching paths.
 *
 * Since city slugs contain hyphens, we try all possible "-to-" split positions
 * and validate both halves against city entities.
 */
export function parseLandingPath(pathname: string): LandingRoute | null {
  // Normalize: strip trailing slash, lowercase
  const path = pathname.replace(/\/+$/, '').toLowerCase()

  // Must be a single top-level segment (e.g. /new-york-to-london)
  // Skip known routes and paths with multiple segments
  if (!path || path === '/') return null

  const segment = path.startsWith('/') ? path.slice(1) : path

  // Skip paths with slashes (nested routes like /api/..., /assets/...)
  if (segment.includes('/')) return null

  // Skip known non-landing routes
  if (segment === 'about' || segment === 'map') return null

  // Find all "-to-" positions and try each split
  const separator = '-to-'
  let searchFrom = 0

  while (true) {
    const idx = segment.indexOf(separator, searchFrom)
    if (idx === -1) break

    const fromSlug = segment.slice(0, idx)
    const toSlug = segment.slice(idx + separator.length)

    if (fromSlug && toSlug && getEntityBySlug(fromSlug) && getEntityBySlug(toSlug)) {
      return { fromSlug, toSlug }
    }

    searchFrom = idx + 1
  }

  return null
}

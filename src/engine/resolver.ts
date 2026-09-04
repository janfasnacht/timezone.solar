import cityTimezones from 'city-timezones'
import Fuse from 'fuse.js'
import type { LocationRef, LocationKind, ResolveResult } from './types'
import { CITY_ALIASES, US_STATE_TIMEZONES } from './aliases'
import { TZ_ABBREVIATIONS, TZ_ABBREVIATION_LABELS } from './constants'
import { lookupEntity } from './entities'
import { NOISE_WORDS } from './noise-words'

interface CityEntry {
  city: string
  city_ascii: string
  lat: number
  lng: number
  pop: number
  country: string
  iso2: string
  iso3: string
  province: string
  timezone: string
}

// --- Normalization ---

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .replace(/[^a-z0-9 ]/g, '')      // strip non-alphanumeric (keep spaces)
    .trim()
}

// --- Pre-computed normalized city map ---

const allCities = cityTimezones.cityMapping as unknown as CityEntry[]

// Indexed under both of a row's names. 115 of them differ — Kashgar is filed
// under "Kashi", Bensonville under "Bentol" — and on `city_ascii` alone the
// other spelling is reachable only by a fuzzy guess.
const normalizedCityMap = new Map<string, CityEntry[]>()
for (const entry of allCities) {
  for (const key of new Set([normalize(entry.city_ascii), normalize(entry.city)])) {
    if (!key) continue
    const existing = normalizedCityMap.get(key)
    if (existing) existing.push(entry)
    else normalizedCityMap.set(key, [entry])
  }
}
// Sort each bucket by population descending
for (const entries of normalizedCityMap.values()) {
  entries.sort((a, b) => b.pop - a.pop)
}

// --- Lazy Fuse.js ---

let fuseInstance: Fuse<CityEntry> | null = null

function getFuse(): Fuse<CityEntry> {
  if (!fuseInstance) {
    const largeCities = allCities.filter((c) => c.pop > 100000)
    fuseInstance = new Fuse(largeCities, {
      keys: ['city', 'city_ascii'],
      threshold: 0.3,
      includeScore: true,
    })
  }
  return fuseInstance
}

/**
 * Damerau-Levenshtein: an adjacent swap counts as one edit, because a typed
 * transposition is one slip.
 */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array<number>(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[m][n]
}

/**
 * The most of an input that may differ from the name it fuzzy-matches.
 *
 * Fuse's own score does not separate a typo from a coincidence — `nyw york` for
 * New York scores worse than `Meroe` for Kemerovo. Distance relative to what was
 * typed does: real typos land under a fifth, `Meroe` lands at four fifths. Past
 * this the match is offered as a suggestion rather than given as an answer.
 */
const FUZZY_MAX_EDIT_RATIO = 0.3

// --- Cache ---

const CACHE_MAX = 500
const resolveCache = new Map<string, ResolveResult | null>()

function cacheGet(key: string): ResolveResult | null | undefined {
  return resolveCache.get(key)
}

function cacheSet(key: string, value: ResolveResult | null): void {
  if (resolveCache.size >= CACHE_MAX) {
    // FIFO eviction: delete the first key
    const firstKey = resolveCache.keys().next().value
    if (firstKey !== undefined) {
      resolveCache.delete(firstKey)
    }
  }
  resolveCache.set(key, value)
}

// --- Helpers ---

function normalizeCountry(country: string): string {
  if (country === 'United States of America' || country === 'United States') return 'USA'
  return country
}

function cityEntryToLocationRef(entry: CityEntry, resolveMethod: LocationRef['resolveMethod'], kind: LocationKind = 'city'): LocationRef {
  return {
    iana: entry.timezone,
    displayName: entry.city,
    kind,
    country: normalizeCountry(entry.country),
    resolveMethod,
  }
}

function cityEntriesToResolveResult(entries: CityEntry[], resolveMethod: LocationRef['resolveMethod'], kind: LocationKind = 'city'): ResolveResult {
  return {
    primary: cityEntryToLocationRef(entries[0], resolveMethod, kind),
    alternatives: entries.slice(1).map((e) => cityEntryToLocationRef(e, resolveMethod, kind)),
  }
}

// --- UTC offsets ---

/** `utc-2`, `UTC+5:30`, `gmt+0530`, and the same with a space before the sign. */
const UTC_OFFSET_RE = /^(?:utc|gmt)([+-])(\d{1,2})(?::?([0-5]\d))?$/

/**
 * An offset names a zone outright, so it resolves to itself. Luxon reads
 * `UTC±H[:MM]` as a fixed-offset zone, which makes the canonical spelling
 * usable as the `iana` field — there is no Etc/GMT name for the half-hour and
 * quarter-hour offsets, and the Etc ones invert the sign.
 */
export function parseUtcOffset(input: string): LocationRef | null {
  const match = input.toLowerCase().replace(/\s+/g, '').match(UTC_OFFSET_RE)
  if (!match) return null

  const [, sign, hourText, minuteText] = match
  const hours = Number(hourText)
  const minutes = minuteText ? Number(minuteText) : 0
  // The real ones run from -12 to +14. Past that it is a typo, not a zone.
  const limit = sign === '-' ? 12 : 14
  if (hours > limit || (hours === limit && minutes > 0)) return null

  const label = `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`
  return { iana: label, displayName: label, kind: 'timezone', resolveMethod: 'utc-offset' }
}

// --- Main resolver ---

export function resolveLocation(input: string): ResolveResult | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Ahead of the cache, because `normalize` strips the sign and the colon:
  // `utc+5:30` and `utc-5:30` would otherwise share a key.
  const offset = parseUtcOffset(trimmed)
  if (offset) return { primary: offset, alternatives: [] }

  const normalized = trimmed.toLowerCase()
  const normalizedKey = normalize(trimmed)

  // Check cache
  const cached = cacheGet(normalizedKey)
  if (cached !== undefined) return cached

  const result = resolveLocationUncached(normalized, normalizedKey, trimmed)
  cacheSet(normalizedKey, result)
  return result
}

function resolveLocationUncached(
  normalized: string,
  normalizedKey: string,
  originalTrimmed: string,
): ResolveResult | null {
  // Layer 0: Entity lookup (curated cities and airports with stable identity).
  // For airports, displayName stays bare (e.g. "JFK"). The "JFK · New York"
  // composite is built at display time in `formatEntityLabel` so the raw IATA
  // remains round-trippable through the map's name-based lookups.
  const entity = lookupEntity(originalTrimmed)
  if (entity) {
    if (entity.kind === 'airport') {
      return {
        primary: {
          iana: entity.iana,
          displayName: entity.displayName,
          kind: 'city',
          country: entity.country,
          resolveMethod: 'entity',
          entitySlug: entity.slug,
        },
        alternatives: [],
      }
    }
    const entityCityKey = normalize(entity.displayName)
    const entries = normalizedCityMap.get(entityCityKey)
    if (entries && entries.length > 0) {
      const result = cityEntriesToResolveResult(entries, 'entity')
      result.primary.entitySlug = entity.slug
      return result
    }
    // Fallback: use entity data directly if not in city-db
    return {
      primary: {
        iana: entity.iana,
        displayName: entity.displayName,
        kind: 'city',
        country: entity.country,
        resolveMethod: 'entity',
        entitySlug: entity.slug,
      },
      alternatives: [],
    }
  }

  // Layer 1: Custom aliases → resolve via normalized map
  const alias = CITY_ALIASES[normalized]
  if (alias) {
    const aliasKey = normalize(alias)
    const entries = normalizedCityMap.get(aliasKey)
    if (entries && entries.length > 0) {
      return cityEntriesToResolveResult(entries, 'alias')
    }
  }

  // Layer 2: US states / regions
  const stateIana = US_STATE_TIMEZONES[normalized]
  if (stateIana) {
    return {
      primary: { iana: stateIana, displayName: originalTrimmed, kind: 'region', country: 'USA', resolveMethod: 'state' },
      alternatives: [],
    }
  }

  // Layer 3: Timezone abbreviations + interpretedAs
  const tzAbbr = TZ_ABBREVIATIONS[normalized]
  if (tzAbbr) {
    const label = TZ_ABBREVIATION_LABELS[normalized]
    return {
      primary: {
        iana: tzAbbr,
        displayName: normalized.toUpperCase(),
        kind: 'timezone',
        resolveMethod: 'abbreviation',
        interpretedAs: label,
      },
      alternatives: [],
    }
  }

  // Layer 4: Normalized city map — O(1) lookup with disambiguation
  const cityEntries = normalizedCityMap.get(normalizedKey)
  if (cityEntries && cityEntries.length > 0) {
    return cityEntriesToResolveResult(cityEntries, 'city-db')
  }

  // Layer 5: Lazy Fuse.js fuzzy search. A noise word never gets a guess: one
  // edit is a typo on a long name and a different word on a short one, and no
  // distance rule tells `hello`/Bello from `Tokio`/Tokyo.
  if (NOISE_WORDS.has(normalized)) return null

  const fuse = getFuse()
  const fuzzyResults = fuse.search(normalized)
  if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined && fuzzyResults[0].score < 0.3) {
    const match = fuzzyResults[0].item
    // Against both keys Fuse searched: a row's two names can be unrelated —
    // Kashgar is filed under `city_ascii` "Kashi", Tucumán under "San Miguel
    // de Tucuman" — and the match is only as far as the nearer of them.
    const distance = Math.min(
      editDistance(normalizedKey, normalize(match.city)),
      editDistance(normalizedKey, normalize(match.city_ascii))
    )
    if (distance <= normalizedKey.length * FUZZY_MAX_EDIT_RATIO) {
      return {
        primary: cityEntryToLocationRef(match, 'fuzzy'),
        alternatives: [],
      }
    }
  }

  return null
}

/** Get fuzzy suggestion for a failed lookup */
export function getSuggestion(input: string): string | null {
  const fuse = getFuse()
  const results = fuse.search(input.trim().toLowerCase())
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.5) {
    return results[0].item.city
  }
  return null
}

/** Search cities for autocomplete — returns up to `limit` matches with city, country, and IANA timezone */
export function searchCities(input: string, limit = 6): { city: string; country: string; iana: string }[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  const normalizedKey = normalize(trimmed)
  const results: { city: string; country: string; iana: string }[] = []
  const seen = new Set<string>()

  // Check entity lookup first
  const entity = lookupEntity(trimmed)
  if (entity) {
    const entries = normalizedCityMap.get(normalize(entity.displayName))
    if (entries) {
      for (const e of entries) {
        const key = `${e.city}|${e.timezone}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({ city: e.city, country: e.country, iana: e.timezone })
        }
        if (results.length >= limit) return results
      }
    }
  }

  // Check aliases (legacy fallback)
  const alias = CITY_ALIASES[trimmed.toLowerCase()]
  if (alias) {
    const entries = normalizedCityMap.get(normalize(alias))
    if (entries) {
      for (const e of entries) {
        const key = `${e.city}|${e.timezone}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({ city: e.city, country: e.country, iana: e.timezone })
        }
        if (results.length >= limit) return results
      }
    }
  }

  // Exact normalized match
  const exact = normalizedCityMap.get(normalizedKey)
  if (exact) {
    for (const e of exact) {
      const key = `${e.city}|${e.timezone}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({ city: e.city, country: e.country, iana: e.timezone })
      }
      if (results.length >= limit) return results
    }
  }

  // Prefix scan over normalized map
  for (const [key, entries] of normalizedCityMap) {
    if (key.startsWith(normalizedKey) && key !== normalizedKey) {
      for (const e of entries) {
        const k = `${e.city}|${e.timezone}`
        if (!seen.has(k)) {
          seen.add(k)
          results.push({ city: e.city, country: e.country, iana: e.timezone })
        }
        if (results.length >= limit) return results
      }
    }
  }

  // Fuzzy fallback
  if (results.length < limit) {
    const fuse = getFuse()
    const fuzzy = fuse.search(trimmed.toLowerCase(), { limit: limit - results.length })
    for (const r of fuzzy) {
      const e = r.item
      const k = `${e.city}|${e.timezone}`
      if (!seen.has(k)) {
        seen.add(k)
        results.push({ city: e.city, country: e.country, iana: e.timezone })
      }
    }
  }

  return results
}

import cityTimezones from 'city-timezones'
import Fuse from 'fuse.js'
import type { ResolvedTimezone, ResolveResult } from './types'
import { CITY_ALIASES, US_STATE_TIMEZONES } from './aliases'
import { TZ_ABBREVIATIONS, TZ_ABBREVIATION_LABELS } from './constants'
import { lookupEntity } from './city-entities'

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

const normalizedCityMap = new Map<string, CityEntry[]>()
for (const entry of allCities) {
  const key = normalize(entry.city_ascii)
  if (!key) continue
  const existing = normalizedCityMap.get(key)
  if (existing) {
    existing.push(entry)
  } else {
    normalizedCityMap.set(key, [entry])
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

function cityEntryToResolved(entry: CityEntry, method: ResolvedTimezone['method']): ResolvedTimezone {
  return {
    iana: entry.timezone,
    city: entry.city,
    country: normalizeCountry(entry.country),
    method,
  }
}

function cityEntriesToResolveResult(entries: CityEntry[], method: ResolvedTimezone['method']): ResolveResult {
  return {
    primary: cityEntryToResolved(entries[0], method),
    alternatives: entries.slice(1).map((e) => cityEntryToResolved(e, method)),
  }
}

// --- Main resolver ---

export function resolveLocation(input: string): ResolveResult | null {
  const trimmed = input.trim()
  if (!trimmed) return null

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
  // Layer 0: Entity lookup (curated cities with stable identity)
  const entity = lookupEntity(originalTrimmed)
  if (entity) {
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
        city: entity.displayName,
        country: entity.country,
        method: 'entity',
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
      primary: { iana: stateIana, city: originalTrimmed, country: 'USA', method: 'state' },
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
        city: normalized.toUpperCase(),
        method: 'abbreviation',
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

  // Layer 5: Lazy Fuse.js fuzzy search
  const fuse = getFuse()
  const fuzzyResults = fuse.search(normalized)
  if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined && fuzzyResults[0].score < 0.3) {
    const match = fuzzyResults[0].item
    return {
      primary: cityEntryToResolved(match, 'fuzzy'),
      alternatives: [],
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

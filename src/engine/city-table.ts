/**
 * The city table and its name index. Format is written by
 * `scripts/lib/city-table.ts`: lookup tables for timezone, country and
 * province, then one tab-separated row per city.
 *
 * The head is bundled, the tail is its own chunk. Before the tail arrives a
 * small city does not resolve — it never resolves wrongly. Cache a derivation
 * of this table against `getCityTableVersion`, not against a listener.
 */

import { CITY_HEAD } from './city-data.generated'
import { normalize } from './normalize'

export interface CityRow {
  city: string
  cityAscii: string
  country: string
  /** `''` where the dataset ships `-99`. */
  iso2: string
  iso3: string
  province: string
  timezone: string
  lat: number
  lng: number
  /** To the nearest thousand. */
  pop: number
}

const POP_UNIT = 1000
const COORD_SCALE = 100

function decode(blob: string): CityRow[] {
  const lines = blob.split('\n')
  const zones = lines[0].split('\t')
  const countries = lines[1].split('\t').map((c) => c.split('|'))
  const provinces = lines[2].split('\t')

  const rows: CityRow[] = new Array(lines.length - 3)
  for (let i = 3; i < lines.length; i++) {
    const f = lines[i].split('\t')
    const [country, iso2, iso3] = countries[parseInt(f[2], 36)]
    rows[i - 3] = {
      city: f[0],
      cityAscii: f[1] || f[0],
      country,
      iso2,
      iso3,
      province: provinces[parseInt(f[3], 36)],
      timezone: zones[parseInt(f[4], 36)],
      lat: (parseInt(f[5], 36) - 90 * COORD_SCALE) / COORD_SCALE,
      lng: (parseInt(f[6], 36) - 180 * COORD_SCALE) / COORD_SCALE,
      pop: f[7] ? parseInt(f[7], 36) * POP_UNIT : 0,
    }
  }
  return rows
}

let head: CityRow[] | null = null

/** Everyone at 100,000 people or more, bundled. Also the fuzzy pool. */
export function getHeadCities(): readonly CityRow[] {
  if (!head) head = decode(CITY_HEAD)
  return head
}

/** The head, plus the tail once it has arrived. */
export function getAllCities(): readonly CityRow[] {
  return tail ? getHeadCities().concat(tail) : getHeadCities()
}

// --- The deferred tail ---

let tail: CityRow[] | null = null
let pending: Promise<void> | null = null
const listeners = new Set<() => void>()

export function isCityTailLoaded(): boolean {
  return tail !== null
}

let version = 0

/** Bumped when the table grows; listener order makes this the safe check. */
export function getCityTableVersion(): number {
  return version
}

/** Idempotent; a second caller joins the first one's request. */
export function loadCityTail(): Promise<void> {
  if (tail) return Promise.resolve()
  if (!pending) {
    pending = import('./city-data-tail.generated').then((module) => {
      tail = decode(module.CITY_TAIL)
      byName = null
      qualifiers = null
      version++
      for (const listener of listeners) listener()
    })
  }
  return pending
}

/** Notifies once, when the tail lands. */
export function subscribeCityTail(listener: () => void): () => void {
  if (tail) return () => {}
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// --- Name index ---

let byName: Map<string, CityRow[]> | null = null

/**
 * Indexed under both of a row's names — 103 differ, and on the ascii spelling
 * alone the other is reachable only by a fuzzy guess. Buckets are ordered by
 * population.
 */
export function lookupCities(normalizedKey: string): CityRow[] | undefined {
  if (!byName) {
    byName = new Map()
    for (const row of getAllCities()) {
      for (const key of new Set([normalize(row.cityAscii), normalize(row.city)])) {
        if (!key) continue
        const existing = byName.get(key)
        if (existing) existing.push(row)
        else byName.set(key, [row])
      }
    }
    for (const rows of byName.values()) rows.sort((a, b) => b.pop - a.pop)
  }
  return byName.get(normalizedKey)
}

/** The index itself, for the prefix scan autocomplete does. */
export function getNameIndex(): ReadonlyMap<string, CityRow[]> {
  lookupCities('')
  return byName!
}

// --- Qualifier vocabulary ---

let qualifiers: Set<string> | null = null

/** Every country, ISO code and province the dataset ships. */
export function getQualifierVocabulary(): ReadonlySet<string> {
  if (!qualifiers) {
    qualifiers = new Set<string>()
    for (const row of getAllCities()) {
      qualifiers.add(normalize(row.country))
      if (row.iso2) qualifiers.add(row.iso2.toLowerCase())
      if (row.iso3) qualifiers.add(row.iso3.toLowerCase())
      if (row.province) qualifiers.add(normalize(row.province))
    }
    qualifiers.delete('')
  }
  return qualifiers
}

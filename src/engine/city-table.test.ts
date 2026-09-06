import { describe, it, expect, vi } from 'vitest'
import cityTimezones from 'city-timezones'
import {
  getAllCities,
  getHeadCities,
  getQualifierVocabulary,
  getCityTableVersion,
  isCityTailLoaded,
  lookupCities,
  subscribeCityTail,
  type CityRow,
} from './city-table'

/**
 * The decode must be lossless to the precision the encoding claims: population
 * in thousands, coordinates in hundredths of a degree.
 */

interface RawRow {
  city: string
  city_ascii: string
  lat: number
  lng: number
  pop: number
  country: string
  iso2: string | number
  iso3: string
  province: string
  timezone: string
}

const source = (cityTimezones.cityMapping as unknown as RawRow[]).filter(
  (r) => typeof r.timezone === 'string' && r.timezone.length > 0,
)

/** The row as it must read back, with the encoding's documented rounding applied. */
function expected(raw: RawRow): string {
  return [
    raw.city,
    raw.city_ascii,
    raw.country,
    typeof raw.iso2 === 'string' ? raw.iso2 : '',
    raw.iso3,
    raw.province,
    raw.timezone,
    Math.round(raw.lat * 100) / 100,
    Math.round(raw.lng * 100) / 100,
    raw.pop ? Math.round(raw.pop / 1000) * 1000 : 0,
  ].join('|')
}

function actual(row: CityRow): string {
  return [
    row.city,
    row.cityAscii,
    row.country,
    row.iso2,
    row.iso3,
    row.province,
    row.timezone,
    row.lat,
    row.lng,
    row.pop,
  ].join('|')
}

describe('decoded city table', () => {
  const decoded = getAllCities()

  it('carries every row that has a timezone', () => {
    expect(decoded.length).toBe(source.length)
  })

  it('drops the rows with no timezone', () => {
    const total = (cityTimezones.cityMapping as unknown[]).length
    expect(decoded.length).toBeLessThan(total)
    expect(decoded.every((r) => r.timezone.length > 0)).toBe(true)
  })

  it('round-trips every field, to the precision the encoding claims', () => {
    // Multisets: the split reorders rows and some repeat identically, so there
    // is no key to pair them on.
    expect(decoded.map(actual).sort()).toEqual(source.map(expected).sort())
  })
})

describe('the head/tail split', () => {
  it('bundles every city of 100,000 people or more, and only those', () => {
    expect(isCityTailLoaded()).toBe(true)
    expect(getCityTableVersion()).toBeGreaterThan(0)
    const head = getHeadCities()
    expect(head.every((r) => r.pop >= 100_000)).toBe(true)
    expect(getAllCities().length).toBeGreaterThan(head.length)
    const inHead = new Set(head)
    expect(getAllCities().filter((r) => !inHead.has(r)).every((r) => r.pop < 100_000)).toBe(true)
  })

  it('answers a small city only once the tail is in, and never caches the miss', async () => {
    // Fresh registry: the suite's setup has already loaded the tail.
    // Chaghcharan has 15,000 people, so it is not in the head.
    vi.resetModules()
    const { resolveLocation } = await import('./resolver')
    const { loadCityTail } = await import('./city-table')

    expect(resolveLocation('Chaghcharan')).toBeNull()
    await loadCityTail()
    expect(resolveLocation('Chaghcharan')?.primary.iana).toBe('Asia/Kabul')
  })

  it('bumps the version when the table grows, so derived caches self-invalidate', async () => {
    vi.resetModules()
    const table = await import('./city-table')
    const before = table.getCityTableVersion()
    await table.loadCityTail()
    expect(table.getCityTableVersion()).toBeGreaterThan(before)
    // A second load must not move it and force a needless rebuild.
    await table.loadCityTail()
    expect(table.getCityTableVersion()).toBe(before + 1)
  })

  it('stops subscribing once the tail is in, since it cannot change again', () => {
    let fired = false
    const unsubscribe = subscribeCityTail(() => {
      fired = true
    })
    unsubscribe()
    expect(fired).toBe(false)
  })
})

describe('name index', () => {
  it('finds a city under both of its spellings', () => {
    // Kashgar is filed under city_ascii "Kashi".
    expect(lookupCities('kashgar')?.[0].city).toBe('Kashgar')
    expect(lookupCities('kashi')?.[0].city).toBe('Kashgar')
  })

  it('orders a shared name by population', () => {
    const portlands = lookupCities('portland')!
    expect(portlands.length).toBeGreaterThan(1)
    for (let i = 1; i < portlands.length; i++) {
      expect(portlands[i - 1].pop).toBeGreaterThanOrEqual(portlands[i].pop)
    }
    expect(portlands[0].timezone).toBe('America/Los_Angeles')
  })

  it('has no key for a name written in a non-Latin script', () => {
    expect(lookupCities('')).toBeUndefined()
  })
})

describe('qualifier vocabulary', () => {
  it('holds countries, ISO codes and provinces, and no empty string', () => {
    const vocab = getQualifierVocabulary()
    expect(vocab.has('japan')).toBe(true)
    expect(vocab.has('jp')).toBe(true)
    expect(vocab.has('jpn')).toBe(true)
    expect(vocab.has('maine')).toBe(true)
    expect(vocab.has('')).toBe(false)
  })
})

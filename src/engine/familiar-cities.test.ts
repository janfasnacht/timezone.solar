import { describe, it, expect } from 'vitest'
import { FAMILIAR_AIRPORT_IATA, FAMILIAR_CITY_SLUGS, FAMILIAR_SHARE } from '@/engine/familiar-cities'
import { getAllEntities, type CityEntity } from '@/engine/entities'

/**
 * The familiar list is hand-curated, so it can rot when the registry changes.
 * These are the invariants that keep a stale slug from silently shrinking the
 * placeholder pool instead of failing loudly.
 */
describe('familiar city list', () => {
  const cities = new Map(
    getAllEntities()
      .filter((e): e is CityEntity => e.kind === 'city')
      .map((c) => [c.slug, c]),
  )

  it('every slug exists in the entity registry', () => {
    const missing = [...FAMILIAR_CITY_SLUGS].filter((s) => !cities.has(s))
    expect(missing).toEqual([])
  })

  it('every slug has vibes, since examples draw feeling words from them', () => {
    const withoutVibes = [...FAMILIAR_CITY_SLUGS].filter((s) => !cities.get(s)?.vibes?.length)
    expect(withoutVibes).toEqual([])
  })

  it('covers every inhabited continent, so examples are not US-and-Europe only', () => {
    const regions = new Set(
      [...FAMILIAR_CITY_SLUGS].map((s) => cities.get(s)!.iana.split('/')[0]),
    )
    for (const r of ['America', 'Europe', 'Asia', 'Africa', 'Australia', 'Pacific']) {
      expect(regions.has(r), `no familiar city in ${r}`).toBe(true)
    }
  })

  it('leaves room for the long tail', () => {
    expect(FAMILIAR_SHARE).toBeGreaterThan(0.5)
    expect(FAMILIAR_SHARE).toBeLessThan(1)
  })
})

describe('familiar airport list', () => {
  const iatas = new Set(
    getAllEntities().filter((e) => e.kind === 'airport').map((e) => e.iata),
  )

  it('every code exists in the airport registry', () => {
    const missing = [...FAMILIAR_AIRPORT_IATA].filter((c) => !iatas.has(c))
    expect(missing).toEqual([])
  })

  it('every code has a parent city, since examples need its vibes', () => {
    const byIata = new Map(
      getAllEntities().filter((e) => e.kind === 'airport').map((e) => [e.iata, e]),
    )
    const orphans = [...FAMILIAR_AIRPORT_IATA].filter((c) => !byIata.get(c)?.parentCitySlug)
    expect(orphans).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { getRankedMapEntities, selectSpaced, MINOR_RANK, type Box } from '@/engine/map-density'
import { FAMILIAR_CITY_SLUGS } from '@/engine/familiar-cities'
import { ANCHOR_CITY_SLUGS, MAP_CITY_SLUGS } from '@/engine/map-entities'

interface Pt {
  id: string
  x: number
  y: number
}

const boxes = (size: number) => (p: Pt): Box => ({ x: p.x - size / 2, y: p.y - size / 2, w: size, h: size })

describe('selectSpaced', () => {
  it('keeps the first of two candidates whose boxes overlap', () => {
    const pts: Pt[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 5, y: 0 },
    ]
    const kept = selectSpaced(pts, { boxFor: boxes(10), limit: 10 })
    expect(kept.map((p) => p.id)).toEqual(['a'])
  })

  it('keeps both once they clear each other', () => {
    const pts: Pt[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 11, y: 0 },
    ]
    const kept = selectSpaced(pts, { boxFor: boxes(10), limit: 10 })
    expect(kept.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('drops candidates whose box is null, without letting them block anything', () => {
    const pts: Pt[] = [
      { id: 'hidden', x: 0, y: 0 },
      { id: 'visible', x: 0, y: 0 },
    ]
    const kept = selectSpaced(pts, {
      boxFor: (p) => (p.id === 'hidden' ? null : boxes(10)(p)),
      limit: 10,
    })
    expect(kept.map((p) => p.id)).toEqual(['visible'])
  })

  it('respects boxes claimed by an earlier pass', () => {
    const pts: Pt[] = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 40, y: 0 }]
    const kept = selectSpaced(pts, {
      boxFor: boxes(10),
      limit: 10,
      seed: [{ x: -5, y: -5, w: 10, h: 10 }],
    })
    expect(kept.map((p) => p.id)).toEqual(['b'])
  })

  it('stops at the limit', () => {
    const pts: Pt[] = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, x: i * 20, y: 0 }))
    expect(selectSpaced(pts, { boxFor: boxes(10), limit: 7 })).toHaveLength(7)
  })

  it('returns nothing for a non-positive limit', () => {
    expect(selectSpaced([{ id: 'a', x: 0, y: 0 }], { boxFor: boxes(10), limit: 0 })).toEqual([])
  })

  it('accepts everything when the boxes have no extent', () => {
    const pts: Pt[] = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, x: 3, y: 4 }))
    expect(selectSpaced(pts, { boxFor: boxes(0), limit: Infinity })).toHaveLength(20)
  })

  it('is exact whatever the grid cell size, including cells far smaller than a box', () => {
    const pts: Pt[] = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 90, y: 0 },
      { id: 'c', x: 95, y: 0 },
    ]
    for (const cell of [0.5, 3, 100, 10000]) {
      const kept = selectSpaced(pts, { boxFor: boxes(100), limit: 10, cell })
      expect(kept.map((p) => p.id), `cell=${cell}`).toEqual(['a'])
    }
  })

  it('thins a uniform field to a roughly constant count as the spacing grows', () => {
    const grid: Pt[] = []
    for (let x = 0; x < 40; x++) for (let y = 0; y < 40; y++) grid.push({ id: `${x},${y}`, x, y })
    const loose = selectSpaced(grid, { boxFor: boxes(8), limit: Infinity })
    const tight = selectSpaced(grid, { boxFor: boxes(4), limit: Infinity })
    expect(loose.length).toBeLessThan(tight.length)
    expect(loose.length).toBeGreaterThan(0)
  })
})

describe('getRankedMapEntities', () => {
  const ranked = getRankedMapEntities()
  const bySlug = new Map(ranked.map((r) => [r.entity.slug, r]))

  it('is sorted best-first, which selectSpaced relies on', () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].rank).toBeGreaterThanOrEqual(ranked[i].rank)
    }
  })

  it('covers the curated set and the long tail', () => {
    expect(ranked.length).toBeGreaterThan(7000)
    for (const slug of MAP_CITY_SLUGS) expect(bySlug.has(slug)).toBe(true)
  })

  it('has no duplicate slugs', () => {
    expect(new Set(ranked.map((r) => r.entity.slug)).size).toBe(ranked.length)
  })

  it('every anchor exists in the registry and outranks a merely familiar city', () => {
    for (const slug of ANCHOR_CITY_SLUGS) expect(bySlug.has(slug), slug).toBe(true)
    // Karachi and Dhaka are more populous than Lagos; the anchor tier is what
    // keeps this a timezone map rather than a population map.
    expect(bySlug.get('lagos')!.rank).toBeGreaterThan(bySlug.get('karachi')!.rank)
    expect(bySlug.get('nairobi')!.rank).toBeGreaterThan(bySlug.get('dhaka')!.rank)
  })

  it('ranks an airport by its parent city, not by whatever shares its name', () => {
    const lhr = ranked.find((r) => r.entity.kind === 'airport' && r.entity.iata === 'LHR')!
    const san = ranked.find((r) => r.entity.kind === 'airport' && r.entity.iata === 'SAN')!
    expect(lhr.rank).toBeGreaterThan(san.rank)
  })

  it('ranks a familiar city above a curated one, and both above the tail', () => {
    const familiar = bySlug.get('tokyo')!.rank
    const curated = bySlug.get('dar-es-salaam')!.rank
    const tail = ranked.find((r) => !FAMILIAR_CITY_SLUGS.has(r.entity.slug) && !MAP_CITY_SLUGS.has(r.entity.slug) && r.entity.kind === 'city')!
    expect(familiar).toBeGreaterThan(curated)
    expect(curated).toBeGreaterThan(tail.rank)
  })

  it('orders by population inside a tier', () => {
    expect(bySlug.get('tokyo')!.rank).toBeGreaterThan(bySlug.get('reykjavik')?.rank ?? -Infinity)
  })

  it('marks only the tail as minor', () => {
    expect(bySlug.get('london')!.rank).toBeGreaterThanOrEqual(MINOR_RANK)
    const tail = ranked[ranked.length - 1]
    expect(tail.rank).toBeLessThan(MINOR_RANK)
  })

  it('is cached, so a render never rebuilds 7K entries', () => {
    expect(getRankedMapEntities()).toBe(ranked)
  })
})

import cityTimezones from 'city-timezones'
import { getAllEntities, type Entity } from './entities'
import { FAMILIAR_AIRPORT_IATA, FAMILIAR_CITY_SLUGS } from './familiar-cities'
import { ANCHOR_CITY_SLUGS, MAP_CITY_SLUGS } from './map-entities'
import { normalize } from './resolver'

/** A tier base picks the band; log-population orders within it. Bands are wide
 *  enough that population never promotes a tail city past a curated one. */
export interface RankedEntity {
  entity: Entity
  rank: number
}

const TIER = {
  anchorCity: 500,
  familiarCity: 400,
  mapCity: 300,
  curatedCity: 200,
  familiarAirport: 250,
  airport: 100,
  tailCity: 0,
} as const

/** Below this a dot is drawn as an incidental mark. */
export const MINOR_RANK = TIER.curatedCity

interface CityRow {
  city: string
  city_ascii?: string
  lat: number
  lng: number
  pop?: number
  timezone: string
  iso2: string
  country: string
}

/**
 * log10, so a 20M city outranks a 20K one by ~3 rather than 1000x.
 *
 * Floored at zero: a handful of DB rows carry a fractional population, and a
 * negative score would drop a place below its own tier base.
 */
function popScore(pop: number | undefined): number {
  return pop && pop > 1 ? Math.log10(pop) : 0
}

let popByName: Map<string, number> | null = null

/** Curated entities carry no population; borrow it by name from the DB. */
function populationOf(name: string): number | undefined {
  if (!popByName) {
    popByName = new Map()
    for (const row of cityTimezones.cityMapping as CityRow[]) {
      const key = normalize(row.city)
      const existing = popByName.get(key)
      if (row.pop && (existing === undefined || row.pop > existing)) popByName.set(key, row.pop)
    }
  }
  return popByName.get(normalize(name))
}

function rankOf(entity: Entity, cityNameBySlug: Map<string, string>): number {
  if (entity.kind === 'airport') {
    const base = FAMILIAR_AIRPORT_IATA.has(entity.iata) ? TIER.familiarAirport : TIER.airport
    // An airport's pull is its city's. Matching on the field's own name picks up
    // whatever unrelated town happens to share it — SAN outranking Heathrow.
    const parent = entity.parentCitySlug ? cityNameBySlug.get(entity.parentCitySlug) : undefined
    return base + popScore(populationOf(parent ?? entity.displayName))
  }
  const base = ANCHOR_CITY_SLUGS.has(entity.slug)
    ? TIER.anchorCity
    : FAMILIAR_CITY_SLUGS.has(entity.slug)
      ? TIER.familiarCity
      : MAP_CITY_SLUGS.has(entity.slug)
        ? TIER.mapCity
        : TIER.curatedCity
  return base + popScore(populationOf(entity.displayName))
}

let ranked: readonly RankedEntity[] | null = null

/** Sorted once at module load; selection walks this order, so no render re-sorts 7K entries. */
export function getRankedMapEntities(): readonly RankedEntity[] {
  if (ranked) return ranked
  const curated = getAllEntities()
  const seen = new Set(curated.map((e) => e.slug))
  const cityNameBySlug = new Map(curated.map((e) => [e.slug, e.displayName]))
  const out: RankedEntity[] = curated.map((entity) => ({ entity, rank: rankOf(entity, cityNameBySlug) }))

  for (const row of cityTimezones.cityMapping as CityRow[]) {
    const slug = row.city.toLowerCase().replace(/\s+/g, '-')
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push({
      rank: TIER.tailCity + popScore(row.pop),
      entity: {
        kind: 'city',
        slug,
        displayName: row.city,
        country: row.country,
        countryCode: row.iso2,
        iana: row.timezone,
        lat: row.lat,
        lng: row.lng,
        aliases: [],
        wikidataId: null,
        vibes: null,
        iconSlug: null,
      },
    })
  }

  out.sort((a, b) => b.rank - a.rank)
  ranked = out
  return ranked
}

/**
 * The lowest rank worth drawing at a given zoom, where `t` runs 0 at the resting
 * view to 1 at full zoom.
 *
 * Spacing alone decides *where* there is room; this decides *who is eligible for
 * it*. Without it an empty quarter of the map fills with whatever tail city
 * happens to sit there, and the world view reads as a list of places nobody
 * asked about. So the whole world is curated-only, and the tail opens by
 * population as you come in — 30M and up first, everything by the time you are
 * all the way in.
 */
export function rankFloor(kind: 'city' | 'airport', t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  const CURATED_ONLY_UNTIL = 0.25
  if (clamped < CURATED_ONLY_UNTIL) {
    return kind === 'airport' ? TIER.familiarAirport : TIER.mapCity
  }
  // log10 of the population a tail city needs to earn a place, easing to zero.
  const POP_CEILING = 7.5
  return POP_CEILING * (1 - (clamped - CURATED_ONLY_UNTIL) / (1 - CURATED_ONLY_UNTIL))
}

/**
 * Catchment bounds in frame units at the resting view. The floor keeps a dot in
 * a crowd reachable; the ceiling stops an isolated one claiming half an ocean.
 */
const HIT_MIN = 3
const HIT_MAX = 12

export interface DotIndex {
  /** Catchment radius per point, in frame units at the resting view. */
  radii: readonly number[]
  /**
   * The nearest point whose catchment covers (x, y), or -1. Coordinates are
   * frame units; `zoom` divides the catchments so they hold one size on screen.
   */
  nearest(x: number, y: number, zoom: number): number
}

/**
 * How much room each dot may claim, and which one a pointer is on. The second
 * is the layer's job rather than the browser's, because the dots are drawn a
 * few thousand to a path.
 *
 * A catchment is half the distance to the nearest neighbour, so two touching
 * dots split the gap instead of one swallowing the other. Bucketed on a uniform
 * grid to stay O(n) at cityDensity 'all'.
 */
export function indexDots(points: readonly { x: number; y: number }[]): DotIndex {
  const cell = HIT_MAX * 2
  const buckets = new Map<number, number[]>()
  points.forEach((p, i) => {
    const key = cellKey(Math.floor(p.x / cell), Math.floor(p.y / cell))
    const bucket = buckets.get(key)
    if (bucket) bucket.push(i)
    else buckets.set(key, [i])
  })

  /** Walks the nine cells around a point; every catchment fits inside them. */
  const around = (x: number, y: number, visit: (index: number) => void) => {
    const cx = Math.floor(x / cell)
    const cy = Math.floor(y / cell)
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = buckets.get(cellKey(gx, gy))
        if (bucket) for (const i of bucket) visit(i)
      }
    }
  }

  const radii = points.map((p, i) => {
    let nearestSq = Infinity
    around(p.x, p.y, (j) => {
      if (j === i) return
      const dx = p.x - points[j].x
      const dy = p.y - points[j].y
      const d = dx * dx + dy * dy
      if (d < nearestSq) nearestSq = d
    })
    if (!Number.isFinite(nearestSq)) return HIT_MAX
    return Math.max(HIT_MIN, Math.min(HIT_MAX, Math.sqrt(nearestSq) / 2))
  })

  return {
    radii,
    nearest(x, y, zoom) {
      let best = -1
      let bestSq = Infinity
      around(x, y, (j) => {
        const dx = x - points[j].x
        const dy = y - points[j].y
        const d = dx * dx + dy * dy
        const r = radii[j] / zoom
        if (d <= r * r && d < bestSq) {
          bestSq = d
          best = j
        }
      })
      return best
    },
  }
}

/** Axis-aligned exclusion rectangle, top-left origin, caller's units. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/**
 * One number for a cell, so a grid lookup doesn't allocate a string. Exact while
 * `|gy| < 2^20`, which every grid here clears by three orders of magnitude.
 */
export function cellKey(gx: number, gy: number): number {
  return gx * 2 ** 21 + gy
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export interface SelectOptions<T> {
  /** The space this item claims, or null to drop it — also how the caller culls to the viewport. */
  boxFor: (item: T) => Box | null
  limit: number
  /** Boxes already claimed by an earlier pass; candidates must clear these too. */
  seed?: readonly Box[]
  /** Grid cell size; performance only, correctness holds at any value. */
  cell?: number
}

/**
 * Greedy first-fit. `candidates` MUST already be ordered most-important first.
 *
 * Size the boxes in screen pixels and a roughly constant on-screen count falls
 * out with no zoom term: zooming spreads survivors apart, smaller ones fill the gaps.
 *
 * Accepted boxes are indexed into every cell they overlap and each candidate
 * queries only its own, so the test is exact regardless of `cell`.
 */
export function selectSpaced<T>(candidates: readonly T[], options: SelectOptions<T>): T[] {
  const { boxFor, limit, seed, cell = 32 } = options
  if (limit <= 0) return []

  const grid = new Map<number, Box[]>()
  const accepted: T[] = []

  const cellsOf = (b: Box) => {
    const x0 = Math.floor(b.x / cell)
    const x1 = Math.floor((b.x + b.w) / cell)
    const y0 = Math.floor(b.y / cell)
    const y1 = Math.floor((b.y + b.h) / cell)
    return { x0, x1, y0, y1 }
  }

  const claim = (box: Box) => {
    const { x0, x1, y0, y1 } = cellsOf(box)
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const key = cellKey(gx, gy)
        const bucket = grid.get(key)
        if (bucket) bucket.push(box)
        else grid.set(key, [box])
      }
    }
  }

  if (seed) for (const box of seed) claim(box)

  for (const item of candidates) {
    const box = boxFor(item)
    if (!box) continue

    const { x0, x1, y0, y1 } = cellsOf(box)
    let blocked = false
    for (let gx = x0; gx <= x1 && !blocked; gx++) {
      for (let gy = y0; gy <= y1 && !blocked; gy++) {
        const bucket = grid.get(cellKey(gx, gy))
        if (!bucket) continue
        for (const other of bucket) {
          if (intersects(box, other)) {
            blocked = true
            break
          }
        }
      }
    }
    if (blocked) continue

    accepted.push(item)
    if (accepted.length >= limit) break
    claim(box)
  }

  return accepted
}

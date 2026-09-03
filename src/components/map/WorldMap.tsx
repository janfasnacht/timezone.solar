import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { geoNaturalEarth1, geoPath, geoGraticule10, geoInterpolate } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, LineString } from 'geojson'
import land110m from 'world-atlas/land-110m.json'
import countries110m from 'world-atlas/countries-110m.json'
import { getSolarTerminator } from '@/engine/solar'
import { findEntityForMap } from '@/engine/map-entities'
import { getRankedMapEntities, selectSpaced, rankFloor, MINOR_RANK, type Box } from '@/engine/map-density'
import { normalize } from '@/engine/resolver'
import type { Entity } from '@/engine/entities'
import type { HomeCity } from '@/lib/preferences'
import { type EntityRole } from './EntityDot'
import { EntityLayer, LabelLayer, type PlacedLabel, type ProjectedEntity } from './EntityLayer'
import { BaseLayers, TerminatorLayer } from './BaseLayers'
import { EntityCard } from './EntityCard'
import { TimezoneOverlay } from './TimezoneOverlay'
import { MapZoomControl } from './MapZoomControl'
import { useTimezoneData } from '@/hooks/useTimezoneData'

const WIDTH = 960
const HEIGHT = 500

/** Space kept above the map so northern land clears the search bar, in px. */
const NORTH_HEADROOM_PX = 88

export const MIN_ZOOM = 1
export const MAX_ZOOM = 8

/**
 * Per-layer budgets, interpolated across the zoom range. Each pair is
 * [resting view, full zoom].
 *
 * Spacing runs to zero and the cap runs high, so at full zoom a layer stops
 * thinning altogether and simply draws everything in view. Labels do not
 * interpolate — twenty names is the most that stays readable at any zoom, so
 * coming in swaps which twenty rather than adding more.
 */
const BUDGET = {
  city: {
    few: { spacingPx: [46, 14], limit: [38, 500] },
    auto: { spacingPx: [24, 0], limit: [130, 2500] },
  },
  airport: {
    few: { spacingPx: [46, 14], limit: [16, 250] },
    auto: { spacingPx: [24, 0], limit: [60, 1200] },
  },
  label: {
    few: { padPx: 96, limit: 10 },
    auto: { padPx: 64, limit: 20 },
    all: { padPx: 6, limit: Infinity },
  },
} as const

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t

const LABEL_PX = 10.5

/**
 * Pan and zoom run at two speeds. The transform itself follows the gesture
 * frame by frame; the density pass — which walks the whole entity pool and
 * re-renders every dot and label — waits for the map to hold still.
 *
 * Waiting means the picks are briefly stale, so they reach past the viewport
 * edge and a gesture that travels further than that overscan pays for a
 * re-layout mid-flight rather than showing a bare edge.
 */
const COMMIT_IDLE_MS = 110
/** Longest a continuous gesture may run on stale picks. */
const COMMIT_MAX_STALE_MS = 200
/** Fraction of the viewport a gesture may travel before forcing the pass. */
const COMMIT_DRIFT = 0.12
/** How far past the viewport edge the picks reach, as a fraction of the view. */
const OVERSCAN = 0.15

const IDENTITY = { x: 0, y: 0, scale: 1 }
type Transform = typeof IDENTITY

export interface MapConversion {
  sourceCity: string
  targetCity: string
  sourceTime: string
  targetTime: string
  offsetDifference: string
  isPreview?: boolean
}

/**
 * One scale for every place layer. `auto` is the zoom-driven default; `few` and
 * `all` are the same machinery with a different budget, not a different mode.
 */
export type Density = 'none' | 'few' | 'auto' | 'all'

interface WorldMapProps {
  now: Date
  use24h: boolean
  homeCity: HomeCity | null
  conversion?: MapConversion | null
  onCityClick?: (cityName: string) => void
  showTimezones?: boolean
  showBorders?: boolean
  showGrid?: boolean
  cityDensity?: Density
  airportDensity?: Density
  labelDensity?: Density
  /** Touch already has pinch and pan; the zoom buttons are for the desktop. */
  isMobile?: boolean
}

/**
 * Matches preserveAspectRatio="slice": the map fills the container and is
 * cropped, so a portrait screen has most of the world off to either side.
 */
function coverOf(vpW: number, vpH: number, f: { w: number; h: number }) {
  return Math.max(vpW / f.w, vpH / f.h)
}

export function WorldMap({
  now,
  use24h,
  homeCity,
  conversion,
  onCityClick,
  showTimezones = false,
  showBorders = false,
  showGrid = true,
  cityDensity = 'auto',
  airportDensity = 'none',
  labelDensity = 'auto',
  isMobile = false,
}: WorldMapProps) {
  // Only the gesture handlers read the frame outside render, so only they need
  // the ref; everything during render uses `frame` itself.
  const frameRef = useRef({ w: WIDTH, h: HEIGHT })
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredEntity, setHoveredEntity] = useState<Entity | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const vpH = containerRect?.height ?? 0

  /**
   * Only publishes a rect that actually differs. `getBoundingClientRect` hands
   * back a fresh object every call, and this one is upstream of the frame, the
   * view and the density pass — so re-setting an identical rect on every hover
   * meant re-picking every dot on the map.
   */
  const syncRect = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const next = el.getBoundingClientRect()
    setContainerRect((prev) =>
      prev && prev.width === next.width && prev.height === next.height &&
      prev.left === next.left && prev.top === next.top
        ? prev
        : next
    )
  }, [])

  // Pan/zoom state for touch gestures. `live` is what the map is drawn at;
  // `committed` is the last view the density pass ran for. They are equal
  // whenever the map is at rest.
  const [live, setLive] = useState<Transform>(IDENTITY)
  const [committed, setCommitted] = useState<Transform>(IDENTITY)
  const transformRef = useRef<Transform>(IDENTITY)
  const committedRef = useRef<Transform>(IDENTITY)
  const committedAtRef = useRef(0)
  const liveFrameRef = useRef(0)
  const commitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const gestureRef = useRef<{
    type: 'none' | 'pan' | 'pinch'
    moved: boolean
    startX: number
    startY: number
    startTx: number
    startTy: number
    startDist: number
    startScale: number
  }>({ type: 'none', moved: false, startX: 0, startY: 0, startTx: 0, startTy: 0, startDist: 0, startScale: 1 })

  const projection = useMemo(
    () =>
      geoNaturalEarth1()
        .translate([WIDTH / 2, HEIGHT / 2])
        .scale(153),
    []
  )

  const pathGenerator = useMemo(() => geoPath(projection), [projection])

  const landGeoJson = useMemo(() => {
    const topo = land110m as unknown as Topology<{
      land: GeometryCollection
    }>
    return feature(topo, topo.objects.land)
  }, [])

  const landPath = useMemo(
    () => pathGenerator(landGeoJson) || '',
    [pathGenerator, landGeoJson]
  )

  /**
   * The projection leaves empty margin inside the 960x500 frame, which showed as
   * background above and below the map. Framing on the land's own bounds instead
   * means the map reaches every edge of the screen.
   *
   * Except at the top, which gets a fixed strip back. The far south is empty
   * ocean, so a flush bottom edge costs nothing — but Scandinavia, Greenland and
   * Alaska sit right at the northern bound and would otherwise tuck under the
   * search bar. The frame grows upward only, so the bottom stays flush.
   */
  const frame = useMemo(() => {
    const [[x0, y0], [x1, y1]] = pathGenerator.bounds(landGeoJson)
    const w = x1 - x0
    const h = y1 - y0
    // Headroom is a fixed number of screen pixels, so it clears the chrome at
    // any viewport height rather than scaling with the map.
    const pad = vpH > NORTH_HEADROOM_PX * 2 ? (h * NORTH_HEADROOM_PX) / (vpH - NORTH_HEADROOM_PX) : 0
    return { x: x0, y: y0 - pad, w, h: h + pad }
  }, [pathGenerator, landGeoJson, vpH])
  useEffect(() => {
    frameRef.current = frame
  }, [frame])

  // The SVG is sized to the covered area rather than to the container, and
  // centred with offsets. Rendering is identical at rest, but the element now
  // genuinely extends past the viewport, so panning reveals map instead of
  // sliding an already-clipped box off its own background.
  const cover = containerRect ? coverOf(containerRect.width, containerRect.height, frame) : null
  const svgBox = cover && containerRect
    ? {
        width: frame.w * cover,
        height: frame.h * cover,
        left: (containerRect.width - frame.w * cover) / 2,
        top: (containerRect.height - frame.h * cover) / 2,
      }
    : null

  const countriesGeoJson = useMemo(() => {
    const topo = countries110m as unknown as Topology<{
      countries: GeometryCollection
    }>
    return feature(topo, topo.objects.countries)
  }, [])

  const countriesPath = useMemo(
    () => pathGenerator(countriesGeoJson) || '',
    [pathGenerator, countriesGeoJson]
  )

  const graticulePath = useMemo(
    () => pathGenerator(geoGraticule10()) || '',
    [pathGenerator]
  )

  const terminatorPath = useMemo(() => {
    const terminator = getSolarTerminator(now)
    return pathGenerator(terminator) || ''
  }, [pathGenerator, now])

  const { data: tzData } = useTimezoneData(showTimezones)

  // Asking about the city you are in is a valid query. Only the arc is
  // meaningless there, so the pin and label still render.
  const isSameCity = conversion
    ? normalize(conversion.sourceCity) === normalize(conversion.targetCity)
    : false

  const effectiveConversion = conversion

  // Deliberately not keyed on the transform: pan/zoom only change which points
  // are picked, so re-projecting thousands of coordinates per wheel tick buys nothing.
  // Split by kind because each layer draws from its own budget — folded into one
  // pool the cities exhaust the cap before the walk ever reaches an airport.
  const { cityPool, airportPool } = useMemo(() => {
    const project = (r: { entity: Entity; rank: number }): ProjectedEntity | null => {
      const point = projection([r.entity.lng, r.entity.lat])
      return point ? { entity: r.entity, rank: r.rank, x: point[0], y: point[1] } : null
    }
    const all = getRankedMapEntities()
    const isProjected = (p: ProjectedEntity | null): p is ProjectedEntity => p !== null
    return {
      cityPool: all.filter((r) => r.entity.kind !== 'airport').map(project).filter(isProjected),
      airportPool: all.filter((r) => r.entity.kind === 'airport').map(project).filter(isProjected),
    }
  }, [projection])

  /** Visible slice in frame units, plus screen pixels per frame unit. Density and
   *  label sizes are picked in screen px and divided through `ppu`.
   *
   *  Keyed on the committed transform, not the live one: this is the input to
   *  the density pass, and that pass runs once the map has settled. */
  const view = useMemo(() => {
    if (!containerRect || !cover) return null
    const { x: tx, y: ty, scale } = committed
    const left = (containerRect.width - frame.w * cover) / 2
    const top = (containerRect.height - frame.h * cover) / 2
    const toFrameX = (px: number) => frame.x + ((px - tx) / scale - left) / cover
    const toFrameY = (py: number) => frame.y + ((py - ty) / scale - top) / cover
    const x0 = toFrameX(0)
    const x1 = toFrameX(containerRect.width)
    const y0 = toFrameY(0)
    const y1 = toFrameY(containerRect.height)
    return {
      ppu: cover * scale,
      /** 0 at the resting view, 1 at full zoom — drives every budget below. */
      t: (scale - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM),
      x0,
      x1,
      y0,
      y1,
      /** Dots are picked past the edge so a pan has something to reveal while
       *  the next pass is still pending. Labels are not: their budget is a
       *  count, and spending it off-screen would empty the visible map. */
      cull: {
        x0: x0 - (x1 - x0) * OVERSCAN,
        x1: x1 + (x1 - x0) * OVERSCAN,
        y0: y0 - (y1 - y0) * OVERSCAN,
        y1: y1 + (y1 - y0) * OVERSCAN,
      },
    }
  }, [containerRect, cover, frame, committed])

  // Drawn whatever the density pass decides.
  const pinnedProjected = useMemo(() => {
    if (!effectiveConversion) return []
    const out: ProjectedEntity[] = []
    const seen = new Set<string>()
    for (const name of [effectiveConversion.sourceCity, effectiveConversion.targetCity]) {
      if (!name) continue
      const entity = findEntityForMap(name)
      if (!entity || seen.has(entity.slug)) continue
      const point = projection([entity.lng, entity.lat])
      if (!point) continue
      seen.add(entity.slug)
      out.push({ entity, rank: Infinity, x: point[0], y: point[1] })
    }
    return out
  }, [effectiveConversion, projection])

  const projectedEntities = useMemo(() => {
    if (!view) return pinnedProjected

    const pinned = new Set(pinnedProjected.map((p) => p.entity.slug))
    const { cull } = view
    const inView = (p: ProjectedEntity) =>
      !pinned.has(p.entity.slug) &&
      p.x >= cull.x0 && p.x <= cull.x1 && p.y >= cull.y0 && p.y <= cull.y1

    /** One layer's pass. Returns the picks and the space they claimed. */
    const pick = (pool: readonly ProjectedEntity[], kind: 'city' | 'airport', density: Density) => {
      if (density === 'none') return { picks: [] as ProjectedEntity[] }

      // 'all' is the end state the other tiers reach at full zoom: no floor, no
      // spacing, no cap. It skips the grid, which is also what keeps a drag
      // cheap with several thousand dots in the pool.
      if (density === 'all') return { picks: pool.filter(inView) }

      const budgets = BUDGET[kind][density]
      const spacingPx = lerp(budgets.spacingPx, view.t)
      const half = spacingPx / view.ppu / 2
      const boxOf = (p: ProjectedEntity): Box =>
        ({ x: p.x - half, y: p.y - half, w: half * 2, h: half * 2 })

      return {
        picks: selectSpaced(pool, {
          limit: Math.round(lerp(budgets.limit, view.t)),
          cell: Math.max(spacingPx, 8) / view.ppu,
          boxFor: (p) => (inView(p) ? boxOf(p) : null),
        }),
      }
    }

    // The two layers space among themselves and not against each other. An
    // airport sits on its city — JFK is sub-pixel from New York at world zoom —
    // so any mutual clearance empties the airport layer entirely. The plane is a
    // different mark drawn on top; letting it share the dot is the honest way to
    // make the toggle mean what it says.
    const cities = pick(cityPool, 'city', cityDensity)
    const airports = pick(airportPool, 'airport', airportDensity)

    return [...pinnedProjected, ...cities.picks, ...airports.picks]
  }, [cityDensity, airportDensity, view, cityPool, airportPool, pinnedProjected])

  /**
   * Same greedy pass on the text's own box, so two labels can never collide.
   *
   * The box is padded well beyond the glyphs. Without it the megacities clump —
   * Mumbai, Delhi, Karachi and Dhaka all fit inside a few hundred kilometres and
   * would take four of the slots, leaving Europe and Africa bare.
   */
  const cityLabels = useMemo<PlacedLabel[]>(() => {
    if (labelDensity === 'none' || !view) return []

    const { padPx, limit } = BUDGET.label[labelDensity]
    const font = LABEL_PX / view.ppu
    const gap = 5 / view.ppu
    const padX = padPx / view.ppu
    // Deliberately not square. Labels are wide and short, so horizontal crowding
    // is what makes them unreadable; matching padY to padX costs whole cities —
    // at 0.45 Istanbul's box swallows Cairo.
    const padY = (padPx * 0.32) / view.ppu
    const pinned = new Set(pinnedProjected.map((p) => p.entity.slug))
    // Rough advance width for the label font; only the collision test reads it.
    const widthOf = (text: string) => text.length * font * 0.52

    const placed = new Map<string, Omit<PlacedLabel, 'slug'>>()

    const chosen = selectSpaced(projectedEntities, {
      limit,
      cell: Math.max(padX, font * 8),
      boxFor: (p) => {
        // The pinned pair already carries a card with its name and time.
        if (pinned.has(p.entity.slug)) return null
        // An unnamed dot is never "a city nobody has heard of" — only a named
        // one is. So the eligibility floor lands here rather than on the dots,
        // and the resting view names curated places only.
        if (p.rank < rankFloor(p.entity.kind === 'airport' ? 'airport' : 'city', view.t)) return null
        if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) return null
        const text = p.entity.kind === 'airport' ? p.entity.iata : p.entity.displayName
        const w = widthOf(text)
        const flip = p.x + gap + w > view.x1
        const left = flip ? p.x - gap - w : p.x + gap
        placed.set(p.entity.slug, {
          text,
          x: flip ? p.x - gap : p.x + gap,
          y: p.y + font * 0.36,
          anchor: flip ? 'end' : 'start',
        })
        return { x: left - padX / 2, y: p.y - font * 0.5 - padY, w: w + padX, h: font + padY * 2 }
      },
    })

    return chosen.map((p) => ({ slug: p.entity.slug, ...placed.get(p.entity.slug)! }))
  }, [labelDensity, view, projectedEntities, pinnedProjected])

  /** Label size in map units at the resting view; the live zoom divides it down. */
  const labelUnits = LABEL_PX / (cover ?? 1)

  // Each dot's transparent catchment is half the distance to its nearest
  // neighbour, clamped — so two touching dots split the gap instead of one
  // swallowing the other. Bucketed on a uniform grid to stay O(n) at
  // cityDensity: 'all', where there are thousands of points.
  const hitRadii = useMemo(() => {
    const MAX = 12
    const MIN = 3
    const cell = MAX * 2
    const buckets = new Map<string, number[]>()
    projectedEntities.forEach((p, i) => {
      const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`
      const bucket = buckets.get(key)
      if (bucket) bucket.push(i)
      else buckets.set(key, [i])
    })

    return projectedEntities.map((p, i) => {
      const cx = Math.floor(p.x / cell)
      const cy = Math.floor(p.y / cell)
      let nearest = Infinity
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = buckets.get(`${gx}:${gy}`)
          if (!bucket) continue
          for (const j of bucket) {
            if (j === i) continue
            const q = projectedEntities[j]
            const dx = p.x - q.x
            const dy = p.y - q.y
            const d = dx * dx + dy * dy
            if (d < nearest) nearest = d
          }
        }
      }
      if (!Number.isFinite(nearest)) return MAX
      return Math.max(MIN, Math.min(MAX, Math.sqrt(nearest) / 2))
    })
  }, [projectedEntities])

  const { sourceProjected, targetProjected } = useMemo(() => {
    if (!effectiveConversion) return { sourceProjected: null, targetProjected: null }
    // `normalize`, not `toLowerCase`: the resolver may answer with a diacritic
    // form ("Zürich") where the curated entity is ASCII ("Zurich").
    const src = projectedEntities.find(
      (c) => normalize(c.entity.displayName) === normalize(effectiveConversion.sourceCity)
    )
    const tgt = projectedEntities.find(
      (c) => normalize(c.entity.displayName) === normalize(effectiveConversion.targetCity)
    )
    return { sourceProjected: src ?? null, targetProjected: tgt ?? null }
  }, [effectiveConversion, projectedEntities])

  // Great-circle path between source and target. We oversample the geodesic
  // explicitly because d3-geo's default adaptive resampling is too coarse at
  // this scale (visibly polygonal). geoPath still handles antimeridian
  // splitting during projection so transpacific routes don't wrap across.
  const arcData = useMemo(() => {
    if (!sourceProjected || !targetProjected || isSameCity) return null
    const a: [number, number] = [sourceProjected.entity.lng, sourceProjected.entity.lat]
    const b: [number, number] = [targetProjected.entity.lng, targetProjected.entity.lat]
    const interp = geoInterpolate(a, b)
    const N = 128
    const coordinates: [number, number][] = []
    for (let i = 0; i <= N; i++) {
      coordinates.push(interp(i / N) as [number, number])
    }
    const lineString: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    }
    const d = pathGenerator(lineString)
    if (!d) return null
    const midProjected = projection(interp(0.5))
    if (!midProjected) return null
    return { d, midX: midProjected[0], midY: midProjected[1] }
  }, [sourceProjected, targetProjected, isSameCity, pathGenerator, projection])

  const svgRef = useRef<SVGSVGElement>(null)

  /**
   * Frame units to container pixels, transform included — the exact inverse of
   * `view`. Every HTML overlay is positioned through this and rendered outside
   * the transformed wrapper, so its size and its gap from the dot are plain
   * screen pixels at any zoom.
   */
  const toScreen = useCallback(
    (p: { x: number; y: number }) => {
      if (!containerRect || !cover) return null
      const { x: tx, y: ty, scale } = live
      const left = (containerRect.width - frame.w * cover) / 2
      const top = (containerRect.height - frame.h * cover) / 2
      return {
        x: ((p.x - frame.x) * cover + left) * scale + tx,
        y: ((p.y - frame.y) * cover + top) * scale + ty,
      }
    },
    [containerRect, cover, frame, live]
  )
  // Hover intent both ways: opening waits so sweeping the map doesn't strobe
  // cards, closing waits so the cursor can reach the card it opened.
  const OPEN_DELAY = 220
  const CLOSE_DELAY = 160
  const [settledEntity, setSettledEntity] = useState<Entity | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const handleHover = useCallback(
    (entity: Entity | null) => {
      clearTimeout(hoverTimer.current)
      if (entity) {
        setHoveredEntity(entity)
        hoverTimer.current = setTimeout(() => setSettledEntity(entity), OPEN_DELAY)
        syncRect()
      } else {
        hoverTimer.current = setTimeout(() => {
          setHoveredEntity(null)
          setSettledEntity(null)
        }, CLOSE_DELAY)
      }
    },
    [syncRect]
  )

  // Derived rather than captured on hover, so the card tracks its dot while the
  // map is panned or zoomed underneath it.
  const hoverPos = useMemo(() => {
    if (!hoveredEntity) return null
    const projected = projectedEntities.find((c) => c.entity.slug === hoveredEntity.slug)
    return projected ? toScreen(projected) : null
  }, [hoveredEntity, projectedEntities, toScreen])

  useEffect(() => {
    window.addEventListener('resize', syncRect)
    syncRect()
    return () => window.removeEventListener('resize', syncRect)
  }, [syncRect])

  // Touch gesture handlers for pan/zoom
  /**
   * Keep the map covering the viewport. `preserveAspectRatio="slice"` already
   * crops it, so at scale 1 a portrait screen has real content off both sides —
   * panning there is meaningful, it just must not drag past the edge.
   */
  const clampTransform = useCallback((t: { x: number; y: number; scale: number }) => {
    const el = containerRef.current
    if (!el) return t
    const vpW = el.offsetWidth
    const vpH = el.offsetHeight
    const cover = coverOf(vpW, vpH, frameRef.current)
    // transformOrigin is 0 0, so scaling alone drags content down and right.
    // This is the translation that undoes that — the centre of the allowed range.
    const midX = ((1 - t.scale) * vpW) / 2
    const midY = ((1 - t.scale) * vpH) / 2
    const { w, h } = frameRef.current
    const rangeX = Math.max(0, (w * cover * t.scale - vpW) / 2)
    const rangeY = Math.max(0, (h * cover * t.scale - vpH) / 2)
    return {
      scale: t.scale,
      x: Math.max(midX - rangeX, Math.min(midX + rangeX, t.x)),
      y: Math.max(midY - rangeY, Math.min(midY + rangeY, t.y)),
    }
  }, [])

  /** Runs the density pass for wherever the map is now. */
  const commit = useCallback(() => {
    clearTimeout(commitTimerRef.current)
    committedRef.current = transformRef.current
    committedAtRef.current = performance.now()
    setCommitted(transformRef.current)
  }, [])

  const updateTransform = useCallback((raw: Transform) => {
    const t = clampTransform(raw)
    transformRef.current = t

    // One repaint per frame however fast the wheel or the finger reports.
    if (!liveFrameRef.current) {
      liveFrameRef.current = requestAnimationFrame(() => {
        liveFrameRef.current = 0
        setLive(transformRef.current)
      })
    }

    // The density pass waits for the map to hold still, unless the gesture has
    // travelled past the overscan or has been running on stale picks too long.
    const el = containerRef.current
    const c = committedRef.current
    const driftX = el ? el.offsetWidth * COMMIT_DRIFT : Infinity
    const driftY = el ? el.offsetHeight * COMMIT_DRIFT : Infinity
    if (
      Math.abs(t.x - c.x) > driftX ||
      Math.abs(t.y - c.y) > driftY ||
      performance.now() - committedAtRef.current > COMMIT_MAX_STALE_MS
    ) {
      commit()
      return
    }
    clearTimeout(commitTimerRef.current)
    commitTimerRef.current = setTimeout(commit, COMMIT_IDLE_MS)
  }, [clampTransform, commit])

  useEffect(
    () => () => {
      clearTimeout(commitTimerRef.current)
      if (liveFrameRef.current) cancelAnimationFrame(liveFrameRef.current)
    },
    []
  )

  const handleMapTouchStart = useCallback((e: React.TouchEvent) => {
    const t = transformRef.current
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
      gestureRef.current = {
        type: 'pinch', moved: false,
        startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        startY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        startTx: t.x, startTy: t.y,
        startDist: dist, startScale: t.scale,
      }
    } else if (e.touches.length === 1) {
      gestureRef.current = {
        type: 'pan', moved: false,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTx: t.x, startTy: t.y,
        startDist: 0, startScale: t.scale,
      }
    }
  }, [])

  const handleMapTouchMove = useCallback((e: React.TouchEvent) => {
    const g = gestureRef.current
    if (g.type === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startX
      const dy = e.touches[0].clientY - g.startY
      if (!g.moved && Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      g.moved = true
      updateTransform({ x: g.startTx + dx, y: g.startTy + dy, scale: g.startScale })
    } else if (g.type === 'pinch' && e.touches.length === 2) {
      g.moved = true
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.startScale * (dist / g.startDist)))
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = g.startX - rect.left
      const cy = g.startY - rect.top
      const scaleRatio = newScale / g.startScale
      const panDx = midX - g.startX
      const panDy = midY - g.startY
      updateTransform({
        scale: newScale,
        x: cx - (cx - g.startTx) * scaleRatio + panDx,
        y: cy - (cy - g.startTy) * scaleRatio + panDy,
      })
    }
  }, [updateTransform])

  const handleMapTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      const t = transformRef.current
      // Settle the scale back to 1 but keep where the map was panned to: the
      // pan is clamped to the crop, so it can never leave the viewport empty.
      // Settle the scale back to 1 but keep where the map was panned to: the
      // pan is clamped to the crop, so it can never leave the viewport empty.
      if (t.scale <= 1.05 && t.scale !== 1) {
        updateTransform({ x: t.x, y: t.y, scale: 1 })
      }
      gestureRef.current = { ...gestureRef.current, type: 'none', moved: false }
    } else if (e.touches.length === 1 && gestureRef.current.type === 'pinch') {
      const t = transformRef.current
      gestureRef.current = {
        type: 'pan', moved: false,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTx: t.x, startTy: t.y,
        startDist: 0, startScale: t.scale,
      }
    }
  }, [updateTransform])

  /** Scale about a point in container coords, so what you point at stays put. */
  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const t = transformRef.current
      const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, t.scale * factor))
      if (scale === t.scale) return
      const ratio = scale / t.scale
      updateTransform({ scale, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio })
    },
    [updateTransform]
  )

  const resetZoom = useCallback(
    () => updateTransform({ x: 0, y: 0, scale: MIN_ZOOM }),
    [updateTransform]
  )

  const stepZoom = useCallback(
    (direction: number) => {
      const el = containerRef.current
      if (!el) return
      zoomAt(direction > 0 ? 1.5 : 1 / 1.5, el.offsetWidth / 2, el.offsetHeight / 2)
    },
    [zoomAt]
  )

  // Native, not React: React's synthetic wheel listener is passive, so
  // `preventDefault` there is a no-op and the page scrolls behind the map.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // Trackpad pinch arrives as ctrl+wheel with small deltas; line-mode is rows, not px.
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002))
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const [dragging, setDragging] = useState(false)
  // A drag that started on a dot must not also open that dot on release.
  const draggedRef = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      draggedRef.current = false
      const startX = e.clientX
      const startY = e.clientY
      const { x: startTx, y: startTy } = transformRef.current

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!draggedRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
        if (!draggedRef.current) {
          draggedRef.current = true
          setDragging(true)
        }
        updateTransform({ x: startTx + dx, y: startTy + dy, scale: transformRef.current.scale })
      }
      const onUp = () => {
        setDragging(false)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [updateTransform]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      // At the ceiling the same gesture is the way back out.
      if (transformRef.current.scale >= MAX_ZOOM - 0.001) {
        resetZoom()
        return
      }
      const rect = el.getBoundingClientRect()
      zoomAt(1.8, e.clientX - rect.left, e.clientY - rect.top)
    },
    [zoomAt, resetZoom]
  )

  const handleClick = useCallback(
    (entity: Entity) => {
      if (draggedRef.current) return
      if (onCityClick) {
        onCityClick(entity.displayName)
      } else {
        window.location.href = `/?q=${encodeURIComponent(entity.displayName)}`
      }
    },
    [onCityClick]
  )

  // Two entries, looked up by slug. Asking each dot to normalize its own name
  // meant several thousand string passes per render at cityDensity 'all'.
  const roles = useMemo(() => {
    const bySlug = new Map<string, EntityRole>()
    if (sourceProjected) bySlug.set(sourceProjected.entity.slug, 'source')
    if (targetProjected) bySlug.set(targetProjected.entity.slug, 'target')
    return bySlug
  }, [sourceProjected, targetProjected])

  /**
   * Anything *sized* rather than *placed* divides this out. The wrapper's CSS
   * transform scales stroke weight and type along with position, so without it
   * a coastline becomes a band and a 9px tooltip becomes a 72px one at 8x.
   *
   * Only the handful of marks that can be counted follow the live scale — the
   * coastline, the graticule, the arc, twenty labels, one tooltip. The dots run
   * off the settled scale instead: there are thousands of them, and re-sizing
   * them mid-gesture is what made a wheel tick cost a second.
   */
  const zoomInv = 1 / live.scale

  const arcOpacity = 0.45
  const labelOpacity = 0.75

  // Check if hovered city is a pinned city (source or target)
  const hoveredIsPinned = hoveredEntity && effectiveConversion
    ? normalize(hoveredEntity.displayName) === normalize(effectiveConversion.sourceCity) ||
      normalize(hoveredEntity.displayName) === normalize(effectiveConversion.targetCity)
    : false

  // Compute screen positions for pinned city labels
  const pinnedLabels = useMemo(() => {
    if (!effectiveConversion || !containerRect) return null
    const vpW = containerRect.width
    const vpH = containerRect.height

    const src = sourceProjected ? { ...toScreen(sourceProjected)!, city: effectiveConversion.sourceCity, time: effectiveConversion.sourceTime, entity: sourceProjected.entity } : null
    // One place, one label — two would stack exactly.
    const tgt = targetProjected && !isSameCity
      ? { ...toScreen(targetProjected)!, city: effectiveConversion.targetCity, time: effectiveConversion.targetTime, entity: targetProjected.entity }
      : null

    // Smart placement: if both exist, place them on opposite sides to avoid overlap
    let srcPlacement: 'above' | 'below' = 'above'
    let tgtPlacement: 'above' | 'below' = 'above'
    if (src && tgt) {
      // If they're close vertically, stagger them
      if (Math.abs(src.y - tgt.y) < 60) {
        // Put the higher one above, lower one below
        if (src.y <= tgt.y) {
          srcPlacement = 'above'
          tgtPlacement = 'below'
        } else {
          srcPlacement = 'below'
          tgtPlacement = 'above'
        }
      }
    }

    return { src, tgt, srcPlacement, tgtPlacement, containerWidth: vpW, containerHeight: vpH }
  }, [effectiveConversion, sourceProjected, targetProjected, isSameCity, toScreen, containerRect])

  // Determine variant for each pinned label
  const srcIsHovered = hoveredEntity && pinnedLabels?.src?.entity
    ? hoveredEntity.slug === pinnedLabels.src.entity.slug
    : false
  const tgtIsHovered = hoveredEntity && pinnedLabels?.tgt?.entity
    ? hoveredEntity.slug === pinnedLabels.tgt.entity.slug
    : false

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <div
        className={`relative h-full w-full select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: live.scale === 1 && live.x === 0 && live.y === 0
            ? undefined
            : `translate(${live.x}px, ${live.y}px) scale(${live.scale})`,
          transformOrigin: '0 0',
          touchAction: 'none',
        }}
        onTouchStart={handleMapTouchStart}
        onTouchMove={handleMapTouchMove}
        onTouchEnd={handleMapTouchEnd}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
      <svg
        ref={svgRef}
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={svgBox ? 'absolute' : 'w-full h-full'}
        style={svgBox ?? undefined}
      >
        <BaseLayers
          frame={frame}
          zoom={live.scale}
          landPath={landPath}
          countriesPath={countriesPath}
          graticulePath={graticulePath}
          showGrid={showGrid}
          showBorders={showBorders}
        />

        {tzData && (
          <TimezoneOverlay data={tzData} pathGenerator={pathGenerator} zoom={live.scale} />
        )}

        <TerminatorLayer d={terminatorPath} />

        {/* Great-circle connection arc. Stroke and type are divided by the
            zoom, so the line stays a line instead of becoming a band. */}
        {arcData && (
          <>
            <path
              d={arcData.d}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={3.5 * zoomInv}
              strokeOpacity={arcOpacity * 0.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={arcData.d}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.2 * zoomInv}
              strokeOpacity={arcOpacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Offset label — sits on the geodesic midpoint */}
            {effectiveConversion && effectiveConversion.offsetDifference && (
              <text
                x={arcData.midX}
                y={arcData.midY - 5 * zoomInv}
                textAnchor="middle"
                fill="var(--color-accent)"
                fontSize={8 * zoomInv}
                fontFamily="var(--font-mono)"
                opacity={labelOpacity}
              >
                {effectiveConversion.offsetDifference}
              </text>
            )}
          </>
        )}

        {/* Entity markers (cities and airports) */}
        <EntityLayer
          entities={projectedEntities}
          hitRadii={hitRadii}
          roles={roles}
          hoveredSlug={hoveredEntity?.slug ?? null}
          minorBelow={cityDensity === 'all' ? MINOR_RANK : null}
          zoom={committed.scale}
          onHover={handleHover}
          onClick={handleClick}
        />

        <LabelLayer labels={cityLabels} font={labelUnits * zoomInv} />
      </svg>

      </div>

      {/* Source and target keep their card on screen; pointing at one grows it.
          Same component and anchor as any other dot's card, so clicking a dot
          to convert it doesn't swap one card for another. */}
      {pinnedLabels?.src && pinnedLabels.src.city && pinnedLabels.src.time && (
        <EntityCard
          entity={pinnedLabels.src.entity}
          x={pinnedLabels.src.x}
          y={pinnedLabels.src.y}
          containerWidth={pinnedLabels.containerWidth}
          containerHeight={pinnedLabels.containerHeight}
          placement={pinnedLabels.srcPlacement}
          size={srcIsHovered ? 'full' : 'compact'}
          pinnedTime={pinnedLabels.src.time}
          onHoverChange={(over) => handleHover(over ? pinnedLabels.src!.entity : null)}
          now={now}
          use24h={use24h === true}
          homeCity={homeCity}
        />
      )}
      {pinnedLabels?.tgt && pinnedLabels.tgt.city && pinnedLabels.tgt.time && (
        <EntityCard
          entity={pinnedLabels.tgt.entity}
          x={pinnedLabels.tgt.x}
          y={pinnedLabels.tgt.y}
          containerWidth={pinnedLabels.containerWidth}
          containerHeight={pinnedLabels.containerHeight}
          placement={pinnedLabels.tgtPlacement}
          size={tgtIsHovered ? 'full' : 'compact'}
          pinnedTime={pinnedLabels.tgt.time}
          onHoverChange={(over) => handleHover(over ? pinnedLabels.tgt!.entity : null)}
          now={now}
          use24h={use24h === true}
          homeCity={homeCity}
        />
      )}

      {/* Above the layers button; bottom-right belongs to the time control. */}
      {!isMobile && (
        <div className="absolute bottom-16 left-4 z-40">
          <MapZoomControl
            zoom={live.scale}
            min={MIN_ZOOM}
            onZoom={stepZoom}
            onReset={resetZoom}
          />
        </div>
      )}

      {/* Any other dot, once the cursor has settled. */}
      {settledEntity && hoveredEntity && hoverPos && containerRect && !hoveredIsPinned && (
        <EntityCard
          entity={hoveredEntity}
          x={hoverPos.x}
          y={hoverPos.y}
          containerWidth={containerRect.width}
          containerHeight={containerRect.height}
          placement="above"
          size="full"
          onHoverChange={(over) => handleHover(over ? hoveredEntity : null)}
          now={now}
          use24h={use24h === true}
          homeCity={homeCity}
        />
      )}
    </div>
  )
}

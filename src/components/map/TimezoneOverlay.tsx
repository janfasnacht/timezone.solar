import { memo, useMemo, useState, useCallback } from 'react'
import { IANAZone } from 'luxon'
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import type { GeoPath, GeoPermissibleObjects } from 'd3-geo'

type TzData = FeatureCollection<Geometry, GeoJsonProperties>

interface TimezoneOverlayProps {
  data: TzData
  pathGenerator: GeoPath<unknown, GeoPermissibleObjects>
  /** Map zoom. The tooltip is drawn in map units, so every measurement on it
   *  divides this out to hold one size on screen. */
  zoom?: number
  /** Zones the query named outright rather than by place. Their bands are lit,
   *  the rest fall back, and each carries the answer the card would have. */
  highlight?: readonly HighlightedZone[]
}

export interface HighlightedZone {
  /** Offset from UTC in minutes — how the layer groups its shapes. */
  offset: number
  /** What the band says: the zone and its time. */
  label: string
}

function getZoneColor(offsetMinutes: number): string {
  const hours = Math.round(offsetMinutes / 60)
  const index = ((hours + 12) % 25 + 25) % 25
  return `hsl(${index * 14.4}, 35%, 55%)`
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (minutes === 0) return 'UTC'
  return m ? `UTC${sign}${h}:${String(m).padStart(2, '0')}` : `UTC${sign}${h}`
}

/**
 * An offset costs an Intl formatter to work out and doesn't depend on the
 * projection, so the four hundred are resolved once per dataset rather than
 * alongside the paths. A zone the tz database lacks is dropped, not guessed.
 */
const offsetCache = new WeakMap<TzData, Map<string, number>>()

function offsetsFor(data: TzData): Map<string, number> {
  const cached = offsetCache.get(data)
  if (cached) return cached
  const at = Date.now()
  const offsets = new Map<string, number>()
  for (const feat of data.features) {
    const tzid = feat.properties?.tzid as string | undefined
    if (!tzid || offsets.has(tzid)) continue
    const zone = IANAZone.create(tzid)
    if (zone.isValid) offsets.set(tzid, zone.offset(at))
  }
  offsetCache.set(data, offsets)
  return offsets
}

interface MergedZone {
  d: string
  fill: string
  offset: number
  /** Kept so a lit band can be measured for its label; unused otherwise. */
  features: Feature[]
}

interface BandsProps {
  zones: readonly MergedZone[]
  hoveredOffset: number | null
  highlight: readonly HighlightedZone[]
  onMove: (offset: number, e: React.MouseEvent<SVGPathElement>) => void
  onLeave: () => void
}

const LIT = 0.42
const HOVERED = 0.25
const RESTING = 0.1
/** What the rest of the world falls back to once one band is the answer. */
const BESIDE_LIT = 0.05

/** One path per offset, and the map's largest geometry — kept out of the
 *  gesture's render path so a wheel tick doesn't touch it. */
const Bands = memo(function Bands({ zones, hoveredOffset, highlight, onMove, onLeave }: BandsProps) {
  const anyLit = highlight.length > 0
  const opacityOf = (offset: number) => {
    if (highlight.some((h) => h.offset === offset)) return LIT
    if (hoveredOffset === offset) return HOVERED
    return anyLit ? BESIDE_LIT : RESTING
  }
  return (
    <>
      {zones.map(({ d, fill, offset }) => (
        <path
          key={offset}
          d={d}
          fill={fill}
          fillOpacity={opacityOf(offset)}
          stroke="none"
          style={{ transition: 'fill-opacity 150ms', cursor: 'crosshair' }}
          onMouseMove={(e) => onMove(offset, e)}
          onMouseLeave={onLeave}
        />
      ))}
    </>
  )
})

const NO_HIGHLIGHT: readonly HighlightedZone[] = []

export function TimezoneOverlay({
  data,
  pathGenerator,
  zoom = 1,
  highlight = NO_HIGHLIGHT,
}: TimezoneOverlayProps) {
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const mergedZones = useMemo(() => {
    const offsets = offsetsFor(data)
    const byOffset = new Map<number, { paths: string[]; features: Feature[] }>()
    for (const feat of data.features) {
      const tzid = feat.properties?.tzid as string | undefined
      const offset = tzid ? offsets.get(tzid) : undefined
      if (offset === undefined) continue
      const d = pathGenerator(feat as GeoPermissibleObjects)
      if (!d) continue
      const bucket = byOffset.get(offset) ?? { paths: [], features: [] }
      bucket.paths.push(d)
      bucket.features.push(feat)
      byOffset.set(offset, bucket)
    }
    const zones: MergedZone[] = []
    for (const [offset, { paths, features }] of byOffset) {
      zones.push({ d: paths.join(' '), fill: getZoneColor(offset), offset, features })
    }
    return zones
  }, [data, pathGenerator])

  const handleMouseMove = useCallback(
    (offset: number, e: React.MouseEvent<SVGPathElement>) => {
      const svg = e.currentTarget.ownerSVGElement
      if (!svg) return
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const svgPt = pt.matrixTransform(ctm.inverse())
      setHoveredOffset(offset)
      setMousePos({ x: svgPt.x, y: svgPt.y })
    },
    []
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredOffset(null)
    setMousePos(null)
  }, [])

  /**
   * The card view names the zone and its time; on the map the band has to. On
   * the area-weighted centre, so the label lands on the mainland rather than
   * halfway to whichever island shares the offset. Measured only when lit.
   */
  const litLabels = useMemo(
    () =>
      highlight.flatMap((zone) => {
        const band = mergedZones.find((z) => z.offset === zone.offset)
        if (!band) return []
        const at = pathGenerator.centroid({
          type: 'FeatureCollection',
          features: band.features,
        } as unknown as GeoPermissibleObjects)
        if (!Number.isFinite(at[0]) || !Number.isFinite(at[1])) return []
        return [{ ...zone, at }]
      }),
    [highlight, mergedZones, pathGenerator]
  )

  const tooltipLabel = hoveredOffset !== null ? formatOffset(hoveredOffset) : ''
  const tooltipWidth = (tooltipLabel.length * 6 + 16) / zoom
  const tooltipHeight = 20 / zoom
  const gap = 10 / zoom

  return (
    <g className="timezone-overlay" style={{ transition: 'opacity 200ms ease-out' }}>
      <Bands
        zones={mergedZones}
        hoveredOffset={hoveredOffset}
        highlight={highlight}
        onMove={handleMouseMove}
        onLeave={handleMouseLeave}
      />

      {litLabels.map(({ offset, label, at }) => {
        const width = (label.length * 6 + 18) / zoom
        const height = 22 / zoom
        return (
          <g key={offset} style={{ pointerEvents: 'none' }}>
            <rect
              x={at[0] - width / 2}
              y={at[1] - height / 2}
              width={width}
              height={height}
              rx={5 / zoom}
              fill="var(--color-surface)"
              fillOpacity={0.94}
              stroke="var(--color-accent)"
              strokeOpacity={0.5}
              strokeWidth={0.6 / zoom}
            />
            <text
              x={at[0]}
              y={at[1]}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--color-foreground)"
              fontSize={9.5 / zoom}
              fontFamily="var(--font-mono)"
            >
              {label}
            </text>
          </g>
        )
      })}

      {hoveredOffset !== null && mousePos && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={mousePos.x + gap}
            y={mousePos.y - tooltipHeight / 2}
            width={tooltipWidth}
            height={tooltipHeight}
            rx={4 / zoom}
            fill="var(--color-surface)"
            fillOpacity={0.92}
            stroke="var(--color-border)"
            strokeWidth={0.5 / zoom}
          />
          <text
            x={mousePos.x + gap + tooltipWidth / 2}
            y={mousePos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-foreground)"
            fontSize={9 / zoom}
            fontFamily="var(--font-mono)"
          >
            {tooltipLabel}
          </text>
        </g>
      )}
    </g>
  )
}

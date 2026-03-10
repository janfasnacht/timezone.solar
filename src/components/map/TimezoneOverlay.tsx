import { useMemo, useState, useCallback } from 'react'
import { DateTime } from 'luxon'
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import type { GeoPath, GeoPermissibleObjects } from 'd3-geo'

interface TimezoneOverlayProps {
  data: FeatureCollection<Geometry, GeoJsonProperties>
  pathGenerator: GeoPath<unknown, GeoPermissibleObjects>
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

interface MergedZone {
  d: string
  fill: string
  offset: number
}

export function TimezoneOverlay({
  data,
  pathGenerator,
}: TimezoneOverlayProps) {
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  const mergedZones = useMemo(() => {
    const byOffset = new Map<number, string[]>()
    for (const feat of data.features) {
      const tzid = feat.properties?.tzid as string | undefined
      if (!tzid) continue
      const offset = DateTime.now().setZone(tzid).offset
      const d = pathGenerator(feat as GeoPermissibleObjects)
      if (d) {
        const paths = byOffset.get(offset) ?? []
        paths.push(d)
        byOffset.set(offset, paths)
      }
    }
    const zones: MergedZone[] = []
    for (const [offset, paths] of byOffset) {
      zones.push({
        d: paths.join(' '),
        fill: getZoneColor(offset),
        offset,
      })
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

  const tooltipLabel = hoveredOffset !== null ? formatOffset(hoveredOffset) : ''
  const tooltipWidth = tooltipLabel.length * 6 + 16

  return (
    <g className="timezone-overlay" style={{ transition: 'opacity 200ms ease-out' }}>
      {mergedZones.map(({ d, fill, offset }) => (
        <path
          key={offset}
          d={d}
          fill={fill}
          fillOpacity={hoveredOffset === offset ? 0.25 : 0.1}
          stroke="none"
          style={{ transition: 'fill-opacity 150ms', cursor: 'crosshair' }}
          onMouseMove={(e) => handleMouseMove(offset, e)}
          onMouseLeave={handleMouseLeave}
        />
      ))}

      {hoveredOffset !== null && mousePos && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={mousePos.x + 10}
            y={mousePos.y - 10}
            width={tooltipWidth}
            height={20}
            rx={4}
            fill="var(--color-surface)"
            fillOpacity={0.92}
            stroke="var(--color-border)"
            strokeWidth={0.5}
          />
          <text
            x={mousePos.x + 10 + tooltipWidth / 2}
            y={mousePos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-foreground)"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            {tooltipLabel}
          </text>
        </g>
      )}
    </g>
  )
}

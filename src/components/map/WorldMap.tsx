import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import land110m from 'world-atlas/land-110m.json'
import { getSolarTerminator } from '@/engine/solar'
import { getMapCities, findCityForMap } from '@/engine/map-cities'
import type { CityEntity } from '@/engine/city-entities'
import type { HomeCity } from '@/lib/preferences'
import { CityDot, type CityRole } from './CityDot'
import { CityHoverCard } from './CityHoverCard'
import { PinnedCityLabel } from './PinnedCityLabel'

const WIDTH = 960
const HEIGHT = 500

export interface MapConversion {
  sourceCity: string
  targetCity: string
  sourceTime: string
  targetTime: string
  offsetDifference: string
  isPreview?: boolean
}

interface WorldMapProps {
  now: Date
  use24h: boolean
  homeCity: HomeCity | null
  conversion?: MapConversion | null
  onCityClick?: (cityName: string) => void
}

export function WorldMap({ now, use24h, homeCity, conversion, onCityClick }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredCity, setHoveredCity] = useState<CityEntity | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

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

  const graticulePath = useMemo(
    () => pathGenerator(geoGraticule10()) || '',
    [pathGenerator]
  )

  const terminatorPath = useMemo(() => {
    const terminator = getSolarTerminator(now)
    return pathGenerator(terminator) || ''
  }, [pathGenerator, now])

  const baseCities = useMemo(() => getMapCities(), [])

  // Same-city guard
  const isSameCity = conversion
    ? conversion.sourceCity.toLowerCase() === conversion.targetCity.toLowerCase()
    : false

  const effectiveConversion = isSameCity ? null : conversion

  // Merge dynamic cities into the base set
  const cities = useMemo(() => {
    if (!effectiveConversion) return baseCities
    const slugs = new Set(baseCities.map((c) => c.slug))
    const extras: CityEntity[] = []
    for (const name of [effectiveConversion.sourceCity, effectiveConversion.targetCity]) {
      if (!name) continue
      const entity = findCityForMap(name)
      if (entity && !slugs.has(entity.slug)) {
        extras.push(entity)
        slugs.add(entity.slug)
      }
    }
    return extras.length > 0 ? [...baseCities, ...extras] : baseCities
  }, [baseCities, effectiveConversion])

  const projectedCities = useMemo(
    () =>
      cities
        .map((city) => {
          const point = projection([city.lng, city.lat])
          if (!point) return null
          return { city, x: point[0], y: point[1] }
        })
        .filter(
          (c): c is { city: CityEntity; x: number; y: number } => c !== null
        ),
    [cities, projection]
  )

  const { sourceProjected, targetProjected } = useMemo(() => {
    if (!effectiveConversion) return { sourceProjected: null, targetProjected: null }
    const src = projectedCities.find(
      (c) => c.city.displayName.toLowerCase() === effectiveConversion.sourceCity.toLowerCase()
    )
    const tgt = projectedCities.find(
      (c) => c.city.displayName.toLowerCase() === effectiveConversion.targetCity.toLowerCase()
    )
    return { sourceProjected: src ?? null, targetProjected: tgt ?? null }
  }, [effectiveConversion, projectedCities])

  // Curved arc between source and target
  const arcData = useMemo(() => {
    if (!sourceProjected || !targetProjected) return null
    const sx = sourceProjected.x
    const sy = sourceProjected.y
    const tx = targetProjected.x
    const ty = targetProjected.y
    const cpx = (sx + tx) / 2
    const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2)
    const bulge = Math.min(dist * 0.25, 60)
    const cpy = (sy + ty) / 2 - bulge
    // Actual midpoint on the quadratic bezier at t=0.5
    const midX = 0.25 * sx + 0.5 * cpx + 0.25 * tx
    const midY = 0.25 * sy + 0.5 * cpy + 0.25 * ty
    return {
      d: `M${sx},${sy} Q${cpx},${cpy} ${tx},${ty}`,
      midX,
      midY,
    }
  }, [sourceProjected, targetProjected])

  const svgRef = useRef<SVGSVGElement>(null)
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null)

  const handleHover = useCallback(
    (city: CityEntity | null) => {
      setHoveredCity(city)
      if (city && svgRef.current && containerRef.current) {
        const projected = projectedCities.find((c) => c.city.slug === city.slug)
        if (projected) {
          const svgRect = svgRef.current.getBoundingClientRect()
          const cRect = containerRef.current.getBoundingClientRect()
          const scaleX = svgRect.width / WIDTH
          const scaleY = svgRect.height / HEIGHT
          const offsetX = (cRect.width - svgRect.width) / 2
          const offsetY = (cRect.height - svgRect.height) / 2
          setScreenPos({
            x: projected.x * scaleX + offsetX,
            y: projected.y * scaleY + offsetY,
          })
          setContainerRect(cRect)
        }
      } else {
        setScreenPos(null)
      }
    },
    [projectedCities]
  )

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect())
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleClick = useCallback(
    (city: CityEntity) => {
      if (onCityClick) {
        onCityClick(city.displayName)
      } else {
        window.location.href = `/?q=${encodeURIComponent(city.displayName)}`
      }
    },
    [onCityClick]
  )

  function getCityRole(city: CityEntity): CityRole {
    if (!effectiveConversion) return 'none'
    const name = city.displayName.toLowerCase()
    if (name === effectiveConversion.sourceCity.toLowerCase()) return 'source'
    if (name === effectiveConversion.targetCity.toLowerCase()) return 'target'
    return 'none'
  }

  const isPreview = effectiveConversion?.isPreview ?? false
  const arcOpacity = isPreview ? 0.2 : 0.45
  const labelOpacity = isPreview ? 0.35 : 0.75

  // Compute screen positions for pinned city labels
  const pinnedLabels = useMemo(() => {
    if (!effectiveConversion || !svgRef.current || !containerRef.current) return null
    const svgRect = svgRef.current.getBoundingClientRect()
    const cRect = containerRef.current.getBoundingClientRect()
    const scaleX = svgRect.width / WIDTH
    const scaleY = svgRect.height / HEIGHT
    const offsetX = (cRect.width - svgRect.width) / 2
    const offsetY = (cRect.height - svgRect.height) / 2

    const toScreen = (projected: { x: number; y: number }) => ({
      x: projected.x * scaleX + offsetX,
      y: projected.y * scaleY + offsetY,
    })

    const src = sourceProjected ? { ...toScreen(sourceProjected), city: effectiveConversion.sourceCity, time: effectiveConversion.sourceTime } : null
    const tgt = targetProjected ? { ...toScreen(targetProjected), city: effectiveConversion.targetCity, time: effectiveConversion.targetTime } : null

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

    return { src, tgt, srcPlacement, tgtPlacement, containerWidth: cRect.width, containerHeight: cRect.height }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveConversion, sourceProjected, targetProjected, containerRect])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <rect width={WIDTH} height={HEIGHT} fill="var(--color-background)" />

        <path
          d={graticulePath}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={0.4}
          strokeOpacity={0.7}
        />

        <path d={landPath} fill="var(--color-muted)" stroke="var(--color-border)" strokeWidth={0.5} />

        <path
          d={terminatorPath}
          fill="rgba(0, 0, 0, 0.25)"
          className="dark:fill-[rgba(0,0,0,0.4)]"
        />

        {/* Connection arc */}
        {arcData && (
          <>
            <path
              d={arcData.d}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.2}
              strokeOpacity={arcOpacity}
              strokeDasharray="4 3"
            />
            {/* Offset label — sits on the arc midpoint */}
            {effectiveConversion && effectiveConversion.offsetDifference && (
              <text
                x={arcData.midX}
                y={arcData.midY - 4}
                textAnchor="middle"
                fill="var(--color-accent)"
                fontSize={8}
                fontFamily="var(--font-mono)"
                opacity={labelOpacity}
              >
                {effectiveConversion.offsetDifference}
              </text>
            )}
          </>
        )}

        {/* City dots */}
        {projectedCities.map(({ city, x, y }) => (
          <CityDot
            key={city.slug}
            city={city}
            x={x}
            y={y}
            role={getCityRole(city)}
            onHover={handleHover}
            onClick={handleClick}
          />
        ))}
      </svg>

      {/* Pinned city labels for source/target */}
      {pinnedLabels?.src && pinnedLabels.src.city && pinnedLabels.src.time && (
        <PinnedCityLabel
          cityName={pinnedLabels.src.city}
          time={pinnedLabels.src.time}
          x={pinnedLabels.src.x}
          y={pinnedLabels.src.y}
          containerWidth={pinnedLabels.containerWidth}
          containerHeight={pinnedLabels.containerHeight}
          placement={pinnedLabels.srcPlacement}
        />
      )}
      {pinnedLabels?.tgt && pinnedLabels.tgt.city && pinnedLabels.tgt.time && (
        <PinnedCityLabel
          cityName={pinnedLabels.tgt.city}
          time={pinnedLabels.tgt.time}
          x={pinnedLabels.tgt.x}
          y={pinnedLabels.tgt.y}
          containerWidth={pinnedLabels.containerWidth}
          containerHeight={pinnedLabels.containerHeight}
          placement={pinnedLabels.tgtPlacement}
        />
      )}

      {hoveredCity && screenPos && (
        <CityHoverCard
          city={hoveredCity}
          x={screenPos.x}
          y={screenPos.y}
          containerRect={containerRect}
          now={now}
          use24h={use24h === true}
          homeCity={homeCity}
        />
      )}
    </div>
  )
}

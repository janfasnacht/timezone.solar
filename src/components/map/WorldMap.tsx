import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import land110m from 'world-atlas/land-110m.json'
import { getSolarTerminator } from '@/engine/solar'
import { getMapCities } from '@/engine/map-cities'
import type { CityEntity } from '@/engine/city-entities'
import type { HomeCity } from '@/lib/preferences'
import { CityDot } from './CityDot'
import { CityHoverCard } from './CityHoverCard'

const WIDTH = 960
const HEIGHT = 500

interface WorldMapProps {
  now: Date
  use24h: boolean
  homeCity: HomeCity | null
}

export function WorldMap({ now, use24h, homeCity }: WorldMapProps) {
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

  const cities = useMemo(() => getMapCities(), [])

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

  const svgRef = useRef<SVGSVGElement>(null)
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(
    null
  )

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

  // Update container rect on resize for hover card edge detection
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

  const handleClick = useCallback((city: CityEntity) => {
    window.location.href = `/?q=${encodeURIComponent(city.displayName)}`
  }, [])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        {/* Ocean background */}
        <rect width={WIDTH} height={HEIGHT} fill="var(--color-background)" />

        {/* Graticule grid */}
        <path
          d={graticulePath}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={0.4}
          strokeOpacity={0.7}
        />

        {/* Land masses */}
        <path d={landPath} fill="var(--color-muted)" stroke="var(--color-border)" strokeWidth={0.5} />

        {/* Day/night terminator */}
        <path
          d={terminatorPath}
          fill="rgba(0, 0, 0, 0.25)"
          className="dark:fill-[rgba(0,0,0,0.4)]"
        />

        {/* City dots */}
        {projectedCities.map(({ city, x, y }) => (
          <CityDot
            key={city.slug}
            city={city}
            x={x}
            y={y}
            isHome={homeCity?.city === city.displayName}
            onHover={handleHover}
            onClick={handleClick}
          />
        ))}
      </svg>

      {/* Hover card (HTML overlay) */}
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

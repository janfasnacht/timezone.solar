import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import land110m from 'world-atlas/land-110m.json'
import countries110m from 'world-atlas/countries-110m.json'
import { getSolarTerminator } from '@/engine/solar'
import { getMapCities, getAllMapCities, findCityForMap } from '@/engine/map-cities'
import type { CityEntity } from '@/engine/city-entities'
import type { HomeCity } from '@/lib/preferences'
import { CityDot, type CityRole } from './CityDot'
import { CityHoverCard } from './CityHoverCard'
import { PinnedCityLabel } from './PinnedCityLabel'
import { TimezoneOverlay } from './TimezoneOverlay'
import { useTimezoneData } from '@/hooks/useTimezoneData'

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

export type CityDensity = 'none' | 'main' | 'all'

interface WorldMapProps {
  now: Date
  use24h: boolean
  homeCity: HomeCity | null
  conversion?: MapConversion | null
  onCityClick?: (cityName: string) => void
  showTimezones?: boolean
  showBorders?: boolean
  showGrid?: boolean
  cityDensity?: CityDensity
}

export function WorldMap({ now, use24h, homeCity, conversion, onCityClick, showTimezones = false, showBorders = false, showGrid = true, cityDensity = 'main' }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredCity, setHoveredCity] = useState<CityEntity | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  // Pan/zoom state for touch gestures
  const [mapTransform, setMapTransform] = useState({ x: 0, y: 0, scale: 1 })
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
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

  const mapCities = useMemo(() => getMapCities(), [])
  const allCities = useMemo(() => getAllMapCities(), [])
  const mapSlugs = useMemo(() => new Set(mapCities.map((c) => c.slug)), [mapCities])

  // Same-city guard
  const isSameCity = conversion
    ? conversion.sourceCity.toLowerCase() === conversion.targetCity.toLowerCase()
    : false

  const effectiveConversion = isSameCity ? null : conversion

  // Merge dynamic cities into the base set
  const cities = useMemo(() => {
    if (cityDensity === 'none') {
      // Still show source/target cities even in 'none' mode
      if (!effectiveConversion) return []
      const extras: CityEntity[] = []
      for (const name of [effectiveConversion.sourceCity, effectiveConversion.targetCity]) {
        if (!name) continue
        const entity = findCityForMap(name)
        if (entity) extras.push(entity)
      }
      return extras
    }

    const baseCities = cityDensity === 'all' ? allCities : mapCities
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
  }, [cityDensity, mapCities, allCities, effectiveConversion])

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

  // Touch gesture handlers for pan/zoom
  const updateTransform = useCallback((t: { x: number; y: number; scale: number }) => {
    transformRef.current = t
    setMapTransform(t)
  }, [])

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
      const newScale = Math.max(1, Math.min(5, g.startScale * (dist / g.startDist)))
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
      if (t.scale <= 1.05) {
        updateTransform({ x: 0, y: 0, scale: 1 })
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

  const arcOpacity = 0.45
  const labelOpacity = 0.75

  // Check if hovered city is a pinned city (source or target)
  const hoveredIsPinned = hoveredCity && effectiveConversion
    ? hoveredCity.displayName.toLowerCase() === effectiveConversion.sourceCity.toLowerCase() ||
      hoveredCity.displayName.toLowerCase() === effectiveConversion.targetCity.toLowerCase()
    : false

  // Compute screen positions for pinned city labels
  const pinnedLabels = useMemo(() => {
    if (!effectiveConversion || !containerRef.current) return null
    // Use layout dimensions (unaffected by CSS transform) with slice-aware mapping
    const vpW = containerRef.current.offsetWidth
    const vpH = containerRef.current.offsetHeight
    const sx = vpW / WIDTH
    const sy = vpH / HEIGHT
    const mapScale = Math.max(sx, sy) // preserveAspectRatio="xMidYMid slice"
    const offsetX = (vpW - WIDTH * mapScale) / 2
    const offsetY = (vpH - HEIGHT * mapScale) / 2

    const toScreen = (projected: { x: number; y: number }) => ({
      x: projected.x * mapScale + offsetX,
      y: projected.y * mapScale + offsetY,
    })

    const src = sourceProjected ? { ...toScreen(sourceProjected), city: effectiveConversion.sourceCity, time: effectiveConversion.sourceTime, entity: sourceProjected.city } : null
    const tgt = targetProjected ? { ...toScreen(targetProjected), city: effectiveConversion.targetCity, time: effectiveConversion.targetTime, entity: targetProjected.city } : null

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveConversion, sourceProjected, targetProjected, containerRect])

  // Determine variant for each pinned label
  const srcIsHovered = hoveredCity && pinnedLabels?.src?.entity
    ? hoveredCity.slug === pinnedLabels.src.entity.slug
    : false
  const tgtIsHovered = hoveredCity && pinnedLabels?.tgt?.entity
    ? hoveredCity.slug === pinnedLabels.tgt.entity.slug
    : false

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <div
        className="relative w-full h-full"
        style={{
          transform: mapTransform.scale === 1 && mapTransform.x === 0 && mapTransform.y === 0
            ? undefined
            : `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.scale})`,
          transformOrigin: '0 0',
          touchAction: 'none',
        }}
        onTouchStart={handleMapTouchStart}
        onTouchMove={handleMapTouchMove}
        onTouchEnd={handleMapTouchEnd}
      >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <rect width={WIDTH} height={HEIGHT} fill="var(--color-background)" />

        {showGrid && (
          <path
            d={graticulePath}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={0.4}
            strokeOpacity={0.7}
          />
        )}

        <path d={landPath} fill="var(--color-muted)" stroke="var(--color-border)" strokeWidth={0.5} />

        {showBorders && (
          <path
            d={countriesPath}
            fill="none"
            stroke="var(--color-muted-foreground)"
            strokeWidth={0.3}
            strokeOpacity={0.5}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {tzData && (
          <TimezoneOverlay
            data={tzData}
            pathGenerator={pathGenerator}
          />
        )}

        <path
          d={terminatorPath}
          fill="rgba(0, 0, 0, 0.25)"
          className="dark:fill-[rgba(0,0,0,0.4)]"
          style={{ pointerEvents: 'none' }}
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
            minor={cityDensity === 'all' && !mapSlugs.has(city.slug)}
            onHover={handleHover}
            onClick={handleClick}
          />
        ))}
      </svg>

      {/* Pinned city labels for source/target — expand on hover */}
      {pinnedLabels?.src && pinnedLabels.src.city && pinnedLabels.src.time && (
        <PinnedCityLabel
          cityName={pinnedLabels.src.city}
          time={pinnedLabels.src.time}
          x={pinnedLabels.src.x}
          y={pinnedLabels.src.y}
          containerWidth={pinnedLabels.containerWidth}
          containerHeight={pinnedLabels.containerHeight}
          placement={pinnedLabels.srcPlacement}
          variant={srcIsHovered ? 'expanded' : 'active'}
          iana={pinnedLabels.src.entity.iana}
          country={pinnedLabels.src.entity.country}
          now={now}
          use24h={use24h}
          homeCity={homeCity}
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
          variant={tgtIsHovered ? 'expanded' : 'active'}
          iana={pinnedLabels.tgt.entity.iana}
          country={pinnedLabels.tgt.entity.country}
          now={now}
          use24h={use24h}
          homeCity={homeCity}
        />
      )}
      </div>

      {/* Hover card for non-pinned cities only */}
      {hoveredCity && screenPos && !hoveredIsPinned && (
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

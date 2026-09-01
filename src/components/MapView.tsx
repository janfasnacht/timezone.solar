import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { MapLayersControl, type MapLayers } from '@/components/map/MapLayersControl'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { WorldMap, type MapConversion } from '@/components/map/WorldMap'
import type { ConversionResult } from '@/engine/types'
import type { HomeCity } from '@/lib/preferences'

interface MapViewProps {
  result: ConversionResult | null
  homeCity: HomeCity | null
  use24h: boolean
  /** True when the query asked for no time, so the map should follow the clock. */
  isLive: boolean
  onCityClick: (cityName: string) => void
  isMobile?: boolean
}

export default function MapView({
  result,
  homeCity,
  use24h,
  isLive,
  onCityClick,
  isMobile = false,
}: MapViewProps) {
  const liveTick = useMinuteTick()
  // A result with an explicit time is a fixed instant; one without keeps up with
  // the clock. The nudge lives in the query now, so there is nothing else to add.
  const displayTime = useMemo(() => {
    if (result && !isLive) {
      const dt = DateTime.fromISO(result.sourceDateTime)
      if (dt.isValid) return dt.toJSDate()
    }
    return liveTick
  }, [result, isLive, liveTick])
  const [layers, setLayers] = useState<MapLayers>({
    showGrid: true,
    showBorders: false,
    showTimezones: false,
    cityDensity: 'main',
  })
  const updateLayers = (next: Partial<MapLayers>) => setLayers((prev) => ({ ...prev, ...next }))

  const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'

  const conversion: MapConversion | null = useMemo(() => {
    if (!result) return null
    return {
      sourceCity: result.source.city,
      targetCity: result.target.city,
      sourceTime: result.source[timeKey],
      targetTime: result.target[timeKey],
      offsetDifference: result.offsetDifference,
    }
  }, [result, timeKey])

  return (
    <div className="h-full w-full relative">
      <WorldMap
        now={displayTime}
        use24h={use24h}
        homeCity={homeCity}
        conversion={conversion}
        onCityClick={onCityClick}
        showTimezones={layers.showTimezones}
        showBorders={layers.showBorders}
        showGrid={layers.showGrid}
        cityDensity={layers.cityDensity}
      />

      {/* Bottom controls — on mobile: horizontal bar above tab bar; on desktop: corners */}
      {isMobile ? (
        <div
          className="absolute right-0 bottom-0 left-0 z-40 flex items-center gap-2 bg-gradient-to-t from-background/60 to-transparent px-3 pt-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
        >
          <MapLayersControl layers={layers} onChange={updateLayers} roomy />
        </div>
      ) : (
        <>
          <div className="absolute bottom-4 left-4 z-40">
            <MapLayersControl layers={layers} onChange={updateLayers} />
          </div>
        </>
      )}
    </div>
  )
}

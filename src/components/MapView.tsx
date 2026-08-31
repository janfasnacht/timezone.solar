import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { TimeOffsetControl } from '@/components/TimeOffsetControl'
import { MapLayersControl, type MapLayers } from '@/components/map/MapLayersControl'
import type { TimeOffset } from '@/hooks/useTimeOffset'
import { WorldMap, type MapConversion } from '@/components/map/WorldMap'
import type { ConversionResult } from '@/engine/types'
import type { HomeCity } from '@/lib/preferences'

interface MapViewProps {
  result: ConversionResult | null
  homeCity: HomeCity | null
  use24h: boolean
  /** Shared with the card view, so a nudge survives switching renderings. */
  offset: TimeOffset
  onCityClick: (cityName: string) => void
  isMobile?: boolean
}

export default function MapView({
  result,
  homeCity,
  use24h,
  offset,
  onCityClick,
  isMobile = false,
}: MapViewProps) {
  const { offsetMinutes, displayTime } = offset
  const [layers, setLayers] = useState<MapLayers>({
    showGrid: true,
    showBorders: false,
    showTimezones: false,
    cityDensity: 'main',
  })
  const updateLayers = (next: Partial<MapLayers>) => setLayers((prev) => ({ ...prev, ...next }))

  const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'

  // Real conversion → map data (times adjust with nudge offset)
  const conversion: MapConversion | null = useMemo(() => {
    if (!result) return null
    if (offsetMinutes === 0) {
      return {
        sourceCity: result.source.city,
        targetCity: result.target.city,
        sourceTime: result.source[timeKey],
        targetTime: result.target[timeKey],
        offsetDifference: result.offsetDifference,
      }
    }
    // Recompute times with offset applied
    const fmt = use24h ? 'HH:mm' : 'h:mm a'
    const srcDt = DateTime.fromISO(result.sourceDateTime).setZone(result.source.iana).plus({ minutes: offsetMinutes })
    const tgtDt = DateTime.fromISO(result.targetDateTime).setZone(result.target.iana).plus({ minutes: offsetMinutes })
    return {
      sourceCity: result.source.city,
      targetCity: result.target.city,
      sourceTime: srcDt.isValid ? srcDt.toFormat(fmt) : result.source[timeKey],
      targetTime: tgtDt.isValid ? tgtDt.toFormat(fmt) : result.target[timeKey],
      offsetDifference: result.offsetDifference,
    }
  }, [result, timeKey, offsetMinutes, use24h])

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
        <div className="absolute bottom-0 left-0 right-0 z-40 flex items-center gap-2 px-3 pb-2 pt-5 bg-gradient-to-t from-background/60 to-transparent">
          <MapLayersControl layers={layers} onChange={updateLayers} roomy />
          {/* Spacer */}
          <div className="flex-1" />

          <TimeOffsetControl offset={offset} roomy />
        </div>
      ) : (
        <>
          <div className="absolute bottom-4 left-4 z-40">
            <MapLayersControl layers={layers} onChange={updateLayers} />
          </div>
          <div className="absolute right-4 bottom-4 z-40">
            <TimeOffsetControl offset={offset} />
          </div>
        </>
      )}
    </div>
  )
}

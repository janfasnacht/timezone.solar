import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { TimeOffsetControl } from '@/components/TimeOffsetControl'
import { MapLayersControl, type MapLayers } from '@/components/map/MapLayersControl'
import { lookupEntity } from '@/engine/entities'
import type { TimeOffset } from '@/hooks/useTimeOffset'
import { WorldMap, type MapConversion } from '@/components/map/WorldMap'
import type { ConversionResult } from '@/engine/types'
import type { HomeCity } from '@/lib/preferences'
import type { PreviewCities } from '@/hooks/useRotatingPlaceholder'

interface MapViewProps {
  result: ConversionResult | null
  homeCity: HomeCity | null
  use24h: boolean
  /** True while the shared QueryInput holds text — suppresses the idle preview arc. */
  hasQuery: boolean
  /** Shared with the card view, so a nudge survives switching renderings. */
  offset: TimeOffset
  onCityClick: (cityName: string) => void
  previewCities: PreviewCities
  isMobile?: boolean
}

export default function MapView({
  result,
  homeCity,
  use24h,
  hasQuery,
  offset,
  onCityClick,
  previewCities,
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

  const homeCityName = homeCity?.city ?? null

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

  // Preview: compute times from IANA timezones, use homeCity as implicit source
  const previewConversion: MapConversion | null = useMemo(() => {
    if (result || hasQuery) return null
    if (!previewCities.target) return null

    const targetEntity = lookupEntity(previewCities.target)
    if (!targetEntity) return null

    const now = DateTime.now()
    const targetTime = now.setZone(targetEntity.iana).toFormat(use24h ? 'HH:mm' : 'h:mm a')

    // Use explicit source from example, or fall back to homeCity
    const sourceName = previewCities.source ?? homeCityName
    let sourceTime = ''
    let sourceCity = ''
    let offset = ''

    if (sourceName) {
      const sourceEntity = lookupEntity(sourceName)
      if (sourceEntity) {
        const diffH = (now.setZone(targetEntity.iana).offset - now.setZone(sourceEntity.iana).offset) / 60
        // Same timezone → show target only, no arc/offset
        if (diffH !== 0) {
          sourceCity = sourceName
          sourceTime = now.setZone(sourceEntity.iana).toFormat(use24h ? 'HH:mm' : 'h:mm a')
          const sign = diffH >= 0 ? '+' : ''
          offset = `${sign}${diffH}h`
        }
      }
    }

    return {
      sourceCity,
      targetCity: previewCities.target,
      sourceTime,
      targetTime,
      offsetDifference: offset,
      isPreview: true,
    }
  }, [result, hasQuery, previewCities, use24h, homeCityName])

  return (
    <div className="h-full w-full relative">
      <WorldMap
        now={displayTime}
        use24h={use24h}
        homeCity={homeCity}
        conversion={conversion ?? previewConversion}
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

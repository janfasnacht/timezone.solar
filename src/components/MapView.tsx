import { useMemo, useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react'
import { DateTime } from 'luxon'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { parse } from '@/engine/parser'
import { lookupEntity } from '@/engine/city-entities'
import { WorldMap, type MapConversion } from '@/components/map/WorldMap'
import type { ConversionResult } from '@/engine/types'
import type { HomeCity } from '@/lib/preferences'
import type { PreviewCities } from '@/hooks/useRotatingPlaceholder'

interface MapViewProps {
  result: ConversionResult | null
  homeCity: HomeCity | null
  use24h: boolean
  query: string
  onQueryChange: (value: string) => void
  onSubmit: (query: string) => void
  onClear: () => void
  onCityClick: (cityName: string) => void
  onGoHome: () => void
  placeholder: string
  previewCities: PreviewCities
  isProcessing?: boolean
}

export default function MapView({
  result,
  homeCity,
  use24h,
  query,
  onQueryChange,
  onSubmit,
  onClear,
  onCityClick,
  onGoHome,
  placeholder,
  previewCities,
  isProcessing = false,
}: MapViewProps) {
  const liveTick = useMinuteTick()
  const [offsetMinutes, setOffsetMinutes] = useState(0)
  const [timeInput, setTimeInput] = useState('')

  // Reset offset when result changes
  const [prevResult, setPrevResult] = useState(result)
  if (result !== prevResult) {
    setPrevResult(result)
    setOffsetMinutes(0)
    setTimeInput('')
  }

  const baseTime = useMemo(() => {
    if (result) {
      const dt = DateTime.fromISO(result.sourceDateTime)
      if (dt.isValid) return dt.toJSDate()
    }
    return liveTick
  }, [result, liveTick])

  const displayTime = useMemo(() => {
    if (offsetMinutes === 0) return baseTime
    return new Date(baseTime.getTime() + offsetMinutes * 60_000)
  }, [baseTime, offsetMinutes])

  const nudge = useCallback(
    (delta: number) => setOffsetMinutes((prev) => prev + delta),
    []
  )

  const resetOffset = useCallback(() => {
    setOffsetMinutes(0)
    setTimeInput('')
  }, [])

  const isOffset = offsetMinutes !== 0

  const homeIana = homeCity?.iana ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const homeCityName = homeCity?.city ?? null

  const clockLabel = useMemo(() => {
    const dt = DateTime.fromJSDate(displayTime).setZone(homeIana)
    return dt.toFormat(use24h ? 'HH:mm' : 'h:mm a')
  }, [displayTime, homeIana, use24h])

  // Handle time input submission
  const handleTimeSubmit = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setOffsetMinutes(0)
      setTimeInput('')
      return
    }

    const { parsed } = parse(trimmed)
    if (!parsed) return

    const realNow = DateTime.now().setZone(homeIana)
    let targetDt = realNow

    if (parsed.time.type === 'absolute') {
      targetDt = realNow.set({
        hour: parsed.time.hour,
        minute: parsed.time.minute,
        second: 0,
        millisecond: 0,
      })
    } else if (parsed.time.type === 'relative') {
      targetDt = realNow.plus({ minutes: parsed.time.minutes })
    }

    if (parsed.dateModifier === 'tomorrow') {
      targetDt = targetDt.plus({ days: 1 })
    } else if (parsed.dateModifier === 'yesterday') {
      targetDt = targetDt.minus({ days: 1 })
    }

    const diffMinutes = targetDt.diff(realNow, 'minutes').minutes
    setOffsetMinutes(Math.round(diffMinutes))
    setTimeInput(trimmed)
  }, [homeIana])

  const handleTimeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTimeSubmit(timeInput)
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      setTimeInput('')
      setOffsetMinutes(0)
      ;(e.target as HTMLInputElement).blur()
    }
  }, [timeInput, handleTimeSubmit])

  const handleQueryKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      onSubmit(query.trim())
    } else if (e.key === 'Escape') {
      onClear()
    }
  }, [query, onSubmit, onClear])

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
    const srcDt = DateTime.fromISO(result.sourceDateTime).plus({ minutes: offsetMinutes })
    const tgtDt = DateTime.fromISO(result.targetDateTime).plus({ minutes: offsetMinutes })
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
    if (result || query.trim()) return null
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
  }, [result, query, previewCities, use24h, homeCityName])

  const pillBase = 'backdrop-blur-sm border border-border rounded-full'

  return (
    <div className="h-full w-full relative">
      <WorldMap
        now={displayTime}
        use24h={use24h}
        homeCity={homeCity}
        conversion={conversion ?? previewConversion}
        onCityClick={onCityClick}
      />

      {/* Top nav */}
      <nav className="absolute top-3 left-3 right-3 z-40 flex items-center gap-2">
        {/* Logo — transparent, no pill */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 px-1 h-10 text-foreground/70 hover:text-foreground transition-colors flex-shrink-0"
        >
          <div className="h-4 w-4 rounded-full bg-accent flex-shrink-0" />
          <span className="font-serif text-sm">
            <span className="not-italic font-semibold">timezone</span><span className="italic font-light text-muted-foreground">.solar</span>
          </span>
        </button>

        {/* Time nudge */}
        <div className={`${pillBase} bg-surface/60 h-10 flex items-center gap-0.5 px-1.5 flex-shrink-0 ${isOffset ? 'border-accent/40' : ''}`}>
          <button
            onClick={() => nudge(-60)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-surface-hover"
            title="-1 hour"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onKeyDown={handleTimeKeyDown}
            onBlur={() => {
              if (timeInput.trim() && timeInput !== clockLabel) {
                handleTimeSubmit(timeInput)
              }
            }}
            placeholder={clockLabel}
            className="w-[70px] bg-transparent text-center font-mono text-sm text-foreground leading-tight outline-none placeholder:text-foreground"
          />

          <button
            onClick={() => nudge(60)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-surface-hover"
            title="+1 hour"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {isOffset && (
            <button
              onClick={resetOffset}
              className="p-1 text-accent hover:text-accent-foreground transition-colors rounded-full hover:bg-accent/10"
              title="Reset to now"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isOffset && (
          <span className="text-accent text-xs font-mono font-medium flex-shrink-0">
            {offsetMinutes > 0 ? '+' : ''}
            {Math.round(offsetMinutes / 60)}h
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Query input */}
        <div className={`${pillBase} bg-surface/60 h-10 flex items-center px-4 gap-2 w-[300px] max-w-[40vw]`}>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleQueryKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground min-w-0"
          />
          {isProcessing && query.trim() && (
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
          )}
          {query.trim() && (
            <button
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}

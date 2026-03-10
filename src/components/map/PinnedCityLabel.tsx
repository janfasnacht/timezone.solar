import { useMemo } from 'react'
import { DateTime } from 'luxon'
import type { HomeCity } from '@/lib/preferences'

type LabelVariant = 'preview' | 'active' | 'expanded'

interface PinnedCityLabelProps {
  cityName: string
  time: string
  x: number
  y: number
  containerWidth: number
  containerHeight: number
  placement: 'above' | 'below'
  variant?: LabelVariant
  // Extra fields for expanded (hover) state
  iana?: string
  country?: string
  now?: Date
  use24h?: boolean
  homeCity?: HomeCity | null
}

export function PinnedCityLabel({
  cityName,
  time,
  x,
  y,
  containerWidth,
  containerHeight,
  placement,
  variant = 'active',
  iana,
  country,
  now,
  use24h,
  homeCity,
}: PinnedCityLabelProps) {
  const isExpanded = variant === 'expanded'
  const isPreview = variant === 'preview'
  const cardWidth = isExpanded ? 200 : 140
  const cardHeight = isExpanded ? 80 : 52
  const gap = 10

  // Compute offset string for expanded state
  const offsetStr = useMemo(() => {
    if (!isExpanded || !iana || !now) return null
    const dt = DateTime.fromJSDate(now).setZone(iana)
    if (homeCity) {
      const homeDt = DateTime.fromJSDate(now).setZone(homeCity.iana)
      const diffMinutes = dt.offset - homeDt.offset
      const hours = Math.floor(Math.abs(diffMinutes) / 60)
      const mins = Math.abs(diffMinutes) % 60
      const sign = diffMinutes >= 0 ? '+' : '-'
      if (diffMinutes === 0) return `same time as ${homeCity.city}`
      return mins
        ? `${sign}${hours}h ${mins}m from ${homeCity.city}`
        : `${sign}${hours}h from ${homeCity.city}`
    }
    return dt.toFormat("'UTC'ZZ")
  }, [isExpanded, iana, now, homeCity])

  const displayTime = useMemo(() => {
    if (!isExpanded || !iana || !now) return time
    const dt = DateTime.fromJSDate(now).setZone(iana)
    return dt.toFormat(use24h ? 'HH:mm' : 'h:mm a')
  }, [isExpanded, iana, now, use24h, time])

  // Vertical position
  let top = placement === 'above' ? y - gap - cardHeight : y + gap

  // Clamp vertical
  if (top < 4) top = y + gap
  if (top + cardHeight > containerHeight - 4) top = y - gap - cardHeight

  // Horizontal: center on dot, clamp to edges
  let left = x - cardWidth / 2
  if (left < 4) left = 4
  if (left + cardWidth > containerWidth - 4) left = containerWidth - cardWidth - 4

  const borderStyle = isPreview ? 'border-dashed' : 'border-solid'
  const shadow = isExpanded ? 'shadow-lg' : 'shadow-sm'

  return (
    <div
      className={`absolute pointer-events-none transition-all duration-300 ease-out ${isExpanded ? 'z-50' : 'z-30'}`}
      style={{
        left,
        top,
        width: cardWidth,
        opacity: isPreview ? 0.5 : 1,
      }}
    >
      <div className={`bg-surface/80 backdrop-blur-sm border ${borderStyle} border-border rounded-lg ${shadow} ${isExpanded ? 'px-3 py-2' : 'px-2.5 py-1.5'}`}>
        <div className={`font-serif text-accent font-medium truncate ${isExpanded ? 'text-sm' : 'text-xs'}`}>
          {cityName}
        </div>
        <div className={`font-mono text-foreground font-medium leading-tight ${isExpanded ? 'text-lg' : 'text-sm'}`}>
          {displayTime}
        </div>
        {isExpanded && offsetStr && (
          <div className="text-muted-foreground text-xs mt-0.5">{offsetStr}</div>
        )}
        {isExpanded && country && (
          <div className="text-muted-foreground text-xs opacity-60">{country}</div>
        )}
      </div>
    </div>
  )
}

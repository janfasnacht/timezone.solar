import { useMemo } from 'react'
import { DateTime } from 'luxon'
import type { CityEntity } from '@/engine/city-entities'
import type { HomeCity } from '@/lib/preferences'

interface CityHoverCardProps {
  city: CityEntity
  x: number
  y: number
  containerRect: DOMRect | null
  now: Date
  use24h: boolean
  homeCity: HomeCity | null
}

export function CityHoverCard({
  city,
  x,
  y,
  containerRect,
  now,
  use24h,
  homeCity,
}: CityHoverCardProps) {
  const { localTime, offset } = useMemo(() => {
    const dt = DateTime.fromJSDate(now).setZone(city.iana)
    const format = use24h ? 'HH:mm' : 'h:mm a'
    const time = dt.toFormat(format)

    let offsetStr: string
    if (homeCity) {
      const homeDt = DateTime.fromJSDate(now).setZone(homeCity.iana)
      const diffMinutes = dt.offset - homeDt.offset
      const hours = Math.floor(Math.abs(diffMinutes) / 60)
      const mins = Math.abs(diffMinutes) % 60
      const sign = diffMinutes >= 0 ? '+' : '-'
      offsetStr = mins
        ? `${sign}${hours}h ${mins}m from ${homeCity.city}`
        : `${sign}${hours}h from ${homeCity.city}`
      if (diffMinutes === 0) offsetStr = `same time as ${homeCity.city}`
    } else {
      offsetStr = dt.toFormat("'UTC'ZZ")
    }

    return { localTime: time, offset: offsetStr }
  }, [city.iana, now, use24h, homeCity])

  if (!containerRect) return null

  // Position the card above the dot, flipping if near edges
  const cardWidth = 200
  const cardHeight = 80
  const padding = 12

  let left = x - cardWidth / 2
  let top = y - cardHeight - padding

  // Flip below if too close to top
  if (top < 8) {
    top = y + padding
  }

  // Clamp horizontal
  if (left < 8) left = 8
  if (left + cardWidth > containerRect.width - 8) {
    left = containerRect.width - cardWidth - 8
  }

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{ left, top, width: cardWidth }}
    >
      <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-lg">
        <div className="font-serif text-accent text-sm font-medium">
          {city.displayName}
        </div>
        <div className="font-mono text-foreground text-lg font-medium leading-tight">
          {localTime}
        </div>
        <div className="text-muted-foreground text-xs mt-0.5">{offset}</div>
        <div className="text-muted-foreground text-xs opacity-60">
          {city.country}
        </div>
      </div>
    </div>
  )
}

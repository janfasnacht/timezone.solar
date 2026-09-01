import { useMemo } from 'react'
import { DateTime } from 'luxon'
import { getEntityBySlug, type Entity } from '@/engine/entities'
import type { HomeCity } from '@/lib/preferences'

interface EntityHoverCardProps {
  entity: Entity
  x: number
  y: number
  containerRect: DOMRect | null
  now: Date
  use24h: boolean
  homeCity: HomeCity | null
  /** Keeps the dot lit while the cursor is on the card. */
  onHoverChange?: (hovered: boolean) => void
}

export function EntityHoverCard({
  entity,
  x,
  y,
  containerRect,
  now,
  use24h,
  homeCity,
  onHoverChange,
}: EntityHoverCardProps) {
  // Falls back to the browser's own zone when no home city is set, so the
  // "how far from me" line is always answerable without asking for location.
  const referenceZone = homeCity?.iana ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const referenceName = homeCity?.city ?? 'you'

  const { localTime, offset, utc } = useMemo(() => {
    const dt = DateTime.fromJSDate(now).setZone(entity.iana)
    const time = dt.toFormat(use24h ? 'HH:mm' : 'h:mm a')

    const refDt = DateTime.fromJSDate(now).setZone(referenceZone)
    const diffMinutes = dt.offset - refDt.offset
    const hours = Math.floor(Math.abs(diffMinutes) / 60)
    const mins = Math.abs(diffMinutes) % 60
    const sign = diffMinutes >= 0 ? '+' : '-'
    let offsetStr = mins
      ? `${sign}${hours}h ${mins}m from ${referenceName}`
      : `${sign}${hours}h from ${referenceName}`
    if (diffMinutes === 0) offsetStr = `same time as ${referenceName}`

    return { localTime: time, offset: offsetStr, utc: dt.toFormat("'UTC'ZZ") }
  }, [entity.iana, now, use24h, referenceZone, referenceName])

  if (!containerRect) return null

  // Position the card above the dot, flipping if near edges
  const cardWidth = 230
  const cardHeight = 104
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

  // An airport's code alone doesn't say where it is or what it serves, so give
  // the full name on one line and the city it belongs to plus the country on the
  // next. Cities keep to their own country line.
  const primaryLabel = entity.displayName
  const parentCity =
    entity.kind === 'airport' && entity.parentCitySlug
      ? getEntityBySlug(entity.parentCitySlug)?.displayName ?? null
      : null
  const fullName = entity.kind === 'airport' ? entity.airportName : null
  const place = entity.kind === 'airport' && parentCity
    ? `${parentCity}, ${entity.country}`
    : entity.country

  return (
    <div
      className={`absolute z-50 ${onHoverChange ? 'pointer-events-auto' : 'pointer-events-none'}`}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={{ left, top, width: cardWidth }}
    >
      <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-lg">
        <div className="font-serif text-accent text-sm font-medium">
          {primaryLabel}
        </div>
        <div className="font-mono text-foreground text-lg font-medium leading-tight">
          {localTime}
        </div>
        {fullName && (
          <div className="mt-0.5 text-xs leading-snug text-foreground/70">{fullName}</div>
        )}
        <div className="mt-0.5 text-xs text-muted-foreground">{offset}</div>
        <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground opacity-60">
          <span className="truncate">{place}</span>
          <span className="flex-shrink-0 font-mono">{utc}</span>
        </div>
      </div>
    </div>
  )
}

import { getEntityBySlug, type Entity } from '@/engine/entities'
import { zoneClock } from '@/lib/zoneClock'
import type { HomeCity } from '@/lib/preferences'
import { CARD_GAP, CARD_MAX_HEIGHT, CARD_MAX_WIDTH, TOP_SAFE_PX } from './cardPlacement'

/** `compact` is the resting label on the source and target; `full` is any card being pointed at. */
export type CardSize = 'compact' | 'full'

interface EntityCardProps {
  entity: Entity
  /** The dot's position, in container pixels. */
  x: number
  y: number
  containerWidth: number
  containerHeight: number
  /** Preferred side. Flipped only to stay clear of the search bar or the floor. */
  placement: 'above' | 'below'
  size: CardSize
  now: Date
  use24h: boolean
  homeCity: HomeCity | null
  /** The conversion's time, for the source and target. Absent for any other dot. */
  pinnedTime?: string
  /** Keeps the dot lit while the cursor is on the card. */
  onHoverChange?: (hovered: boolean) => void
}

/**
 * The card on the map, at both sizes. It hangs from its dot, centred by
 * transform, so growing to `full` extends it rather than moving it. The gap is
 * padding on the wrapper, so there is no dead space between dot and card.
 */
export function EntityCard({
  entity,
  x,
  y,
  containerWidth,
  containerHeight,
  placement,
  size,
  now,
  use24h,
  homeCity,
  pinnedTime,
  onHoverChange,
}: EntityCardProps) {
  const clock = zoneClock(entity.iana, now, use24h, {
    iana: homeCity?.iana ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    name: homeCity?.city ?? 'you',
  })
  if (!clock) return null

  const isFull = size === 'full'
  const isAirport = entity.kind === 'airport'
  const parentCity =
    isAirport && entity.parentCitySlug
      ? getEntityBySlug(entity.parentCitySlug)?.displayName ?? null
      : null

  // An airport's code says neither where it is nor what it serves, so it names
  // its city too. Compact has room for the name and nothing else.
  const home = isAirport && parentCity ? `${parentCity}, ${entity.country}` : entity.country
  const title = !isFull
    ? entity.displayName
    : `${entity.displayName}${isAirport ? ' · ' : ', '}${home}`
  const time = isFull ? clock.time : pinnedTime ?? clock.time

  // Both sizes flip on the tallest, so pointing at a card never moves it.
  let above = placement === 'above'
  if (above && y - CARD_GAP - CARD_MAX_HEIGHT < TOP_SAFE_PX) above = false
  if (!above && y + CARD_GAP + CARD_MAX_HEIGHT > containerHeight - 8) above = true

  // Clamped on the widest, for the same reason.
  const half = CARD_MAX_WIDTH / 2
  const left = Math.min(Math.max(x, half + 4), Math.max(half + 4, containerWidth - half - 4))

  return (
    <div
      className={`absolute z-50 flex justify-center ${onHoverChange ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      style={{
        left,
        top: y,
        transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        [above ? 'paddingBottom' : 'paddingTop']: CARD_GAP,
      }}
    >
      <div
        className={`rounded-lg border border-border bg-surface/90 backdrop-blur-sm ${
          isFull ? 'px-2.5 py-1.5 shadow-lg' : 'px-2 py-1 shadow-sm'
        }`}
        style={{ maxWidth: CARD_MAX_WIDTH }}
      >
        <div
          className={`truncate font-serif font-medium text-accent ${isFull ? 'text-xs' : 'text-[0.7rem]'}`}
        >
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono font-medium leading-tight text-foreground ${isFull ? 'text-base' : 'text-sm'}`}
          >
            {time}
          </span>
          {isFull && (
            <span className="font-mono text-[0.65rem] text-muted-foreground">{clock.utc}</span>
          )}
        </div>
        {isFull && isAirport && (
          <div className="truncate text-[0.7rem] leading-snug text-foreground/70">
            {entity.airportName}
          </div>
        )}
        {isFull && clock.offset && (
          <div className="truncate text-[0.7rem] text-muted-foreground">{clock.offset}</div>
        )}
      </div>
    </div>
  )
}

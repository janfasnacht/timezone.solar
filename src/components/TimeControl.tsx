import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { DateTime } from 'luxon'
import { Tooltip } from '@/components/ui/Tooltip'

interface TimeControlProps {
  /** True when no time was asked for, so the answer tracks the clock. */
  isLive: boolean
  onNudge: (deltaMinutes: number) => void
  /** Drop the time from the query, returning to live. */
  onReset: () => void
  /** The instant currently shown, in the source zone. */
  anchor: DateTime | null
  use24h: boolean
  className?: string
}

const ICON_BUTTON =
  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground'

/**
 * The moment, and a way to move it by an hour.
 *
 * Nudging edits the query rather than holding separate state, so the search bar
 * and the URL stay a complete description of what is shown. Naming a moment is
 * the search bar's job — the parser takes `next friday`, `14 march`, ISO — which
 * is why there is no picker here.
 */
export function TimeControl({
  isLive,
  onNudge,
  onReset,
  anchor,
  use24h,
  className,
}: TimeControlProps) {
  const time = anchor ? anchor.toFormat(use24h ? 'HH:mm' : 'h:mm a') : 'now'

  // Nudging crosses midnight sooner or later, and a bare "23:00" meaning
  // tomorrow is worse than no read-out at all.
  const dayLabel = (() => {
    if (!anchor) return null
    const days = anchor.startOf('day').diff(DateTime.now().setZone(anchor.zone).startOf('day'), 'days').days
    if (days === 0) return null
    if (days === 1) return 'tomorrow'
    if (days === -1) return 'yesterday'
    if (days > 0 && days < 7) return anchor.toFormat('ccc')
    return anchor.toFormat('d LLL')
  })()

  return (
    <div
      className={`flex h-10 items-center gap-0.5 rounded-full border border-border bg-surface/60 px-1.5 backdrop-blur-sm${className ? ` ${className}` : ''}`}
    >
      {!isLive && (
        <Tooltip label="Back to now">
          <button onClick={onReset} className={`${ICON_BUTTON} text-accent hover:text-accent`} aria-label="Back to now">
            <RotateCcw className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
      <Tooltip label="1 hour earlier">
        <button onClick={() => onNudge(-60)} className={ICON_BUTTON} aria-label="1 hour earlier">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </Tooltip>
      <span
        className={`flex min-w-[3.5rem] items-baseline justify-center gap-1.5 px-1 ${
          isLive ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        <span className="font-mono text-sm leading-none font-medium">{time}</span>
        {dayLabel && <span className="text-[0.7rem] leading-none text-muted-foreground">{dayLabel}</span>}
      </span>
      <Tooltip label="1 hour later">
        <button onClick={() => onNudge(60)} className={ICON_BUTTON} aria-label="1 hour later">
          <ChevronRight className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}

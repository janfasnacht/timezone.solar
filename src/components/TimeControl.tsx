import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import type { DateTime } from 'luxon'

interface TimeControlProps {
  /** True when no time was asked for, so the answer tracks the clock. */
  isLive: boolean
  onNudge: (deltaMinutes: number) => void
  /** Drop the time from the query, returning to live. */
  onReset: () => void
  /** The instant currently shown, in the source zone. */
  anchor: DateTime | null
  use24h: boolean
  roomy?: boolean
  className?: string
}

/**
 * PARKED — deliberately minimal while the chrome is redesigned.
 *
 * Nudging still edits the query rather than holding shadow state, which is the
 * part that was settled. Direct editing returns with the picker, once there is a
 * design system for it to belong to; three half-opinions in a row is what got
 * this control into trouble.
 */
export function TimeControl({
  isLive,
  onNudge,
  onReset,
  anchor,
  use24h,
  roomy = false,
  className,
}: TimeControlProps) {
  const pad = roomy ? 'p-1.5' : 'p-1'
  const label = anchor ? anchor.toFormat(use24h ? 'HH:mm' : 'h:mm a') : 'now'

  return (
    <div className={`flex items-center gap-2${className ? ` ${className}` : ''}`}>
      {!isLive && (
        <button
          onClick={onReset}
          className="rounded-full p-1 text-accent transition-colors hover:bg-accent/10"
          title="Back to now"
          aria-label="Back to now"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex h-10 items-center gap-0.5 rounded-full border border-border bg-surface/60 px-1.5 backdrop-blur-sm">
        <button
          onClick={() => onNudge(-60)}
          className={`${pad} rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground`}
          title="1 hour earlier"
          aria-label="1 hour earlier"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className={`text-center font-mono text-sm leading-tight ${isLive ? 'text-muted-foreground' : 'text-foreground'} ${use24h ? 'w-[56px]' : 'w-[84px]'}`}>
          {label}
        </span>
        <button
          onClick={() => onNudge(60)}
          className={`${pad} rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground`}
          title="1 hour later"
          aria-label="1 hour later"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

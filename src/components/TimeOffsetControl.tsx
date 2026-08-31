import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import type { TimeOffset } from '@/hooks/useTimeOffset'

interface TimeOffsetControlProps {
  offset: TimeOffset
  /** Larger hit targets for the mobile map bar. */
  roomy?: boolean
  className?: string
}

/**
 * The shared time stepper. Rendered bottom-right over the map and under the
 * card, so a nudge is reachable and visible from either view.
 */
export function TimeOffsetControl({ offset, roomy = false, className }: TimeOffsetControlProps) {
  const { offsetMinutes, isOffset, tracksNow, timeInput, setTimeInput, submitTimeInput, nudge, reset, clockLabel } = offset
  const pad = roomy ? 'p-1.5' : 'p-1'

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submitTimeInput(timeInput)
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      reset()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className={`flex items-center gap-2${className ? ` ${className}` : ''}`}>
      {isOffset && (
        <button
          onClick={reset}
          className="rounded-full p-1 text-accent transition-colors hover:bg-accent/10 hover:text-accent-foreground"
          title={tracksNow ? 'Back to now' : 'Back to the queried time'}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
      {isOffset ? (
        <span className="font-mono text-xs font-medium text-accent">
          {offsetMinutes > 0 ? '+' : ''}{Math.round(offsetMinutes / 60)}h
        </span>
      ) : tracksNow ? (
        <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground/70 uppercase" title="Tracking the current time">
          now
        </span>
      ) : null}
      <div
        className={`flex h-10 items-center gap-0.5 rounded-full border border-border bg-surface/60 px-1.5 backdrop-blur-sm ${
          isOffset ? 'border-accent/40' : ''
        }`}
      >
        <button onClick={() => nudge(-60)} className={`${pad} rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground`} title="-1 hour">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (timeInput.trim() && timeInput !== clockLabel) submitTimeInput(timeInput) }}
          placeholder={clockLabel}
          aria-label="Time"
          className="w-[70px] bg-transparent text-center font-mono text-sm leading-tight text-foreground outline-none placeholder:text-foreground"
        />
        <button onClick={() => nudge(60)} className={`${pad} rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground`} title="+1 hour">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

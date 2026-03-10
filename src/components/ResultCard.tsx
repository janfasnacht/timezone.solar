import { useMemo } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { DateTime } from 'luxon'
import { useLiveClock } from '@/hooks/useLiveClock'
import { usePreferences } from '@/hooks/usePreferences'
import { getDstWarning } from '@/lib/dstWarning'
import type { ConversionResult } from '@/engine/types'
import type { MatchType } from '@/engine/confidence'

interface ResultCardProps {
  result: ConversionResult
  isUsingCurrentTime: boolean
  matchType?: MatchType
  onSwap: () => void
}

export function ResultCard({ result, isUsingCurrentTime, matchType, onSwap }: ResultCardProps) {
  const { timeFormat } = usePreferences()
  const use24h = timeFormat === '24h'
  const sourceClock = useLiveClock(result.source.iana, use24h)
  const targetClock = useLiveClock(result.target.iana, use24h)
  const { source, target, offsetDifference, dayBoundary, dstNote } = result
  const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'

  const targetDate = useMemo(() => {
    const dt = DateTime.fromISO(result.targetDateTime)
    return dt.isValid ? dt.toFormat('EEE, MMM d') : null
  }, [result.targetDateTime])

  const dstWarning = useMemo(() => {
    const ref = DateTime.fromISO(result.sourceDateTime)
    if (!ref.isValid) return null
    return getDstWarning(source.iana, target.iana, ref)
  }, [source.iana, target.iana, result.sourceDateTime])

  const sourceHeroTime = isUsingCurrentTime ? sourceClock : source[timeKey]
  const targetHeroTime = isUsingCurrentTime ? targetClock : target[timeKey]

  // Split time and period (AM/PM) for the target hero display
  const targetTimeParts = useMemo(() => {
    if (use24h) return { time: targetHeroTime, period: null }
    const match = targetHeroTime.match(/^(.+?)\s*(AM|PM)$/i)
    if (!match) return { time: targetHeroTime, period: null }
    return { time: match[1], period: ' ' + match[2] }
  }, [targetHeroTime, use24h])

  const isNotSameDay = dayBoundary !== 'same day'

  // Highlight style for offset chip and non-same-day chip (per mockup C)
  const highlightChip = 'rounded-[6px] border border-tomorrow-border bg-glow-strong px-[0.6rem] py-[0.25rem] font-mono text-[0.7rem] text-accent'
  const normalChip = 'rounded-[6px] border border-border bg-surface px-[0.6rem] py-[0.25rem] font-mono text-[0.7rem] text-muted-foreground'

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Top accent gradient line */}
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-surface via-accent-soft to-surface" />

      <div className="p-5 md:p-[2rem]">
        {/* Source row — two-column baseline */}
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[0.85rem] text-muted-foreground">
              {source.city}{source.country ? `, ${source.country}` : ''}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[1.1rem] md:text-[1.3rem] font-semibold">
              {sourceHeroTime}
            </span>
            <span className="ml-1 text-[0.7rem] font-mono font-normal text-muted-foreground">
              {source.abbreviation}
            </span>
          </div>
        </div>

        {/* Divider + Swap — gradient lines per mockup C */}
        <div className="my-3 md:my-[1.2rem] flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-surface via-border to-surface" />
          <button
            onClick={onSwap}
            className="flex items-center justify-center h-10 w-10 -m-2 text-muted-foreground transition-colors hover:text-accent"
            aria-label="Swap source and target"
          >
            <ArrowUpDown size={15} />
          </button>
          <div className="h-px flex-1 bg-gradient-to-r from-surface via-border to-surface" />
        </div>

        {/* Target */}
        <div>
          <div className="mb-1 text-[0.85rem] text-muted-foreground">
            {target.city}{target.country ? `, ${target.country}` : ''}
          </div>
          <div className="flex items-baseline gap-[0.6rem]">
            <span className="font-serif text-[2.75rem] md:text-[4rem] font-semibold leading-none tracking-[-0.03em] text-accent">
              {targetTimeParts.time}
              {targetTimeParts.period && (
                <span className="text-[1rem] md:text-[1.4rem] font-light opacity-70">{targetTimeParts.period}</span>
              )}
            </span>
          </div>
          <div className="mt-1 text-[0.75rem] font-mono text-muted-foreground">
            {target.abbreviation} · UTC{target.offsetFromUTC}
          </div>

          {/* Detail chips */}
          <div className="mt-[1.2rem] flex flex-wrap items-center gap-[0.5rem]">
            <span className={highlightChip}>
              {offsetDifference}
            </span>
            {isNotSameDay && (
              <span className={highlightChip}>
                {dayBoundary}
              </span>
            )}
            {targetDate && (
              <span className={normalChip}>
                {targetDate}
              </span>
            )}
            {matchType && matchType !== 'exact' && matchType !== 'none' && (
              <span className={normalChip} title={`Parser match: ${matchType}`}>
                best guess
              </span>
            )}
          </div>

          {/* Relative time */}
          {result.relativeTime && (
            <p className="mt-4 font-serif text-[0.95rem] italic text-muted-foreground">
              {result.relativeTime}
            </p>
          )}
        </div>

        {/* DST Note */}
        {dstNote && (
          <p className="mt-3 text-xs text-muted-foreground">{dstNote}</p>
        )}

        {/* DST Warning */}
        {dstWarning && (
          <p className="mt-2 text-xs text-muted-foreground">{dstWarning}</p>
        )}

      </div>



    </div>
  )
}

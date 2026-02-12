import { useMemo } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { DateTime } from 'luxon'
import { useLiveClock } from '@/hooks/useLiveClock'
import { usePreferences } from '@/hooks/usePreferences'
import { getDstWarning } from '@/lib/dstWarning'
import { CopyButton } from '@/components/CopyButton'
import type { ConversionResult } from '@/engine/types'

interface ResultCardProps {
  result: ConversionResult
  isUsingCurrentTime: boolean
  onSwap: () => void
}

export function ResultCard({ result, isUsingCurrentTime, onSwap }: ResultCardProps) {
  const { timeFormat } = usePreferences()
  const use24h = timeFormat === '24h'
  const sourceClock = useLiveClock(result.source.iana, use24h)
  const targetClock = useLiveClock(result.target.iana, use24h)
  const { source, target, offsetDifference, dayBoundary, dstNote } = result
  const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'

  const sourceDate = useMemo(() => {
    const dt = DateTime.fromISO(result.sourceDateTime)
    return dt.isValid ? dt.toFormat('EEE, MMM d') : null
  }, [result.sourceDateTime])

  const dstWarning = useMemo(() => {
    const ref = DateTime.fromISO(result.sourceDateTime)
    if (!ref.isValid) return null
    return getDstWarning(source.iana, target.iana, ref)
  }, [source.iana, target.iana, result.sourceDateTime])

  const sourceHeroTime = isUsingCurrentTime ? sourceClock : source[timeKey]
  const targetHeroTime = isUsingCurrentTime ? targetClock : target[timeKey]

  const copyText = `${targetHeroTime} ${target.abbreviation} (${sourceHeroTime} ${source.abbreviation})`

  return (
    <div className="w-full rounded-lg border border-border bg-background p-6 shadow-sm">
      {/* Source */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {source.city}{source.country ? `, ${source.country}` : ''}
          </span>
          {!isUsingCurrentTime && (
            <span className="text-xs text-muted-foreground">{sourceClock}</span>
          )}
        </div>
        <div className="mt-1 text-2xl font-semibold">
          {sourceHeroTime}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {source.abbreviation}
          </span>
          {isUsingCurrentTime && (
            <span className="ml-2 text-xs text-muted-foreground">now</span>
          )}
        </div>
        {sourceDate && !isUsingCurrentTime && (
          <span className="text-xs text-muted-foreground">{sourceDate}</span>
        )}
        {result.anchorNote && (
          <p className="mt-0.5 text-xs text-muted-foreground">{result.anchorNote}</p>
        )}
      </div>

      {/* Divider + Swap */}
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <button
          onClick={onSwap}
          className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Swap source and target"
        >
          <ArrowUpDown size={16} />
        </button>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Target */}
      <div>
        <span className="text-sm font-medium text-muted-foreground">
          {target.city}{target.country ? `, ${target.country}` : ''}
        </span>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-serif text-5xl font-bold text-accent">
            {targetHeroTime}
          </span>
          <CopyButton text={copyText} />
        </div>
        <span className="text-sm text-muted-foreground">{target.abbreviation}</span>
        {result.relativeTime && (
          <p className="mt-1 text-lg font-medium text-muted-foreground">{result.relativeTime}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">
          {offsetDifference}
        </span>
        {dayBoundary !== 'same day' && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground">
            {dayBoundary}
          </span>
        )}
      </div>

      {/* IANA trust line */}
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {source.iana} (UTC{source.offsetFromUTC}) → {target.iana} (UTC{target.offsetFromUTC})
      </p>

      {/* DST Note */}
      {dstNote && (
        <p className="mt-2 text-xs text-muted-foreground">{dstNote}</p>
      )}

      {/* DST Warning */}
      {dstWarning && (
        <p className="mt-2 text-xs text-muted-foreground">{dstWarning}</p>
      )}

      {/* Same timezone note */}
      {source.iana === target.iana && (
        <p className="mt-2 text-xs text-muted-foreground">
          Both locations are in the same timezone ({source.abbreviation})
        </p>
      )}
    </div>
  )
}

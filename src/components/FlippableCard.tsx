import { useState, useCallback } from 'react'
import { ResultCard } from '@/components/ResultCard'
import { CardBack } from '@/components/CardBack'
import type { ConversionResult } from '@/engine/types'
import type { MatchType } from '@/engine/confidence'

interface FlippableCardProps {
  result: ConversionResult
  isUsingCurrentTime: boolean
  matchType: MatchType
  onSwap: () => void
  query: string
  use24h: boolean
  onViewOnMap?: () => void
}

export function FlippableCard({ result, isUsingCurrentTime, matchType, onSwap, query, use24h, onViewOnMap }: FlippableCardProps) {
  const [flipped, setFlipped] = useState(false)
  const [prevResult, setPrevResult] = useState(result)

  // Reset to front when result changes (new query)
  if (prevResult !== result) {
    setPrevResult(result)
    setFlipped(false)
  }

  const flipToBack = useCallback(() => setFlipped(true), [])
  const flipToFront = useCallback(() => setFlipped(false), [])

  return (
    <div>
      <div className="overflow-hidden" style={{ perspective: '1200px' }}>
        <div
          className="relative transition-transform duration-500 [transform-style:preserve-3d]"
          style={flipped ? { transform: 'rotateY(180deg)' } : undefined}
        >
          {/* Front face */}
          <div className="[backface-visibility:hidden]">
            <ResultCard
              result={result}
              isUsingCurrentTime={isUsingCurrentTime}
              matchType={matchType}
              onSwap={onSwap}
            />
          </div>

          {/* Back face — absolute so front face drives the height */}
          <div className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
            <CardBack
              result={result}
              query={query}
              use24h={use24h}
            />
          </div>
        </div>
      </div>

      {/* Action links below card */}
      <div className="mt-3 md:mt-3 flex items-center justify-center gap-4 text-[0.8rem] text-muted-foreground/50">
        {onViewOnMap && (
          <>
            <button
              onClick={onViewOnMap}
              className="flex items-center gap-1.5 px-2 py-3 transition-colors hover:text-foreground"
            >
              View on map
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 3.5l4-1.5v10.5l-4 1.5V3.5zM5.5 2l5 2v10.5l-5-2V2zM10.5 4l4-1.5v10.5l-4 1.5V4z" />
              </svg>
            </button>
            <span className="text-border">·</span>
          </>
        )}
        <button
          onClick={flipped ? flipToFront : flipToBack}
          className="flex items-center gap-1.5 px-2 py-3 transition-colors hover:text-foreground"
        >
          {flipped ? 'Back to result' : 'Share'}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {flipped
              ? <path d="M9 3l-5 5 5 5" />
              : <path d="M13 6a3 3 0 0 0-3-3H5M13 6l-3-3M13 6l-3 3M3 10a3 3 0 0 0 3 3h5M3 10l3 3M3 10l3-3" />
            }
          </svg>
        </button>
      </div>
    </div>
  )
}

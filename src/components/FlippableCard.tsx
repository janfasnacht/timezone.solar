import { useState, useEffect, useCallback } from 'react'
import { ResultCard } from '@/components/ResultCard'
import { CardBack } from '@/components/CardBack'
import type { ConversionResult } from '@/engine/types'

interface FlippableCardProps {
  result: ConversionResult
  isUsingCurrentTime: boolean
  onSwap: () => void
  query: string
  use24h: boolean
}

export function FlippableCard({ result, isUsingCurrentTime, onSwap, query, use24h }: FlippableCardProps) {
  const [flipped, setFlipped] = useState(false)

  // Reset to front when result changes (new query)
  useEffect(() => {
    setFlipped(false)
  }, [result])

  const flipToBack = useCallback(() => setFlipped(true), [])
  const flipToFront = useCallback(() => setFlipped(false), [])

  return (
    <div style={{ perspective: '1200px' }}>
      <div
        className="relative transition-transform duration-500 [transform-style:preserve-3d]"
        style={flipped ? { transform: 'rotateY(180deg)' } : undefined}
      >
        {/* Front face */}
        <div className="[backface-visibility:hidden]">
          <ResultCard
            result={result}
            isUsingCurrentTime={isUsingCurrentTime}
            onSwap={onSwap}
            onFlip={flipToBack}
          />
        </div>

        {/* Back face — absolute so front face drives the height */}
        <div className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
          <CardBack
            result={result}
            query={query}
            use24h={use24h}
            onFlip={flipToFront}
          />
        </div>
      </div>
    </div>
  )
}

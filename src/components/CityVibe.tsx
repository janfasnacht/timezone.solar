import { useState, useMemo } from 'react'
import { getVibes } from '@/engine/entities'

interface CityVibeProps {
  entitySlug?: string
  fallbackFeelingWord: string
  onClick: () => void
  onHoverChange?: (hovered: boolean) => void
}

export function CityVibe({ entitySlug, fallbackFeelingWord, onClick, onHoverChange }: CityVibeProps) {
  const [vibeIndex] = useState(() => Math.floor(Math.random() * 3))

  const word = useMemo(() => {
    if (!entitySlug) return fallbackFeelingWord
    const vibes = getVibes(entitySlug)
    if (!vibes || vibes.length === 0) return fallbackFeelingWord
    return vibes[vibeIndex % vibes.length]
  }, [entitySlug, fallbackFeelingWord, vibeIndex])

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => onHoverChange?.(false)}
      className="cursor-pointer font-serif text-[0.95rem] font-normal italic text-muted-foreground transition-colors hover:text-accent"
    >
      feeling {word}?
    </button>
  )
}

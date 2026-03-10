import type { CityEntity } from '@/engine/city-entities'

interface CityDotProps {
  city: CityEntity
  x: number
  y: number
  isHome: boolean
  onHover: (city: CityEntity | null) => void
  onClick: (city: CityEntity) => void
}

export function CityDot({
  city,
  x,
  y,
  isHome,
  onHover,
  onClick,
}: CityDotProps) {
  return (
    <circle
      cx={x}
      cy={y}
      r={isHome ? 5 : 3.5}
      fill="var(--color-accent)"
      opacity={0.85}
      className={`cursor-pointer transition-all duration-150 hover:opacity-100 ${isHome ? 'animate-pulse' : ''}`}
      onMouseEnter={() => onHover(city)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(city)}
    />
  )
}

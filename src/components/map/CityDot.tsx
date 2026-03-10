import type { CityEntity } from '@/engine/city-entities'

export type CityRole = 'source' | 'target' | 'none'

interface CityDotProps {
  city: CityEntity
  x: number
  y: number
  role: CityRole
  onHover: (city: CityEntity | null) => void
  onClick: (city: CityEntity) => void
}

export function CityDot({
  city,
  x,
  y,
  role,
  onHover,
  onClick,
}: CityDotProps) {
  // Two sizes only: active (source/target) vs context (everything else)
  const isActive = role !== 'none'
  const r = isActive ? 4.5 : 2.5
  const opacity = isActive ? 1 : 0.5

  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      fill="var(--color-accent)"
      opacity={opacity}
      className="cursor-pointer transition-all duration-150 hover:opacity-100"
      onMouseEnter={() => onHover(city)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(city)}
    />
  )
}

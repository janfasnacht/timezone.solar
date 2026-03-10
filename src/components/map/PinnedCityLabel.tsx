interface PinnedCityLabelProps {
  cityName: string
  time: string
  x: number
  y: number
  containerWidth: number
  containerHeight: number
  placement: 'above' | 'below'
}

export function PinnedCityLabel({
  cityName,
  time,
  x,
  y,
  containerWidth,
  containerHeight,
  placement,
}: PinnedCityLabelProps) {
  const cardWidth = 140
  const gap = 10

  // Vertical position
  let top = placement === 'above' ? y - gap - 52 : y + gap

  // Clamp vertical
  if (top < 4) top = y + gap
  if (top + 52 > containerHeight - 4) top = y - gap - 52

  // Horizontal: center on dot, clamp to edges
  let left = x - cardWidth / 2
  if (left < 4) left = 4
  if (left + cardWidth > containerWidth - 4) left = containerWidth - cardWidth - 4

  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{ left, top, width: cardWidth }}
    >
      <div className="bg-surface/80 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
        <div className="font-serif text-accent text-xs font-medium truncate">
          {cityName}
        </div>
        <div className="font-mono text-foreground text-sm font-medium leading-tight">
          {time}
        </div>
      </div>
    </div>
  )
}

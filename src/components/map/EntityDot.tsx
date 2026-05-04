import type { Entity } from '@/engine/entities'

export type EntityRole = 'source' | 'target' | 'none'

interface EntityDotProps {
  entity: Entity
  x: number
  y: number
  role: EntityRole
  minor?: boolean
  onHover: (entity: Entity | null) => void
  onClick: (entity: Entity) => void
}

// Lucide-react Plane icon path (24x24 viewBox, MIT). Inlined rather than
// instantiated as a component so we can scale, position, and stroke-style
// uniformly within the parent SVG without nested-svg quirks.
const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'

export function EntityDot({
  entity,
  x,
  y,
  role,
  minor = false,
  onHover,
  onClick,
}: EntityDotProps) {
  const isActive = role !== 'none'
  const opacity = isActive ? 1 : minor ? 0.25 : 0.5

  const handlers = {
    className: 'cursor-pointer transition-all duration-150 hover:opacity-100',
    onMouseEnter: () => onHover(entity),
    onMouseLeave: () => onHover(null),
    onClick: () => onClick(entity),
  }

  if (entity.kind === 'airport') {
    // Lucide Plane silhouette, filled (no stroke), centered on (x, y).
    // Filled solid so the marker reads at the same optical weight as the
    // city dots without an outline ringing the shape.
    const size = isActive ? 14 : minor ? 9 : 11
    const scale = size / 24
    return (
      <g
        {...handlers}
        opacity={opacity}
        transform={`translate(${x} ${y}) scale(${scale}) translate(-12 -12)`}
      >
        <path d={PLANE_PATH} fill="var(--color-accent)" />
      </g>
    )
  }

  const r = isActive ? 4.5 : minor ? 1 : 2.5
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      fill="var(--color-accent)"
      opacity={opacity}
      {...handlers}
    />
  )
}

import { memo } from 'react'
import type { Entity } from '@/engine/entities'

export type EntityRole = 'source' | 'target' | 'none'

interface EntityDotProps {
  entity: Entity
  x: number
  y: number
  role: EntityRole
  minor?: boolean
  /** True when this entity is hovered — including via its label or hover card. */
  hovered?: boolean
  /** Transparent catchment radius; never overlaps a neighbour's half-distance. */
  hitRadius?: number
  /**
   * The map scale to size against — the *settled* one, not the live one. Every
   * measurement here is divided by it, so a marker and its catchment hold one
   * size on screen and the emphasis between them keeps the ratio it has at rest.
   *
   * Re-sizing thousands of dots on every frame of a gesture is what made a wheel
   * tick cost a second, so mid-gesture they ride the map's own transform and
   * come back to size when it stops — a beat too short to read on one tick.
   */
  zoom?: number
  onHover: (entity: Entity | null) => void
  onClick: (entity: Entity) => void
}

// Lucide-react Plane icon path (24x24 viewBox, MIT). Inlined rather than
// instantiated as a component so we can scale, position, and stroke-style
// uniformly within the parent SVG without nested-svg quirks.
const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'

export const EntityDot = memo(function EntityDot({
  entity,
  x,
  y,
  role,
  minor = false,
  hovered = false,
  hitRadius = 6,
  zoom = 1,
  onHover,
  onClick,
}: EntityDotProps) {
  const isActive = role !== 'none'
  // Source and target are already drawn large, and hovering one opens its card.
  // Growing the mark as well is a third signal for the same thing.
  const grows = hovered && !isActive
  const opacity = isActive || hovered ? 1 : minor ? 0.25 : 0.5

  // Only the fade is animated. Sizes step when the map settles, and animating
  // that on a few thousand dots is the difference between a frame and a stall.
  const handlers = {
    className: 'cursor-pointer transition-opacity duration-150',
    onMouseEnter: () => onHover(entity),
    onMouseLeave: () => onHover(null),
    onClick: () => onClick(entity),
  }

  if (entity.kind === 'airport') {
    // Lucide Plane silhouette, filled (no stroke), centered on (x, y).
    // Filled solid so the marker reads at the same optical weight as the
    // city dots without an outline ringing the shape.
    const base = isActive ? 14 : minor ? 9 : 11
    const size = (grows ? base * 1.45 : base) / zoom
    const scale = size / 24
    return (
      <g transform={`translate(${x} ${y})`} {...handlers}>
        {/* Transparent catchment, drawn first so the plane sits on top of it. */}
        <circle cx={0} cy={0} r={hitRadius / zoom} fill="transparent" />
        <path
          d={PLANE_PATH}
          fill="var(--color-accent)"
          opacity={opacity}
          transform={`scale(${scale}) translate(-12 -12)`}
        />
      </g>
    )
  }

  // One circle, not two: the catchment is a transparent stroke around the mark,
  // and `pointer-events: all` makes it catch despite painting nothing. At
  // cityDensity 'all' that halves the elements in the layer.
  const base = isActive ? 4.5 : minor ? 1 : 2.5
  const r = (grows ? base * 1.8 : base) / zoom
  return (
    <circle
      cx={x}
      cy={y}
      r={r}
      strokeWidth={Math.max(0, hitRadius / zoom - r) * 2}
      fill="var(--color-accent)"
      stroke="transparent"
      opacity={opacity}
      pointerEvents="all"
      {...handlers}
    />
  )
})

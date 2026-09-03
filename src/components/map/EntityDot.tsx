import { memo } from 'react'
import type { Entity } from '@/engine/entities'
import { airportMarkSize, cityDotRadius, dotOpacity } from './markStyle'

export type EntityRole = 'source' | 'target' | 'none'

interface EntityDotProps {
  entity: Entity
  x: number
  y: number
  role: EntityRole
  minor?: boolean
  /** True when this entity is hovered — including via its label or hover card. */
  hovered?: boolean
  /**
   * The map scale to size against — the *settled* one, not the live one. Every
   * measurement here is divided by it, so a marker holds one size on screen and
   * the emphasis between marks keeps the ratio it has at rest.
   *
   * Re-sizing thousands of dots on every frame of a gesture is what made a wheel
   * tick cost a second, so mid-gesture they ride the map's own transform and
   * come back to size when it stops — a beat too short to read on one tick.
   */
  zoom?: number
}

// Lucide-react Plane icon path (24x24 viewBox, MIT). Inlined rather than
// instantiated as a component so we can scale, position, and stroke-style
// uniformly within the parent SVG without nested-svg quirks.
const PLANE_PATH =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'

/**
 * One mark, drawn but not pointed at.
 *
 * Hit-testing belongs to the layer. The plain dots are painted a few thousand
 * at a time as a single path each, so the browser cannot say which of them the
 * cursor is over and the layer resolves it against a spatial index instead —
 * which means every mark, this one included, stays out of the way of pointers.
 */
export const EntityDot = memo(function EntityDot({
  entity,
  x,
  y,
  role,
  minor = false,
  hovered = false,
  zoom = 1,
}: EntityDotProps) {
  const opacity = dotOpacity(role, minor, hovered)

  if (entity.kind === 'airport') {
    // Lucide Plane silhouette, filled (no stroke), centered on (x, y).
    // Filled solid so the marker reads at the same optical weight as the
    // city dots without an outline ringing the shape.
    const scale = airportMarkSize(role, minor, hovered) / zoom / 24
    return (
      <path
        d={PLANE_PATH}
        fill="var(--color-accent)"
        opacity={opacity}
        transform={`translate(${x} ${y}) scale(${scale}) translate(-12 -12)`}
        style={{ pointerEvents: 'none' }}
      />
    )
  }

  return (
    <circle
      cx={x}
      cy={y}
      r={cityDotRadius(role, minor, hovered) / zoom}
      fill="var(--color-accent)"
      opacity={opacity}
      className="transition-opacity duration-150"
      style={{ pointerEvents: 'none' }}
    />
  )
})

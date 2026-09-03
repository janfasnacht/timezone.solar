import type { EntityRole } from './EntityDot'

/**
 * Source and target are already drawn large, and hovering one opens its card.
 * Growing the mark as well is a third signal for the same thing.
 */
const grows = (role: EntityRole, hovered: boolean) => hovered && role === 'none'

/** Visible radius of a city dot, in frame units at the resting view. */
export function cityDotRadius(role: EntityRole, minor: boolean, hovered: boolean): number {
  const base = role !== 'none' ? 4.5 : minor ? 1 : 2.5
  return grows(role, hovered) ? base * 1.8 : base
}

/** The size of a plane, on the same terms. */
export function airportMarkSize(role: EntityRole, minor: boolean, hovered: boolean): number {
  const base = role !== 'none' ? 14 : minor ? 9 : 11
  return grows(role, hovered) ? base * 1.45 : base
}

/** How faint a mark is drawn: the ones that answer the query are solid. */
export function dotOpacity(role: EntityRole, minor: boolean, hovered: boolean): number {
  if (role !== 'none' || hovered) return 1
  return minor ? 0.25 : 0.5
}

import { memo } from 'react'
import type { Entity } from '@/engine/entities'
import { EntityDot, type EntityRole } from './EntityDot'

export interface ProjectedEntity {
  entity: Entity
  rank: number
  x: number
  y: number
}

interface EntityLayerProps {
  entities: readonly ProjectedEntity[]
  hitRadii: readonly number[]
  roles: ReadonlyMap<string, EntityRole>
  hoveredSlug: string | null
  /** Below this rank a dot is an incidental mark, or null when none are. */
  minorBelow: number | null
  /** The settled map scale the marks are sized against. */
  zoom: number
  onHover: (entity: Entity | null) => void
  onClick: (entity: Entity) => void
}

/**
 * Memoised on the density pass's output, which only changes when the view has
 * settled — so a wheel tick never walks several thousand dots.
 */
export const EntityLayer = memo(function EntityLayer({
  entities,
  hitRadii,
  roles,
  hoveredSlug,
  minorBelow,
  zoom,
  onHover,
  onClick,
}: EntityLayerProps) {
  return (
    <>
      {entities.map(({ entity, rank, x, y }, i) => (
        <EntityDot
          key={entity.slug}
          entity={entity}
          x={x}
          y={y}
          role={roles.get(entity.slug) ?? 'none'}
          minor={minorBelow !== null && rank < minorBelow}
          hovered={hoveredSlug === entity.slug}
          hitRadius={hitRadii[i]}
          zoom={zoom}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </>
  )
})

export interface PlacedLabel {
  slug: string
  text: string
  x: number
  y: number
  anchor: 'start' | 'end'
}

interface LabelLayerProps {
  labels: readonly PlacedLabel[]
  /** Label size in map units, the live zoom already divided out. */
  font: number
}

/** Font size divided by the zoom, so labels hold one size on screen. There are
 *  twenty of these at most, so they follow the gesture frame by frame. */
export const LabelLayer = memo(function LabelLayer({ labels, font }: LabelLayerProps) {
  return (
    <>
      {labels.map((label) => (
        <text
          key={label.slug}
          x={label.x}
          y={label.y}
          textAnchor={label.anchor}
          fontFamily="var(--font-sans)"
          fill="var(--color-foreground)"
          stroke="var(--color-background)"
          strokeOpacity={0.5}
          paintOrder="stroke"
          opacity={0.75}
          fontSize={font}
          strokeWidth={font * 0.15}
          style={{ pointerEvents: 'none' }}
        >
          {label.text}
        </text>
      ))}
    </>
  )
})

import { memo, useCallback, useMemo } from 'react'
import type { Entity } from '@/engine/entities'
import type { DotIndex } from '@/engine/map-density'
import { EntityDot, type EntityRole } from './EntityDot'
import { cityDotRadius, dotOpacity } from './markStyle'

export interface ProjectedEntity {
  entity: Entity
  rank: number
  x: number
  y: number
}

interface EntityLayerProps {
  entities: readonly ProjectedEntity[]
  /** Catchments and the pointer lookup, built over the same entities. */
  index: DotIndex
  roles: ReadonlyMap<string, EntityRole>
  hoveredSlug: string | null
  /** Below this rank a dot is an incidental mark, or null when none are. */
  minorBelow: number | null
  /** The settled map scale the marks are sized against. */
  zoom: number
  onHover: (entity: Entity | null) => void
  onClick: (entity: Entity) => void
}

/** Two decimals is a twentieth of a pixel at full zoom, and halves the path. */
const dotAt = (p: ProjectedEntity) => `M${p.x.toFixed(2)} ${p.y.toFixed(2)}l0 0`

interface Bulk {
  /** Path data for every dot at this size, drawn as one element. */
  d: string
  radius: number
  opacity: number
}

/**
 * A zero-length subpath with a round cap is a dot, so a whole tier of the map is
 * one `d` string rather than one element per place. The cost is that the browser
 * can no longer say which dot a pointer is over — see `buildCatchments`.
 */
function buildBulk(
  entities: readonly ProjectedEntity[],
  skip: ReadonlySet<string>,
  minorBelow: number | null,
  zoom: number
): Bulk[] {
  const plain: string[] = []
  const minor: string[] = []
  for (const p of entities) {
    if (p.entity.kind === 'airport' || skip.has(p.entity.slug)) continue
    const isMinor = minorBelow !== null && p.rank < minorBelow
    ;(isMinor ? minor : plain).push(dotAt(p))
  }
  const tier = (parts: string[], isMinor: boolean): Bulk[] =>
    parts.length === 0
      ? []
      : [
          {
            d: parts.join(''),
            radius: cityDotRadius('none', isMinor, false) / zoom,
            opacity: dotOpacity('none', isMinor, false),
          },
        ]
  return [...tier(plain, false), ...tier(minor, true)]
}

/**
 * Transparent strokes wide enough to catch a pointer, one path per whole-unit
 * radius. The browser still decides whether the pointer is near any dot at all,
 * which keeps the timezone layer's own hover working in the gaps; which dot it
 * is comes from the index.
 */
function buildCatchments(entities: readonly ProjectedEntity[], radii: readonly number[]) {
  const byRadius = new Map<number, string[]>()
  entities.forEach((p, i) => {
    // Floored, never rounded up: a catchment must not reach past the radius the
    // index will test it against, or a pointer lands on the path and no dot.
    const r = Math.floor(radii[i])
    const parts = byRadius.get(r)
    if (parts) parts.push(dotAt(p))
    else byRadius.set(r, [dotAt(p)])
  })
  return [...byRadius].map(([radius, parts]) => ({ radius, d: parts.join('') }))
}

/**
 * Memoised on the density pass's output, which only changes when the view has
 * settled — so a wheel tick never walks several thousand dots.
 */
export const EntityLayer = memo(function EntityLayer({
  entities,
  index,
  roles,
  hoveredSlug,
  minorBelow,
  zoom,
  onHover,
  onClick,
}: EntityLayerProps) {
  // Source, target and whatever is under the cursor are drawn individually:
  // they carry their own size and opacity, and there are never more than three.
  const singled = useMemo(() => {
    const out: ProjectedEntity[] = []
    for (const p of entities) {
      if (p.entity.kind === 'airport' || roles.has(p.entity.slug) || p.entity.slug === hoveredSlug) {
        out.push(p)
      }
    }
    return out
  }, [entities, roles, hoveredSlug])

  // Only the query's own dots are cut out. The hovered one is left in and drawn
  // over — its mark is wider and opaque — so a pointer move never rebuilds the
  // path.
  const bulk = useMemo(
    () => buildBulk(entities, new Set(roles.keys()), minorBelow, zoom),
    [entities, roles, minorBelow, zoom]
  )
  const catchments = useMemo(() => buildCatchments(entities, index.radii), [entities, index])

  const entityAt = useCallback(
    (e: React.MouseEvent<SVGElement>): Entity | null => {
      const svg = e.currentTarget.ownerSVGElement
      const ctm = svg?.getScreenCTM()
      if (!svg || !ctm) return null
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      // Through the inverse CTM, so this reads frame units whatever the map's
      // pan, zoom and cover scale happen to be.
      const local = pt.matrixTransform(ctm.inverse())
      const found = index.nearest(local.x, local.y, zoom)
      return found === -1 ? null : entities[found].entity
    },
    [entities, index, zoom]
  )

  // A change of dot, not every pointer move: the card's open delay upstream is a
  // timer, and restarting it on each move means a card that never opens.
  const handleMove = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      const entity = entityAt(e)
      if ((entity?.slug ?? null) === hoveredSlug) return
      onHover(entity)
    },
    [entityAt, onHover, hoveredSlug]
  )

  const handleLeave = useCallback(() => onHover(null), [onHover])

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      const entity = entityAt(e)
      if (entity) onClick(entity)
    },
    [entityAt, onClick]
  )

  return (
    <>
      {bulk.map(({ d, radius, opacity }) => (
        <path
          key={radius}
          d={d}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={radius * 2}
          strokeLinecap="round"
          opacity={opacity}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {singled.map((p) => (
        <EntityDot
          key={p.entity.slug}
          entity={p.entity}
          x={p.x}
          y={p.y}
          role={roles.get(p.entity.slug) ?? 'none'}
          minor={minorBelow !== null && p.rank < minorBelow}
          hovered={hoveredSlug === p.entity.slug}
          zoom={zoom}
        />
      ))}

      {catchments.map(({ radius, d }) => (
        <path
          key={radius}
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={(radius * 2) / zoom}
          strokeLinecap="round"
          className="cursor-pointer"
          style={{ pointerEvents: 'stroke' }}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          onClick={handleClick}
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

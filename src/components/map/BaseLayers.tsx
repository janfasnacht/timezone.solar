import { memo } from 'react'

interface BaseLayersProps {
  frame: { x: number; y: number; w: number; h: number }
  /** Live map scale. Stroke weights divide it out so a coastline stays a line. */
  zoom: number
  landPath: string
  countriesPath: string
  graticulePath: string
  showGrid: boolean
  showBorders: boolean
}

/**
 * Everything whose geometry is fixed by the projection rather than by the view;
 * only the stroke weights follow the gesture. The timezone bands go between
 * this and the terminator, so the night side is its own component.
 */
export const BaseLayers = memo(function BaseLayers({
  frame,
  zoom,
  landPath,
  countriesPath,
  graticulePath,
  showGrid,
  showBorders,
}: BaseLayersProps) {
  const zoomInv = 1 / zoom
  return (
    <>
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--color-background)" />

      {showGrid && (
        <path
          d={graticulePath}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={0.4 * zoomInv}
          strokeOpacity={0.7}
        />
      )}

      <path
        d={landPath}
        fill="var(--color-muted)"
        stroke="var(--color-border)"
        strokeWidth={0.5 * zoomInv}
      />

      {showBorders && (
        <path
          d={countriesPath}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeOpacity={0.5}
          strokeWidth={0.3 * zoomInv}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </>
  )
})

export const TerminatorLayer = memo(function TerminatorLayer({ d }: { d: string }) {
  return (
    <path
      d={d}
      fill="rgba(0, 0, 0, 0.25)"
      className="dark:fill-[rgba(0,0,0,0.4)]"
      style={{ pointerEvents: 'none' }}
    />
  )
})

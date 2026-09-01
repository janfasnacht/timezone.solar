import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

interface MapZoomControlProps {
  zoom: number
  min: number
  max: number
  onZoom: (delta: number) => void
  onReset: () => void
}

const ICON_BUTTON =
  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'

/**
 * The zoom, and a way to move it a step at a time — the same shape as the time
 * control it sits opposite, down to the reset that only shows once there is
 * something to reset.
 *
 * That reset trails the stepper rather than leading it. A stepper gets clicked
 * repeatedly, so nothing may move under the cursor when it appears; this pill is
 * anchored left, so it has to grow rightward. The time control prepends for the
 * same reason, being anchored right.
 */
export function MapZoomControl({ zoom, min, max, onZoom, onReset }: MapZoomControlProps) {
  const atRest = zoom <= min + 0.001

  return (
    <div className="flex h-10 items-center gap-0.5 rounded-full border border-border bg-surface/60 px-1.5 backdrop-blur-sm">
      <Tooltip label="Zoom out">
        <button onClick={() => onZoom(-1)} className={ICON_BUTTON} disabled={atRest} aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
      </Tooltip>
      <span
        className={`flex min-w-[2.75rem] justify-center px-1 font-mono text-sm leading-none font-medium ${
          atRest ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {zoom.toFixed(1)}×
      </span>
      <Tooltip label="Zoom in">
        <button
          onClick={() => onZoom(1)}
          className={ICON_BUTTON}
          disabled={zoom >= max - 0.001}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
      </Tooltip>
      {!atRest && (
        <Tooltip label="Back to the whole world">
          <button onClick={onReset} className={`${ICON_BUTTON} text-accent hover:text-accent`} aria-label="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

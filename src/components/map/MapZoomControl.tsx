import { Minus, Plus } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

interface MapZoomControlProps {
  zoom: number
  /** Resting zoom, the level the readout returns to. */
  min: number
  onZoom: (delta: number) => void
  onReset: () => void
}

const ICON_BUTTON =
  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

/**
 * The zoom, and a way to move it a step at a time — the same shape as the time
 * control it sits opposite.
 *
 * The readout is the way back: no separate reset button to appear and shove the
 * stepper sideways mid-click, and nothing dims at the limits, so the pill holds
 * one width and one weight the whole time.
 */
export function MapZoomControl({ zoom, min, onZoom, onReset }: MapZoomControlProps) {
  const atRest = zoom <= min + 0.001

  return (
    <div className="flex h-10 items-center gap-0.5 rounded-full border border-border bg-surface/60 px-1.5 backdrop-blur-sm">
      <Tooltip label="Zoom out">
        <button onClick={() => onZoom(-1)} className={ICON_BUTTON} aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip label={atRest ? 'Zoom level' : 'Back to the whole world'}>
        <button
          onClick={onReset}
          aria-label={atRest ? 'Zoom level' : 'Reset zoom'}
          className={`flex h-7 min-w-[2.9rem] cursor-pointer items-center justify-center rounded-full px-1 font-mono text-sm leading-none font-medium transition-colors ${
            atRest ? 'text-muted-foreground' : 'text-foreground hover:bg-muted'
          }`}
        >
          {zoom.toFixed(1)}×
        </button>
      </Tooltip>
      <Tooltip label="Zoom in">
        <button onClick={() => onZoom(1)} className={ICON_BUTTON} aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}

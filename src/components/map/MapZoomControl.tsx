import { Minus, Plus } from 'lucide-react'

interface MapZoomControlProps {
  zoom: number
  min: number
  max: number
  onZoom: (delta: number) => void
  onReset: () => void
}

const BUTTON =
  'flex h-8 w-8 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:text-muted-foreground'

/** Faded at rest so the gestures carry the map. The middle button reads the level and resets. */
export function MapZoomControl({ zoom, min, max, onZoom, onReset }: MapZoomControlProps) {
  const atRest = zoom <= min + 0.001
  return (
    <div
      className={`flex flex-col items-center overflow-hidden rounded-full border border-border bg-surface/60 backdrop-blur-sm transition-opacity duration-200 hover:opacity-100 ${
        atRest ? 'opacity-40' : 'opacity-100'
      }`}
    >
      <button className={BUTTON} onClick={() => onZoom(1)} disabled={zoom >= max - 0.001} aria-label="Zoom in">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        className="cursor-pointer border-y border-border px-1 py-1 font-mono text-[0.65rem] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
        onClick={onReset}
        disabled={atRest}
        aria-label="Reset zoom"
        title="Reset zoom"
      >
        {zoom.toFixed(1)}×
      </button>
      <button className={BUTTON} onClick={() => onZoom(-1)} disabled={atRest} aria-label="Zoom out">
        <Minus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

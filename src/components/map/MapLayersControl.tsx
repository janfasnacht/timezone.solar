import { useState, useRef, useEffect } from 'react'
import { Layers } from 'lucide-react'
import type { CityDensity } from '@/components/map/WorldMap'

export interface MapLayers {
  showGrid: boolean
  showBorders: boolean
  showTimezones: boolean
  cityDensity: CityDensity
}

interface MapLayersControlProps {
  layers: MapLayers
  onChange: (next: Partial<MapLayers>) => void
  /** Wider rows and hit targets for touch. */
  roomy?: boolean
}

const DENSITIES: [CityDensity, string][] = [
  ['none', 'None'],
  ['main', 'Curated'],
  ['all', 'All'],
]

/** One layers panel for both breakpoints — the two copies had drifted apart. */
export function MapLayersControl({ layers, onChange, roomy = false }: MapLayersControlProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const gap = roomy ? 'gap-2.5' : 'gap-2'
  const box = roomy ? 'h-4 w-4' : ''

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className={`absolute bottom-12 left-0 flex min-w-[160px] flex-col rounded-xl border border-border bg-surface/90 p-3 text-sm backdrop-blur-sm ${roomy ? 'gap-2.5' : 'gap-2'}`}>
          <label className={`flex cursor-pointer items-center ${gap} text-foreground`}>
            <input type="checkbox" checked={layers.showGrid} onChange={() => onChange({ showGrid: !layers.showGrid })} className={`accent-accent ${box}`} />
            Grid
          </label>
          <label className={`flex cursor-pointer items-center ${gap} text-foreground`}>
            <input type="checkbox" checked={layers.showBorders} onChange={() => onChange({ showBorders: !layers.showBorders })} className={`accent-accent ${box}`} />
            Borders
          </label>
          <label className={`flex cursor-pointer items-center ${gap} text-foreground`}>
            <input type="checkbox" checked={layers.showTimezones} onChange={() => onChange({ showTimezones: !layers.showTimezones })} className={`accent-accent ${box}`} />
            Timezones
          </label>
          <div className="my-0.5 border-t border-border" />
          <div className="mb-0.5 text-xs font-medium text-muted-foreground">Cities</div>
          {DENSITIES.map(([level, label]) => (
            <label key={level} className={`flex cursor-pointer items-center ${gap} text-foreground`}>
              <input
                type="radio"
                name="cityDensity"
                checked={layers.cityDensity === level}
                onChange={() => onChange({ cityDensity: level })}
                className={`accent-accent ${box}`}
              />
              {label}
            </label>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/60 backdrop-blur-sm transition-colors hover:text-foreground ${
          open ? 'border-accent/40 text-accent' : 'text-muted-foreground'
        }`}
        title="Map layers"
        aria-label="Map layers"
        aria-expanded={open}
      >
        <Layers className="h-4 w-4" />
      </button>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { Layers } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { Tooltip } from '@/components/ui/Tooltip'
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
}

const DENSITIES: [CityDensity, string][] = [
  ['none', 'None'],
  ['main', 'Curated'],
  ['all', 'All'],
]

const ROW = 'flex h-7 cursor-pointer items-center gap-2.5 text-[0.8rem] text-foreground'

/** One layers panel for both breakpoints — the two copies had drifted apart. */
export function MapLayersControl({ layers, onChange }: MapLayersControlProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <Popover
      open={open}
      onClose={close}
      anchor="bottom-left"
      trigger={
        <Tooltip label="Map layers" side="right">
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border bg-surface/60 backdrop-blur-sm transition-colors ${
              open ? 'border-accent/40 text-accent' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Map layers"
            aria-expanded={open}
          >
            <Layers className="h-4 w-4" />
          </button>
        </Tooltip>
      }
    >
      <div className="flex flex-col">
        <label className={ROW}>
          <input type="checkbox" checked={layers.showGrid} onChange={() => onChange({ showGrid: !layers.showGrid })} className="h-3.5 w-3.5 accent-accent" />
          Grid
        </label>
        <label className={ROW}>
          <input type="checkbox" checked={layers.showBorders} onChange={() => onChange({ showBorders: !layers.showBorders })} className="h-3.5 w-3.5 accent-accent" />
          Borders
        </label>
        <label className={ROW}>
          <input type="checkbox" checked={layers.showTimezones} onChange={() => onChange({ showTimezones: !layers.showTimezones })} className="h-3.5 w-3.5 accent-accent" />
          Timezones
        </label>
        <div className="my-2 border-t border-border" />
        <span className="mb-1 text-[0.7rem] text-muted-foreground">Cities</span>
        {DENSITIES.map(([level, label]) => (
          <label key={level} className={ROW}>
            <input
              type="radio"
              name="cityDensity"
              checked={layers.cityDensity === level}
              onChange={() => onChange({ cityDensity: level })}
              className="h-3.5 w-3.5 accent-accent"
            />
            {label}
          </label>
        ))}
      </div>
    </Popover>
  )
}

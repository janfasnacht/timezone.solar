import { useState, useCallback } from 'react'
import { Layers } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { Tooltip } from '@/components/ui/Tooltip'
import type { Density } from '@/components/map/WorldMap'

export interface MapLayers {
  showGrid: boolean
  showBorders: boolean
  showTimezones: boolean
  cityDensity: Density
  airportDensity: Density
  labelDensity: Density
}

interface MapLayersControlProps {
  layers: MapLayers
  onChange: (next: Partial<MapLayers>) => void
}

/** How many, not which: every step is the same zoom-driven pass on a different budget. */
const STEPS: Density[] = ['none', 'few', 'auto', 'all']
const STEP_LABEL: Record<Density, string> = { none: 'None', few: 'Few', auto: 'Auto', all: 'All' }

const CHECK_ROW = 'flex h-7 cursor-pointer items-center gap-2.5 text-[0.8rem] text-foreground'
const SECTION = 'mb-1.5 text-[0.7rem] tracking-wide text-muted-foreground uppercase'

interface ScaleProps {
  label: string
  value: Density
  onChange: (next: Density) => void
  disabled?: boolean
}

/** The same segmented shape as the view switcher, sized for a popover row. */
function DensityScale({ label, value, onChange, disabled = false }: ScaleProps) {
  return (
    <div className={`flex h-8 items-center justify-between gap-2 ${disabled ? 'opacity-40' : ''}`}>
      <span className="truncate text-[0.8rem] text-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex h-7 shrink-0 items-center rounded-full border border-border bg-surface/60 p-0.5"
      >
        {STEPS.map((step) => {
          const active = value === step
          return (
            <button
              key={step}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(step)}
              className={`h-6 w-[2.35rem] cursor-pointer rounded-full text-[0.7rem] font-medium transition-colors duration-200 disabled:cursor-default ${
                active ? 'bg-muted text-foreground' : 'text-muted-foreground/70 hover:text-foreground'
              }`}
            >
              {STEP_LABEL[step]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** One layers panel for both breakpoints — the two copies had drifted apart. */
export function MapLayersControl({ layers, onChange }: MapLayersControlProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  // Nothing on the map to name once both place layers are off.
  const nothingToLabel = layers.cityDensity === 'none' && layers.airportDensity === 'none'

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
        <span className={SECTION}>Places</span>
        <DensityScale
          label="Cities"
          value={layers.cityDensity}
          onChange={(cityDensity) => onChange({ cityDensity })}
        />
        <DensityScale
          label="Airports"
          value={layers.airportDensity}
          onChange={(airportDensity) => onChange({ airportDensity })}
        />
        <DensityScale
          label="Names"
          value={layers.labelDensity}
          onChange={(labelDensity) => onChange({ labelDensity })}
          disabled={nothingToLabel}
        />

        <div className="my-2.5 border-t border-border" />

        <span className={SECTION}>Basemap</span>
        <label className={CHECK_ROW}>
          <input type="checkbox" checked={layers.showGrid} onChange={() => onChange({ showGrid: !layers.showGrid })} className="h-3.5 w-3.5 accent-accent" />
          Grid
        </label>
        <label className={CHECK_ROW}>
          <input type="checkbox" checked={layers.showBorders} onChange={() => onChange({ showBorders: !layers.showBorders })} className="h-3.5 w-3.5 accent-accent" />
          Borders
        </label>
        <label className={CHECK_ROW}>
          <input type="checkbox" checked={layers.showTimezones} onChange={() => onChange({ showTimezones: !layers.showTimezones })} className="h-3.5 w-3.5 accent-accent" />
          Timezones
        </label>
      </div>
    </Popover>
  )
}

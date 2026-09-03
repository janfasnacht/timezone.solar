import { useState, useCallback } from 'react'
import { Layers } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { Tooltip } from '@/components/ui/Tooltip'
import { MenuDivider, MENU_SECTION, Segmented, Switch } from '@/components/ui/MenuControls'
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
const STEP_OPTIONS = STEPS.map((value) => ({ value, label: STEP_LABEL[value] }))

/** One layers panel for both breakpoints — the two copies had drifted apart. */
export function MapLayersControl({ layers, onChange }: MapLayersControlProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  // Labels name whatever is drawn — cities and airports both — so they only go
  // dead once there is nothing on the map at all.
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
        <span className={MENU_SECTION}>Places</span>
        <Segmented<Density>
          label="Cities"
          options={STEP_OPTIONS}
          value={layers.cityDensity}
          onChange={(cityDensity) => onChange({ cityDensity })}
        />
        <Segmented<Density>
          label="Airports"
          options={STEP_OPTIONS}
          value={layers.airportDensity}
          onChange={(airportDensity) => onChange({ airportDensity })}
        />
        <Segmented<Density>
          label="Labels"
          options={STEP_OPTIONS}
          value={layers.labelDensity}
          onChange={(labelDensity) => onChange({ labelDensity })}
          disabled={nothingToLabel}
        />

        <MenuDivider />

        <span className={MENU_SECTION}>Basemap</span>
        <Switch label="Grid" checked={layers.showGrid} onChange={(showGrid) => onChange({ showGrid })} />
        <Switch label="Borders" checked={layers.showBorders} onChange={(showBorders) => onChange({ showBorders })} />
        <Switch label="Timezones" checked={layers.showTimezones} onChange={(showTimezones) => onChange({ showTimezones })} />
      </div>
    </Popover>
  )
}

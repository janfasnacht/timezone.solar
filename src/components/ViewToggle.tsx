import { m, useReducedMotion } from 'motion/react'
import { CardIcon, MapIcon } from '@/components/ViewIcons'
import type { ViewMode } from '@/hooks/useUrlState'

interface ViewToggleProps {
  view: ViewMode
  onChange: (view: ViewMode) => void
  className?: string
}

const OPTIONS: { value: ViewMode; label: string; Icon: typeof CardIcon }[] = [
  { value: 'card', label: 'Card', Icon: CardIcon },
  { value: 'map', label: 'Map', Icon: MapIcon },
]

/**
 * The card/map choice, rendered next to the query input. Both options render the
 * same result, so this is a parallel choice rather than a navigation step.
 */
export function ViewToggle({ view, onChange, className }: ViewToggleProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      role="group"
      aria-label="Result view"
      className={`inline-flex items-center rounded-full border border-border bg-surface/60 p-0.5 backdrop-blur-sm${className ? ` ${className}` : ''}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = view === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`relative flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
              active ? 'text-foreground' : 'text-muted-foreground/70 hover:text-foreground'
            }`}
          >
            {active && (
              <m.span
                layoutId="view-toggle-indicator"
                className="absolute inset-0 rounded-full bg-muted"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon size={14} strokeWidth={active ? 1.6 : 1.2} />
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

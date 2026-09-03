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
  return (
    <div
      role="group"
      aria-label="Result view"
      className={`inline-flex h-10 items-center rounded-full border border-border bg-surface/60 p-1 backdrop-blur-sm${className ? ` ${className}` : ''}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = view === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`flex h-8 w-[76px] cursor-pointer items-center justify-center gap-1.5 rounded-full text-[0.8rem] font-medium transition-colors duration-200 ${
              active ? 'bg-muted text-foreground' : 'text-muted-foreground/70 hover:text-foreground'
            }`}
          >
            <Icon size={14} strokeWidth={active ? 1.6 : 1.2} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

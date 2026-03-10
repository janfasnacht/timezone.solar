import { Globe } from 'lucide-react'
import type { ViewMode } from '@/hooks/useUrlState'

interface ViewToggleProps {
  view: ViewMode
  onToggle: (view: ViewMode) => void
}

export function ViewToggle({ view, onToggle }: ViewToggleProps) {
  return (
    <button
      onClick={() => onToggle(view === 'card' ? 'map' : 'card')}
      className={`rounded-full p-2 transition-colors ${
        view === 'map'
          ? 'text-accent hover:text-accent-foreground'
          : 'text-muted-foreground/50 hover:text-muted-foreground'
      }`}
      aria-label={view === 'card' ? 'Switch to map view' : 'Switch to card view'}
      title={view === 'card' ? 'Map view' : 'Card view'}
    >
      <Globe size={18} />
    </button>
  )
}

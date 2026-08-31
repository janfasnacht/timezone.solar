import { CardIcon, MapIcon, CalendarIcon } from '@/components/ViewIcons'
import type { ViewMode } from '@/hooks/useUrlState'

interface MobileTabBarProps {
  activeTab: ViewMode
  onTabChange: (tab: ViewMode) => void
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  const tabs: { id: ViewMode; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    { id: 'card', label: 'Convert', icon: (a) => <CardIcon size={20} strokeWidth={a ? 1.5 : 1.2} /> },
    { id: 'map', label: 'Map', icon: (a) => <MapIcon size={20} strokeWidth={a ? 1.5 : 1.2} /> },
    { id: 'share', label: 'Calendar', icon: (a) => <CalendarIcon size={20} strokeWidth={a ? 1.5 : 1.2} /> },
  ]

  return (
    <nav
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <div className="pointer-events-auto flex items-stretch gap-1 rounded-full border border-border bg-surface/80 p-1 shadow-lg backdrop-blur-md">
      {tabs.map(({ id, label, icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex min-w-[68px] flex-col items-center gap-0.5 rounded-full px-3 py-2 transition-colors ${
              active ? 'bg-muted text-accent' : 'text-muted-foreground'
            }`}
          >
            {icon(active)}
            <span className="text-[0.65rem] font-medium">{label}</span>
          </button>
        )
      })}
      </div>
    </nav>
  )
}

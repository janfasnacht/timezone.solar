import { CardIcon, MapIcon, ShareIcon } from '@/components/ViewIcons'
import type { ViewMode } from '@/hooks/useUrlState'

export type MobileTab = ViewMode | 'settings'

interface MobileTabBarProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={active ? '1.5' : '1.2'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.86 1.45a1.2 1.2 0 0 1 2.28 0l.2.6a1.2 1.2 0 0 0 1.55.7l.58-.23a1.2 1.2 0 0 1 1.61 1.14l-.02.62a1.2 1.2 0 0 0 1.02 1.22l.61.1a1.2 1.2 0 0 1 .8 2.03l-.44.44a1.2 1.2 0 0 0-.15 1.58l.35.52a1.2 1.2 0 0 1-.57 1.84l-.58.2a1.2 1.2 0 0 0-.78 1.38l.12.61a1.2 1.2 0 0 1-1.72 1.22l-.52-.33a1.2 1.2 0 0 0-1.53.24l-.38.49a1.2 1.2 0 0 1-2.14-.43l-.13-.61a1.2 1.2 0 0 0-1.28-.95l-.62.05a1.2 1.2 0 0 1-1.18-1.58l.22-.58a1.2 1.2 0 0 0-.65-1.52l-.56-.26a1.2 1.2 0 0 1-.24-2.1l.5-.37a1.2 1.2 0 0 0 .43-1.5l-.28-.56a1.2 1.2 0 0 1 1.1-1.72h.62a1.2 1.2 0 0 0 1.17-.88l.14-.61Z" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  )
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  const tabs: { id: MobileTab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    { id: 'card', label: 'Convert', icon: (a) => <CardIcon size={20} strokeWidth={a ? 1.5 : 1.2} /> },
    { id: 'map', label: 'Map', icon: (a) => <MapIcon size={20} strokeWidth={a ? 1.5 : 1.2} /> },
    { id: 'share', label: 'Share', icon: (a) => <ShareIcon size={20} strokeWidth={a ? 1.5 : 1.2} /> },
    { id: 'settings', label: 'Settings', icon: (a) => <GearIcon active={a} /> },
  ]

  return (
    <nav className="flex items-stretch border-t border-border bg-background/95 backdrop-blur-sm" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(({ id, label, icon }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
              active ? 'text-accent' : 'text-muted-foreground'
            }`}
          >
            {icon(active)}
            <span className="text-[0.65rem] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

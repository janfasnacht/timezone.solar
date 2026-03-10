import { Sun, Moon, Monitor, Globe } from 'lucide-react'
import { usePreferences } from '@/hooks/usePreferences'
import { useLiveClock } from '@/hooks/useLiveClock'
import type { HomeCity } from '@/lib/preferences'

interface MapNavProps {
  homeCity: HomeCity | null
}

export function MapNav({ homeCity }: MapNavProps) {
  const { theme, timeFormat, setTheme } = usePreferences()
  const use24h = timeFormat === '24h'
  const homeIana = homeCity?.iana ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const homeName = homeCity?.city ?? homeIana.split('/').pop()?.replace(/_/g, ' ') ?? ''
  const clock = useLiveClock(homeIana, use24h)

  const cycleTheme = () => {
    const order = ['system', 'light', 'dark'] as const
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <nav className="absolute top-4 left-4 z-40 flex items-center gap-3">
      <a
        href="/"
        className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border rounded-full px-4 py-2 text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
      >
        <Globe className="w-4 h-4 text-accent" />
        <span className="font-serif italic">timezone.solar</span>
      </a>
      <div className="bg-surface/80 backdrop-blur-sm border border-border rounded-full px-4 py-2 flex items-center gap-2">
        <span className="font-mono text-foreground text-sm font-medium">{clock}</span>
        <span className="text-muted-foreground text-xs">{homeName}</span>
      </div>
      <button
        onClick={cycleTheme}
        className="bg-surface/80 backdrop-blur-sm border border-border rounded-full p-2 text-foreground hover:bg-surface-hover transition-colors"
        title={`Theme: ${theme}`}
      >
        <ThemeIcon className="w-4 h-4" />
      </button>
    </nav>
  )
}

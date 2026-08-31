import { useSyncExternalStore } from 'react'
import { subscribe, getSnapshot, setTheme, setTimeFormat, setHomeCity, resolveSystemTimeFormat } from '@/lib/preferences'

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot)
  // Callers want to know which clock to render, not which preference is stored.
  const use24h = (prefs.timeFormat === 'system' ? resolveSystemTimeFormat() : prefs.timeFormat) === '24h'
  return { ...prefs, use24h, setTheme, setTimeFormat, setHomeCity }
}

import { useSyncExternalStore } from 'react'
import { subscribe, getSnapshot, setTheme, setTimeFormat, setHomeCity } from '@/lib/preferences'

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot)
  return { ...prefs, setTheme, setTimeFormat, setHomeCity }
}

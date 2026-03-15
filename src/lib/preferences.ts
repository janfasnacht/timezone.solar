export type ThemePreference = 'system' | 'light' | 'dark'
export type TimeFormat = '12h' | '24h'
export interface HomeCity {
  city: string
  iana: string
  country?: string
}
export interface Preferences {
  theme: ThemePreference
  timeFormat: TimeFormat
  homeCity: HomeCity | null
}

const STORAGE_KEY = 'tz-preferences'

const DEFAULTS: Preferences = {
  theme: 'system',
  timeFormat: '12h',
  homeCity: null,
}

let state: Preferences = load()
const listeners = new Set<() => void>()

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      theme: ['system', 'light', 'dark'].includes(parsed.theme) ? parsed.theme : DEFAULTS.theme,
      timeFormat: ['12h', '24h'].includes(parsed.timeFormat) ? parsed.timeFormat : DEFAULTS.timeFormat,
      homeCity: parsed.homeCity && parsed.homeCity.iana ? parsed.homeCity : DEFAULTS.homeCity,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

function notify() {
  for (const fn of listeners) fn()
}

export function applyTheme(theme: ThemePreference) {
  const el = document.documentElement
  el.classList.remove('light', 'dark')
  if (theme === 'light') el.classList.add('light')
  else if (theme === 'dark') el.classList.add('dark')
}

export function setTheme(theme: ThemePreference) {
  state = { ...state, theme }
  applyTheme(theme)
  save()
  notify()
}

export function setTimeFormat(timeFormat: TimeFormat) {
  state = { ...state, timeFormat }
  save()
  notify()
}

export function setHomeCity(homeCity: HomeCity | null) {
  state = { ...state, homeCity }
  save()
  notify()
}

// Apply theme on module load
applyTheme(state.theme)

// useSyncExternalStore interface
export function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}

export function getSnapshot(): Preferences {
  return state
}

export type ThemePreference = 'system' | 'light' | 'dark'
export type TimeFormat = 'system' | '12h' | '24h'

/**
 * A 12-hour clock and the AM/PM marker are one axis, not two — a 12-hour clock
 * without a marker is ambiguous, and a 24-hour clock never carries one. The axis
 * that does vary independently is the default, which is regional: US browsers
 * report hour12, Swiss ones don't. Read it rather than guess it; this needs no
 * permission and no geolocation.
 */
export function resolveSystemTimeFormat(): '12h' | '24h' {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().hour12 ? '12h' : '24h'
  } catch {
    return '12h'
  }
}
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
  timeFormat: 'system',
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
      timeFormat: ['system', '12h', '24h'].includes(parsed.timeFormat) ? parsed.timeFormat : DEFAULTS.timeFormat,
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

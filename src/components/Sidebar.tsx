import { useState, useRef, useCallback } from 'react'
import { usePreferences } from '@/hooks/usePreferences'
import { searchCities } from '@/engine/resolver'
import type { ThemePreference, TimeFormat } from '@/lib/preferences'

interface SidebarProps {
  open: boolean
  onToggle: () => void
  onClose: () => void
  isMobile: boolean
}

const RAIL_WIDTH = 44
const PANEL_WIDTH = 260
const EXPANDED_WIDTH = RAIL_WIDTH + PANEL_WIDTH

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
            value === opt.value
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SettingRow({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-[0.8rem] text-muted-foreground">{label}</span>
        {children}
      </div>
    )
  }
  return (
    <div>
      <span className="mb-2 block text-[0.8rem] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  )
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.86 1.45a1.2 1.2 0 0 1 2.28 0l.2.6a1.2 1.2 0 0 0 1.55.7l.58-.23a1.2 1.2 0 0 1 1.61 1.14l-.02.62a1.2 1.2 0 0 0 1.02 1.22l.61.1a1.2 1.2 0 0 1 .8 2.03l-.44.44a1.2 1.2 0 0 0-.15 1.58l.35.52a1.2 1.2 0 0 1-.57 1.84l-.58.2a1.2 1.2 0 0 0-.78 1.38l.12.61a1.2 1.2 0 0 1-1.72 1.22l-.52-.33a1.2 1.2 0 0 0-1.53.24l-.38.49a1.2 1.2 0 0 1-2.14-.43l-.13-.61a1.2 1.2 0 0 0-1.28-.95l-.62.05a1.2 1.2 0 0 1-1.18-1.58l.22-.58a1.2 1.2 0 0 0-.65-1.52l-.56-.26a1.2 1.2 0 0 1-.24-2.1l.5-.37a1.2 1.2 0 0 0 .43-1.5l-.28-.56a1.2 1.2 0 0 1 1.1-1.72h.62a1.2 1.2 0 0 0 1.17-.88l.14-.61Z" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  )
}

export { RAIL_WIDTH, EXPANDED_WIDTH }

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { theme, timeFormat, homeCity, telemetryOptOut, setTheme, setTimeFormat, setHomeCity, setTelemetryOptOut } = usePreferences()

  const [cityInput, setCityInput] = useState(homeCity?.city ?? '')
  const [suggestions, setSuggestions] = useState<{ city: string; country: string; iana: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleCityChange = (value: string) => {
    setCityInput(value)
    if (value.trim().length >= 2) {
      const results = searchCities(value.trim())
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelectCity = (s: { city: string; country: string; iana: string }) => {
    clearTimeout(blurTimeout.current)
    setHomeCity({ city: s.city, iana: s.iana, country: s.country })
    setCityInput(s.city)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleClearCity = () => {
    setHomeCity(null)
    setCityInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleCityBlur = () => {
    blurTimeout.current = setTimeout(() => {
      setShowSuggestions(false)
    }, 150)
  }

  const handleAboutClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onClose()
    history.pushState(null, '', '/about')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="flex h-full flex-col" style={{ width: PANEL_WIDTH }}>
      {/* Main settings */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
        <div className="space-y-5">
          {/* Theme */}
          <SettingRow label="Theme">
            <SegmentedControl<ThemePreference>
              options={[
                { label: 'System', value: 'system' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </SettingRow>

          {/* Time format */}
          <SettingRow label="Time format">
            <SegmentedControl<TimeFormat>
              options={[
                { label: '12h', value: '12h' },
                { label: '24h', value: '24h' },
              ]}
              value={timeFormat}
              onChange={setTimeFormat}
            />
          </SettingRow>

          {/* Home city */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.8rem] text-muted-foreground">Home city</span>
              {homeCity && (
                <button
                  onClick={handleClearCity}
                  className="text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => handleCityChange(e.target.value)}
                onFocus={() => {
                  if (cityInput.trim().length >= 2 && suggestions.length > 0) {
                    setShowSuggestions(true)
                  }
                }}
                onBlur={handleCityBlur}
                placeholder="Search for a city..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8rem] outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.city}-${s.iana}`}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[0.8rem] transition-colors hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSelectCity(s)
                      }}
                    >
                      <span className="text-foreground">
                        {s.city}
                        <span className="text-muted-foreground">, {s.country}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {homeCity && (
              <p className="mt-1.5 font-mono text-[0.65rem] text-muted-foreground/60">
                {homeCity.city}{homeCity.country ? `, ${homeCity.country}` : ''} ({homeCity.iana})
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Keyboard shortcuts */}
          <div>
            <p className="mb-3 text-[0.7rem] font-medium tracking-wide text-muted-foreground/40 uppercase">Shortcuts</p>
            <div className="space-y-2.5 text-[0.75rem]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Submit</span>
                <Kbd>Enter</Kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Clear</span>
                <Kbd>Esc</Kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Focus</span>
                <Kbd>&#8984;K</Kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Examples</span>
                <Kbd>&#8984;/</Kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">History</span>
                <Kbd>&uarr; &darr;</Kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-4 border-t border-border px-5 py-4">
        <a
          href="/about"
          onClick={handleAboutClick}
          className="block text-[0.75rem] text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          About & usage
        </a>
        <SettingRow label="Help improve timezone.solar" inline>
          <button
            role="switch"
            aria-checked={!telemetryOptOut}
            onClick={() => setTelemetryOptOut(!telemetryOptOut)}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              !telemetryOptOut ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full bg-background transition-transform ${
                !telemetryOptOut ? 'translate-x-[14px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </SettingRow>
      </div>
    </div>
  )
}

export function Sidebar({ open, onToggle, onClose, isMobile }: SidebarProps) {
  const touchStart = useRef({ x: 0, y: 0 })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onClose()
    }
  }, [onClose])

  if (isMobile) {
    return (
      <>
        {/* Floating gear button */}
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-background/80 text-muted-foreground/50 shadow-sm backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground"
          aria-label={open ? 'Close settings' : 'Open settings'}
        >
          <GearIcon />
        </button>

        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={onClose}
        />

        {/* Overlay panel */}
        <div
          className={`fixed top-0 left-0 z-40 flex h-full flex-col border-r border-border bg-background transition-transform duration-200 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ width: PANEL_WIDTH }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button — aligned with floating gear (top-4 left-4, h-9) */}
          <div className="flex flex-shrink-0 justify-end px-4 pt-4">
            <button
              onClick={onClose}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close settings"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <SidebarContent onClose={onClose} />
          </div>
        </div>
      </>
    )
  }

  // Desktop: rail + expanding panel
  return (
    <div
      className="fixed top-0 left-0 z-40 flex h-full"
      style={{ width: open ? EXPANDED_WIDTH : RAIL_WIDTH }}
    >
      {/* Collapsed rail */}
      <div
        className="flex h-full flex-shrink-0 flex-col items-center border-r border-border bg-background pt-4"
        style={{ width: RAIL_WIDTH }}
      >
        <button
          onClick={onToggle}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <GearIcon />
        </button>
      </div>

      {/* Expanded panel */}
      <div
        className="h-full overflow-hidden border-r border-border bg-background transition-[width] duration-200 ease-out"
        style={{ width: open ? PANEL_WIDTH : 0 }}
      >
        <SidebarContent onClose={onClose} />
      </div>
    </div>
  )
}

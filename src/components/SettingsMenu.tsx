import { useState, useRef, useEffect } from 'react'
import { usePreferences } from '@/hooks/usePreferences'
import { searchCities } from '@/engine/resolver'
import type { ThemePreference, TimeFormat } from '@/lib/preferences'

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
    <div className="inline-flex rounded-lg border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 text-[0.8rem] font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
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

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between py-1 text-[0.8rem] text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        {label}
        <svg
          width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
      {open && <div className="pt-2 pb-1">{children}</div>}
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


function SettingsPanel({ onClose, fullWidth = false }: { onClose: () => void; fullWidth?: boolean }) {
  const { theme, timeFormat, homeCity, setTheme, setTimeFormat, setHomeCity } = usePreferences()

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
    <div className={`flex flex-col ${fullWidth ? 'w-full' : 'w-[280px]'}`}>
      <div className="px-5 pt-5 pb-4">
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
                { label: 'System', value: 'system' },
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[0.85rem] outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.city}-${s.iana}`}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-3 text-left text-[0.85rem] transition-colors hover:bg-muted"
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

          {/* Shortcuts — collapsed by default so the panel fits without scrolling */}
          <Disclosure label="Shortcuts">
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
                  <span className="text-muted-foreground">Card / Map</span>
                  <Kbd>&#8984;M</Kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">History</span>
                  <Kbd>&uarr; &darr;</Kbd>
                </div>
              </div>
          </Disclosure>

          <Disclosure label="About & usage">
            <a
              href="/about"
              onClick={handleAboutClick}
              className="block text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              How timezone.solar reads your query &rarr;
            </a>
          </Disclosure>
        </div>
      </div>
    </div>
  )
}


interface SettingsMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mobile presents the same panel as a bottom sheet rather than a popover. */
  asSheet?: boolean
}

/**
 * Replaces the old desktop sidebar. Styled from the same tokens as the map's
 * layers control so every floating control on the page speaks one language.
 */
export function SettingsMenu({ open, onOpenChange, asSheet = false }: SettingsMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="relative">
      {open && (asSheet ? (
        <div
          className="fixed inset-x-3 z-50 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-lg backdrop-blur-md"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)' }}
        >
          <SettingsPanel onClose={() => onOpenChange(false)} fullWidth />
        </div>
      ) : (
        <div className="absolute top-12 right-0 overflow-hidden rounded-xl border border-border bg-surface/95 shadow-lg backdrop-blur-sm">
          <SettingsPanel onClose={() => onOpenChange(false)} />
        </div>
      ))}
      <button
        onClick={() => onOpenChange(!open)}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-surface/60 backdrop-blur-sm transition-colors hover:text-foreground ${
          open ? 'border-accent/40 text-accent' : 'text-muted-foreground'
        }`}
        aria-label={open ? 'Close settings' : 'Open settings'}
        aria-expanded={open}
        title="Settings"
      >
        <GearIcon />
      </button>
    </div>
  )
}

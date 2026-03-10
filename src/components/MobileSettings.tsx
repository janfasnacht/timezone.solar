import { useState, useRef } from 'react'
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
          className={`px-4 py-2 text-[0.85rem] font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
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

export function MobileSettings() {
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
    history.pushState(null, '', '/about')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-[520px] px-5 pt-6 pb-8">
        <h2 className="mb-6 text-lg font-semibold text-foreground">Settings</h2>

        <div className="space-y-6">
          {/* Theme */}
          <div>
            <span className="mb-2 block text-[0.85rem] text-muted-foreground">Theme</span>
            <SegmentedControl<ThemePreference>
              options={[
                { label: 'System', value: 'system' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ]}
              value={theme}
              onChange={setTheme}
            />
          </div>

          {/* Time format */}
          <div>
            <span className="mb-2 block text-[0.85rem] text-muted-foreground">Time format</span>
            <SegmentedControl<TimeFormat>
              options={[
                { label: '12h', value: '12h' },
                { label: '24h', value: '24h' },
              ]}
              value={timeFormat}
              onChange={setTimeFormat}
            />
          </div>

          {/* Home city */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.85rem] text-muted-foreground">Home city</span>
              {homeCity && (
                <button
                  onClick={handleClearCity}
                  className="text-sm text-muted-foreground/60 transition-colors hover:text-foreground"
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
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-[0.9rem] outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.city}-${s.iana}`}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-[0.9rem] transition-colors hover:bg-muted"
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
              <p className="mt-2 font-mono text-[0.75rem] text-muted-foreground/60">
                {homeCity.city}{homeCity.country ? `, ${homeCity.country}` : ''} ({homeCity.iana})
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Telemetry */}
          <div className="flex items-center justify-between">
            <span className="text-[0.85rem] text-muted-foreground">Help improve timezone.solar</span>
            <button
              role="switch"
              aria-checked={!telemetryOptOut}
              onClick={() => setTelemetryOptOut(!telemetryOptOut)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                !telemetryOptOut ? 'bg-accent' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-background transition-transform ${
                  !telemetryOptOut ? 'translate-x-[26px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>

          {/* About link */}
          <a
            href="/about"
            onClick={handleAboutClick}
            className="block text-[0.85rem] text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            About & usage
          </a>
        </div>
      </div>
    </div>
  )
}

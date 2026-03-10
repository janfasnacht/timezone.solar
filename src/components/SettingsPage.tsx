import { useState, useRef } from 'react'
import { HelpExamples } from '@/components/HelpExamples'
import { usePreferences } from '@/hooks/usePreferences'
import { searchCities } from '@/engine/resolver'
import type { ThemePreference, TimeFormat } from '@/lib/preferences'

interface SettingsPageProps {
  onRunQuery: (query: string) => void
}

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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.8rem] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function SettingsPage({ onRunQuery }: SettingsPageProps) {
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

  return (
    <div className="w-full space-y-4">
      {/* About + Usage examples */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-surface via-accent-soft to-surface" />
        <div className="px-[1.5rem] py-[1.2rem] text-[0.8rem] text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">timezone</span>
            <span className="font-semibold text-accent">.solar</span>
            {' '}&mdash; natural language time conversion.
          </p>
        </div>
        <div className="border-t border-border px-[1.5rem] py-[1.2rem]">
          <HelpExamples onRunQuery={onRunQuery} />
          <p className="mt-4 text-[0.7rem] text-muted-foreground/40">
            City icons by{' '}
            <a
              href="https://svgcities.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent/50 hover:text-accent hover:underline"
            >
              Studio Partdirector
            </a>
          </p>
        </div>
      </div>

      {/* Preferences */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-surface via-accent-soft to-surface" />

        <div className="divide-y divide-border">
          {/* Theme */}
          <div className="px-[1.5rem] py-[1rem]">
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
          </div>

          {/* Time format */}
          <div className="px-[1.5rem] py-[1rem]">
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
          </div>

          {/* Home city */}
          <div className="px-[1.5rem] py-[1rem]">
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
                      <span className="font-mono text-[0.65rem] text-muted-foreground/50">{s.iana}</span>
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

          {/* Telemetry */}
          <div className="px-[1.5rem] py-[1rem]">
            <SettingRow label="Help improve timezone.solar">
              <button
                role="switch"
                aria-checked={!telemetryOptOut}
                onClick={() => setTelemetryOptOut(!telemetryOptOut)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  !telemetryOptOut ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform ${
                    !telemetryOptOut ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  }`}
                />
              </button>
            </SettingRow>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Sends anonymous conversion data (timezones used, errors). No queries or personal data.
            </p>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-surface via-accent-soft to-surface" />
        <div className="px-[1.5rem] py-[1.2rem]">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem]">
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
  )
}

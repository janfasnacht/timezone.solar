import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { usePreferences } from '@/hooks/usePreferences'
import { searchCities } from '@/engine/resolver'
import type { ThemePreference, TimeFormat } from '@/lib/preferences'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
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

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { theme, timeFormat, homeCity, setTheme, setTimeFormat, setHomeCity } = usePreferences()

  const [cityInput, setCityInput] = useState(homeCity?.city ?? '')
  const [suggestions, setSuggestions] = useState<{ city: string; country: string; iana: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setCityInput(homeCity?.city ?? '')
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  if (!open) return null

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
    <div
      ref={panelRef}
      className="fixed bottom-12 left-1/2 z-50 w-80 -translate-x-1/2 rounded-lg border border-border bg-background p-4 shadow-lg"
      role="dialog"
      aria-label="Settings"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Settings</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close settings"
        >
          <X size={14} />
        </button>
      </div>

      {/* Theme */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Theme</span>
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
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Time format</span>
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
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Home city</span>
          {homeCity && (
            <button
              onClick={handleClearCity}
              className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
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
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-accent"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-border bg-background shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={`${s.city}-${s.iana}`}
                  type="button"
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelectCity(s)
                  }}
                >
                  <span className="text-foreground">{s.city}<span className="text-muted-foreground">, {s.country}</span></span>
                  <span className="text-[10px] text-muted-foreground/60">{s.iana}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {homeCity && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {homeCity.city}{homeCity.country ? `, ${homeCity.country}` : ''} ({homeCity.iana})
          </p>
        )}
      </div>
    </div>
  )
}

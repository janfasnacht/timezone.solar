import { useState, useRef, useCallback } from 'react'
import { DateTime } from 'luxon'
import { usePreferences } from '@/hooks/usePreferences'
import { useLiveClock } from '@/hooks/useLiveClock'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { searchCities } from '@/engine/resolver'
import { Popover } from '@/components/ui/Popover'
import { navigate } from '@/lib/navigate'
import type { ThemePreference, TimeFormat } from '@/lib/preferences'

/**
 * One row shape for every setting: a label, and the choices as the thing they
 * produce. You pick a clock by seeing the clock, not by reading "12h".
 */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { label: React.ReactNode; value: T; title: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[0.8rem] text-muted-foreground">{label}</span>
      <div className="inline-flex h-7 items-center rounded-lg border border-border p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-label={opt.title}
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex h-6 cursor-pointer items-center justify-center rounded-md px-2 text-[0.8rem] transition-colors ${
              value === opt.value
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.9 3.1l-1 1M4.1 11.9l-1 1M12.9 12.9l-1-1M4.1 4.1l-1-1" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 9.5A5.8 5.8 0 0 1 6.5 2.5a5.8 5.8 0 1 0 7 7Z" />
    </svg>
  )
}

/** The current value is the label; this box is the editor, not a prompt. */
function CityField({ detected, dropUp }: { detected: string; dropUp: boolean }) {
  const { homeCity, setHomeCity } = usePreferences()
  const [draft, setDraft] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<{ city: string; country: string; iana: string }[]>([])
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const value = draft ?? homeCity?.city ?? ''

  const select = (s: { city: string; country: string; iana: string }) => {
    clearTimeout(blurTimeout.current)
    setHomeCity({ city: s.city, iana: s.iana, country: s.country })
    setDraft(null)
    setSuggestions([])
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[0.8rem] text-muted-foreground">Your city</span>
        {homeCity && (
          <button
            type="button"
            onClick={() => {
              setHomeCity(null)
              setDraft(null)
              setSuggestions([])
            }}
            className="cursor-pointer text-[0.7rem] text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setDraft(e.target.value)
            setSuggestions(e.target.value.trim().length >= 2 ? searchCities(e.target.value.trim()) : [])
          }}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => {
              setSuggestions([])
              setDraft(null)
            }, 150)
          }}
          placeholder={detected}
          className="h-8 w-full rounded-lg border border-border bg-background px-2.5 font-serif text-[0.95rem] text-accent outline-none transition-colors placeholder:font-sans placeholder:text-[0.8rem] placeholder:text-muted-foreground/50 focus:border-accent"
        />
        {suggestions.length > 0 && (
          <div className={`absolute inset-x-0 z-10 overflow-hidden rounded-lg border border-border bg-surface shadow-lg ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
            {suggestions.map((s) => (
              <button
                key={`${s.city}-${s.iana}`}
                type="button"
                className="flex w-full cursor-pointer items-center px-2.5 py-2 text-left transition-colors hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(s)
                }}
              >
                <span className="font-serif text-[0.95rem] text-accent">{s.city}</span>
                <span className="ml-1.5 text-[0.7rem] text-muted-foreground">{s.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsPanel({ iana, detected, dropUp, onNavigate }: { iana: string; detected: string; dropUp: boolean; onNavigate: () => void }) {
  const { theme, timeFormat, setTheme, setTimeFormat } = usePreferences()
  const now = useMinuteTick()

  // Your own clock, in both notations — the choice shows you its result.
  const sample = DateTime.fromJSDate(now).setZone(iana)

  return (
    <div className="flex flex-col gap-3">
      <CityField detected={detected} dropUp={dropUp} />
      <Choice<TimeFormat>
        label="Clock"
        options={[
          { label: 'Auto', value: 'system', title: 'Match my system' },
          { label: sample.toFormat('h:mm a'), value: '12h', title: '12-hour clock' },
          { label: sample.toFormat('HH:mm'), value: '24h', title: '24-hour clock' },
        ]}
        value={timeFormat}
        onChange={setTimeFormat}
      />
      <Choice<ThemePreference>
        label="Theme"
        options={[
          { label: 'Auto', value: 'system', title: 'Match my system' },
          { label: <SunIcon />, value: 'light', title: 'Light' },
          { label: <MoonIcon />, value: 'dark', title: 'Dark' },
        ]}
        value={theme}
        onChange={setTheme}
      />
      <div className="border-t border-border" />
      <a
        href="/about"
        onClick={(e) => {
          e.preventDefault()
          onNavigate()
          navigate('/about')
        }}
        className="text-[0.8rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        About
      </a>
    </div>
  )
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.86 1.45a1.2 1.2 0 0 1 2.28 0l.2.6a1.2 1.2 0 0 0 1.55.7l.58-.23a1.2 1.2 0 0 1 1.61 1.14l-.02.62a1.2 1.2 0 0 0 1.02 1.22l.61.1a1.2 1.2 0 0 1 .8 2.03l-.44.44a1.2 1.2 0 0 0-.15 1.58l.35.52a1.2 1.2 0 0 1-.57 1.84l-.58.2a1.2 1.2 0 0 0-.78 1.38l.12.61a1.2 1.2 0 0 1-1.72 1.22l-.52-.33a1.2 1.2 0 0 0-1.53.24l-.38.49a1.2 1.2 0 0 1-2.14-.43l-.13-.61a1.2 1.2 0 0 0-1.28-.95l-.62.05a1.2 1.2 0 0 1-1.18-1.58l.22-.58a1.2 1.2 0 0 0-.65-1.52l-.56-.26a1.2 1.2 0 0 1-.24-2.1l.5-.37a1.2 1.2 0 0 0 .43-1.5l-.28-.56a1.2 1.2 0 0 1 1.1-1.72h.62a1.2 1.2 0 0 0 1.17-.88l.14-.61Z" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  )
}

/** "Europe/Zurich" is a database key; "Zürich" is where you are. */
function cityFromZone(iana: string) {
  return iana.split('/').pop()?.replace(/_/g, ' ') ?? iana
}

function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

interface SettingsMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Mobile drops the clock — the phone's own status bar already shows the local
   * time — and moves to the bottom row, where the thumb is. It gets its border
   * back too: touch has no hover, so a target has to look like one.
   */
  asButton?: boolean
}

/**
 * Where you are, and the way into everything app-level.
 *
 * Deliberately quiet: it is *configuration*, and every view already carries the
 * clocks that answer the question. Rendered as a status line rather than a
 * control, it stays available without pulling the eye away from the result. It
 * is still one target — a display is never itself a switch.
 */
export function SettingsMenu({ open, onOpenChange, asButton = false }: SettingsMenuProps) {
  const { homeCity, use24h } = usePreferences()
  const iana = homeCity?.iana ?? localZone()
  const place = homeCity?.city ?? cityFromZone(iana)
  const time = useLiveClock(iana, use24h)
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  const trigger = asButton ? (
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      aria-label="Settings"
      aria-expanded={open}
      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border bg-surface/80 shadow-lg backdrop-blur-md transition-colors ${
        open ? 'border-accent/40 text-accent' : 'border-border text-muted-foreground'
      }`}
    >
      <GearIcon />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onOpenChange(!open)}
      aria-label={`${time} in ${place} — open settings`}
      aria-expanded={open}
      className={`flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2 transition-colors ${
        open ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <span className="font-mono text-[0.85rem] leading-none">{time}</span>
      {/* The place name is the first thing to go when the corner runs out of
          room — the time is the part every answer is relative to. */}
      <span className="hidden max-w-[7rem] truncate text-[0.85rem] leading-none lg:inline">
        {place}
      </span>
    </button>
  )

  return (
    <Popover open={open} onClose={close} anchor={asButton ? 'bottom-right' : 'top-right'} trigger={trigger}>
      <SettingsPanel iana={iana} detected={place} dropUp={asButton} onNavigate={close} />
    </Popover>
  )
}

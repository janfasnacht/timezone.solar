import { useState, useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import type { PlaceholderSegment } from '@/hooks/useRotatingPlaceholder'
import { RecentSearches } from '@/components/RecentSearches'

interface QueryInputProps {
  ref?: React.Ref<HTMLInputElement>
  onSubmit: (query: string) => void
  onClear: () => void
  onFocusChange?: (focused: boolean) => void
  onValueChange?: (value: string) => void
  onRemoveQuery?: (query: string) => void
  initialValue?: string
  placeholder?: PlaceholderSegment[]
  recentQueries?: string[]
}

export function QueryInput({
  ref,
  onSubmit,
  onClear,
  onFocusChange,
  onValueChange,
  onRemoveQuery,
  initialValue,
  placeholder,
  recentQueries = [],
}: QueryInputProps) {
  const [value, setValue] = useState(initialValue ?? '')
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const savedInput = useRef('')
  const fallbackRef = useRef<HTMLInputElement>(null)
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const inputNode = (ref && typeof ref === 'object' && 'current' in ref)
    ? ref as React.RefObject<HTMLInputElement | null>
    : fallbackRef

  useEffect(() => {
    inputNode.current?.focus()
  }, [inputNode])

  const [prevInitialValue, setPrevInitialValue] = useState(initialValue)
  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue)
    if (initialValue !== undefined) {
      setValue(initialValue)
      setHistoryIndex(null)
    }
  }

  function handleFocus() {
    onFocusChange?.(true)
    if (!value && recentQueries.length > 0) {
      setDropdownOpen(true)
    }
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => {
      onFocusChange?.(false)
      setDropdownOpen(false)
    }, 150)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setValue(newValue)
    onValueChange?.(newValue)
    setHistoryIndex(null)
    if (newValue) {
      setDropdownOpen(false)
    } else if (recentQueries.length > 0) {
      setDropdownOpen(true)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim())
      setHistoryIndex(null)
      setDropdownOpen(false)
      return
    }
    if (e.key === 'Escape') {
      setValue('')
      onValueChange?.('')
      setHistoryIndex(null)
      setDropdownOpen(false)
      onClear()
      return
    }

    if (e.key === 'ArrowUp' && recentQueries.length > 0) {
      e.preventDefault()
      if (historyIndex === null) {
        savedInput.current = value
        setHistoryIndex(0)
        setValue(recentQueries[0])
        onValueChange?.(recentQueries[0])
      } else if (historyIndex < recentQueries.length - 1) {
        const next = historyIndex + 1
        setHistoryIndex(next)
        setValue(recentQueries[next])
        onValueChange?.(recentQueries[next])
      }
      return
    }

    if (e.key === 'ArrowDown' && historyIndex !== null) {
      e.preventDefault()
      if (historyIndex > 0) {
        const next = historyIndex - 1
        setHistoryIndex(next)
        setValue(recentQueries[next])
        onValueChange?.(recentQueries[next])
      } else {
        setHistoryIndex(null)
        setValue(savedInput.current)
        onValueChange?.(savedInput.current)
      }
      return
    }
  }

  function handleSelectRecent(query: string) {
    clearTimeout(blurTimeout.current)
    setValue(query)
    onValueChange?.(query)
    setDropdownOpen(false)
    onSubmit(query)
    inputNode.current?.focus()
  }

  function handleRemoveRecent(query: string) {
    clearTimeout(blurTimeout.current)
    onRemoveQuery?.(query)
    inputNode.current?.focus()
  }

  function handleSubmitClick() {
    if (value.trim()) {
      onSubmit(value.trim())
      setHistoryIndex(null)
      setDropdownOpen(false)
    }
  }

  const showPlaceholder = !value && placeholder
  const showSubmitButton = !!value.trim()

  return (
    <div className="relative">
      <input
        ref={ref ?? fallbackRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full rounded-full border border-border bg-background px-5 py-3 pr-12 text-lg text-foreground transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {showPlaceholder && (
        <span
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-lg transition-opacity duration-300"
          aria-hidden="true"
        >
          {placeholder.map((seg, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <span className={
                seg.type === 'primary'
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground/50 font-light'
              }>{seg.text}</span>
            </span>
          ))}
        </span>
      )}
      {showSubmitButton && (
        <button
          type="button"
          onClick={handleSubmitClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-accent p-1.5 text-accent-foreground transition-opacity hover:opacity-80"
          aria-label="Convert"
        >
          <ArrowRight size={18} />
        </button>
      )}
      {dropdownOpen && (
        <RecentSearches
          queries={recentQueries}
          onSelect={handleSelectRecent}
          onRemove={handleRemoveRecent}
        />
      )}
    </div>
  )
}

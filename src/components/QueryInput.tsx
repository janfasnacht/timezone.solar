import { useState, useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { RecentSearches } from '@/components/RecentSearches'

interface QueryInputProps {
  ref?: React.Ref<HTMLInputElement>
  onSubmit: (query: string) => void
  onClear: () => void
  onFocusChange?: (focused: boolean) => void
  onValueChange?: (value: string) => void
  onRemoveQuery?: (query: string) => void
  initialValue?: string
  placeholder?: string
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
  const [isFocused, setIsFocused] = useState(false)
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
    setIsFocused(true)
    onFocusChange?.(true)
    if (!value && recentQueries.length > 0) {
      setDropdownOpen(true)
    }
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => {
      setIsFocused(false)
      onFocusChange?.(false)
      setDropdownOpen(false)
      setHistoryIndex(null)
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
      setDropdownOpen(true)
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
        if (!savedInput.current && recentQueries.length > 0) {
          setDropdownOpen(true)
        } else {
          setDropdownOpen(false)
        }
      }
      return
    }
  }

  function handleSelectRecent(query: string) {
    clearTimeout(blurTimeout.current)
    setValue(query)
    onValueChange?.(query)
    setDropdownOpen(false)
    setHistoryIndex(null)
    onSubmit(query)
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

  const showPlaceholder = !value && !isFocused && placeholder

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
        className="w-full rounded-full border border-border bg-surface px-6 py-3.5 pr-12 text-[1.05rem] text-foreground transition-colors focus:border-accent focus:outline-none"
        onFocusCapture={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 4px var(--color-glow-strong)'
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.boxShadow = ''
        }}
      />
      {showPlaceholder && (
        <span
          className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-[1.05rem] text-muted-foreground transition-opacity duration-300"
          aria-hidden="true"
        >
          {placeholder}
        </span>
      )}
      <button
        type="button"
        onClick={handleSubmitClick}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-all ${
          value.trim()
            ? 'bg-accent text-accent-foreground hover:opacity-80'
            : 'text-muted-foreground/20'
        }`}
        aria-label="Convert"
      >
        <ArrowRight size={18} />
      </button>
      {dropdownOpen && recentQueries.length > 0 && (
        <RecentSearches
          queries={recentQueries}
          onSelect={handleSelectRecent}
          onRemove={handleRemoveRecent}
          activeIndex={historyIndex}
        />
      )}
    </div>
  )
}

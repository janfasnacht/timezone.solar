import { useState, useRef } from 'react'
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
    setDropdownOpen(false)
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
        setDropdownOpen(false)
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
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground ${
          isFocused && value.trim() ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-label="Convert"
        tabIndex={-1}
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

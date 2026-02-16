import { useEffect, type RefObject } from 'react'

export function useKeyboardShortcuts(
  inputRef: RefObject<HTMLInputElement | null>,
  showSettings: boolean,
  setShowSettings: (v: boolean) => void,
  showExamples: () => void,
  onClear: () => void,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K → focus + select input
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        setShowSettings(false)
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      // Cmd+/ → switch to convert, clear, focus input
      if (e.metaKey && e.key === '/') {
        e.preventDefault()
        showExamples()
      }

      // Escape on settings → flip back to convert
      if (e.key === 'Escape' && showSettings) {
        e.preventDefault()
        setShowSettings(false)
        inputRef.current?.focus()
        return
      }

      // Global Escape → clear results and focus input
      if (e.key === 'Escape' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        onClear()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [inputRef, showSettings, setShowSettings, showExamples, onClear])
}

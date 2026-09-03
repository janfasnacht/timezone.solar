import { useEffect, type RefObject } from 'react'
import { isKeyClaimed } from '@/lib/keyClaim'

export function useKeyboardShortcuts(
  inputRef: RefObject<HTMLInputElement | null>,
  setShowSettings: (v: boolean) => void,
  showExamples: () => void,
  onClear: () => void,
  onToggleView?: () => void,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // An open popover answers Escape by closing; that is all it does.
      if (isKeyClaimed(e)) return

      // Cmd+K → focus + select input
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        setShowSettings(false)
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      // Cmd+M → toggle card/map view
      if (e.metaKey && e.key === 'm') {
        e.preventDefault()
        onToggleView?.()
      }

      // Cmd+/ → switch to convert, clear, focus input
      if (e.metaKey && e.key === '/') {
        e.preventDefault()
        showExamples()
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
  }, [inputRef, setShowSettings, showExamples, onClear, onToggleView])
}

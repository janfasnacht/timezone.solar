import { useEffect, type RefObject } from 'react'

export function useKeyboardShortcuts(
  inputRef: RefObject<HTMLInputElement | null>,
  toggleHelp: () => void,
  onClear: () => void,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K → focus + select input
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      // Cmd+/ → toggle help modal
      if (e.metaKey && e.key === '/') {
        e.preventDefault()
        toggleHelp()
      }

      // Global Escape → clear results and focus input
      if (e.key === 'Escape' && document.activeElement !== inputRef.current) {
        // Skip if a modal is open (modals handle their own Escape)
        if (document.querySelector('[role="dialog"]')) return
        e.preventDefault()
        onClear()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [inputRef, toggleHelp, onClear])
}

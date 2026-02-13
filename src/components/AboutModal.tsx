import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={panelRef}
      className="fixed bottom-12 left-1/2 z-50 w-80 -translate-x-1/2 rounded-lg border border-border bg-background p-4 shadow-lg"
      role="dialog"
      aria-label="About"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">About</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">timezone</span>
          <span className="font-semibold text-accent">.solar</span>
          {' '}converts times between cities with natural language.
        </p>
        <p>
          Supports 40,000+ cities, fuzzy matching, DST awareness, and shareable URLs.
        </p>
        <p>
          City icons by{' '}
          <a
            href="https://svgcities.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Studio Partdirector
          </a>
          .
        </p>
      </div>
    </div>
  )
}

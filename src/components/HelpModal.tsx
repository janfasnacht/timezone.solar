import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
      {children}
    </code>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
      {children}
    </kbd>
  )
}

export function HelpModal({ open, onClose }: HelpModalProps) {
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
      className="fixed bottom-12 left-1/2 z-50 max-h-[70vh] w-96 -translate-x-1/2 overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-lg"
      role="dialog"
      aria-label="Help"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium">Quick reference</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close help"
        >
          <X size={14} />
        </button>
      </div>

      {/* Examples */}
      <section className="mb-4">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Examples</h3>
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Between two cities</p>
            <div className="flex flex-wrap gap-1.5">
              <Example>Boston 6pm in LA</Example>
              <Example>noon Tokyo to London</Example>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">From your timezone</p>
            <div className="flex flex-wrap gap-1.5">
              <Example>6pm in Tokyo</Example>
              <Example>9am London</Example>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Current time somewhere</p>
            <div className="flex flex-wrap gap-1.5">
              <Example>Tokyo</Example>
              <Example>EST</Example>
              <Example>Berlin</Example>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">With date or relative time</p>
            <div className="flex flex-wrap gap-1.5">
              <Example>tomorrow 3pm London in EST</Example>
              <Example>in 2 hours in Berlin</Example>
            </div>
          </div>
        </div>
      </section>

      <hr className="mb-3 border-border" />

      {/* Shortcuts */}
      <section>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Shortcuts</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
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
            <span className="text-muted-foreground">Help</span>
            <Kbd>&#8984;/</Kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">History</span>
            <Kbd>&uarr; &darr;</Kbd>
          </div>
        </div>
      </section>
    </div>
  )
}

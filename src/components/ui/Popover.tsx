import { useRef, useEffect } from 'react'
import { claimKey } from '@/lib/keyClaim'

type Anchor = 'top-right' | 'bottom-left' | 'bottom-right'

interface PopoverProps {
  open: boolean
  onClose: () => void
  /** Which corner of the trigger the panel hangs from. */
  anchor?: Anchor
  /** The trigger. Rendered inside the same positioning context as the panel. */
  trigger: React.ReactNode
  children: React.ReactNode
}

const ANCHOR_CLASS: Record<Anchor, string> = {
  'top-right': 'top-[calc(100%+0.5rem)] right-0',
  'bottom-left': 'bottom-[calc(100%+0.5rem)] left-0',
  'bottom-right': 'bottom-[calc(100%+0.5rem)] right-0',
}

/**
 * The one popover: every panel that opens on click is this surface, at this
 * width, on both breakpoints — anchored differently rather than restyled.
 *
 * Opens on click, closes on outside-click and Escape. Anything that names a
 * control rather than acting on it is a Tooltip.
 */
export function Popover({ open, onClose, anchor = 'top-right', trigger, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // Capture, so the panel gets Escape before any global handler, and claims
    // it — closing a popover is the whole of what that key press does.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      claimKey(e)
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose])

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          className={`absolute z-50 w-[260px] rounded-xl border border-border bg-surface p-3 shadow-lg ${ANCHOR_CLASS[anchor]}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

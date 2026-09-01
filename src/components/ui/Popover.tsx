import { useRef, useEffect } from 'react'

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
 * The one popover. Every panel that opens on click is this surface, at this
 * width — no sheets, no second width, no third radius. Mobile gets the same
 * panel, anchored differently rather than restyled.
 *
 * Opens on click, closes on outside-click and Escape. That is the whole
 * contract; anything that wants to teach rather than act is a Tooltip.
 */
export function Popover({ open, onClose, anchor = 'top-right', trigger, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          className={`absolute z-50 w-[260px] rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur-sm ${ANCHOR_CLASS[anchor]}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

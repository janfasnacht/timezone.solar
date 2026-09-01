import { useState, useRef, useEffect, useId, useSyncExternalStore } from 'react'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  /** What the control is. Never an action — a tooltip cannot be clicked. */
  label: string
  /** Optional shortcut, rendered as a kbd chip beside the label. */
  keys?: string
  side?: Side
  children: React.ReactNode
  className?: string
}

const SIDE_CLASS: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

/** Hover has to be deliberate; keyboard focus is already deliberate. */
const HOVER_DELAY_MS = 400

const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

/**
 * A tooltip is a pointer affordance. Touch has no hover, so a tap both opens and
 * focuses the trigger, leaving the tip stuck until something else takes focus.
 * Rather than paper over that, don't render one where there is no pointer —
 * every control it names is either labelled or has an aria-label.
 */
function useHoverCapable() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(HOVER_QUERY)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(HOVER_QUERY).matches,
    () => true,
  )
}

/**
 * The only floating surface besides the popover, and lighter in weight because
 * it is decorative rather than interactive: it names a control and may teach its
 * shortcut. Never contains an action — anything clickable belongs in a popover.
 */
export function Tooltip({ label, keys, side = 'top', children, className }: TooltipProps) {
  const hoverCapable = useHoverCapable()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const id = useId()

  useEffect(() => () => clearTimeout(timer.current), [])

  const show = (immediate: boolean) => {
    clearTimeout(timer.current)
    if (immediate) setOpen(true)
    else timer.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!hoverCapable) return <>{children}</>

  return (
    <div
      className={`relative${className ? ` ${className}` : ''}`}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onFocusCapture={() => show(true)}
      onBlurCapture={hide}
    >
      <div aria-describedby={open ? id : undefined}>{children}</div>
      {open && (
        <div
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute z-50 flex w-max items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface/95 px-2 py-1 text-[0.7rem] text-muted-foreground shadow-sm backdrop-blur-sm ${SIDE_CLASS[side]}`}
        >
          {label}
          {keys && (
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[0.7rem] text-muted-foreground">
              {keys}
            </kbd>
          )}
        </div>
      )}
    </div>
  )
}

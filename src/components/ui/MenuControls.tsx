/**
 * The shared vocabulary of the popover menus. Settings and map layers are the
 * same surface, so a label, a choice and a toggle look and measure the same in
 * both — new controls compose from here rather than restyling.
 */

/** One row shape for every control: what it is on the left, what it does on the right. */
const ROW = 'flex h-8 items-center justify-between gap-2'
const LABEL = 'truncate text-[0.8rem] text-muted-foreground'

/** Groups within a panel are named quietly; the divider does the separating. */
export const MENU_SECTION = 'mt-1 text-[0.7rem] text-muted-foreground/60'

export function MenuDivider() {
  return <div className="my-1.5 border-t border-border" />
}

interface SegmentedProps<T extends string> {
  label: string
  options: { label: React.ReactNode; value: T; title?: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}

/** You pick by seeing the result — the clock, the theme, the density — not by reading a word for it. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedProps<T>) {
  return (
    <div className={`${ROW} ${disabled ? 'opacity-40' : ''}`}>
      <span className={LABEL}>{label}</span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex h-7 shrink-0 items-center rounded-lg border border-border p-0.5"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-label={opt.title}
            aria-pressed={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex h-6 cursor-pointer items-center justify-center rounded-md px-2 text-[0.8rem] transition-colors disabled:cursor-default ${
              value === opt.value
                ? 'bg-accent-soft text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** On or off, where there is no third state worth showing as a segment. */
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={`${ROW} cursor-pointer`}>
      <span className={LABEL}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(!checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-100 peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${
          checked ? 'border-accent-border bg-accent-soft' : 'border-border bg-transparent'
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full transition-transform duration-100 ${
            checked ? 'translate-x-4 bg-accent' : 'translate-x-0 bg-muted-foreground'
          }`}
        />
      </span>
    </label>
  )
}

/**
 * A row that acts when pressed rather than holding a setting. `hint` is the one
 * detail worth knowing first — a file extension, a copied confirmation. Renders
 * as a link when `href` is given, so it stays middle-clickable.
 */
export function MenuAction({
  icon,
  label,
  hint,
  title,
  onClick,
  href,
  disabled = false,
}: {
  icon: React.ReactNode
  label: React.ReactNode
  hint?: string
  title?: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}) {
  const inner = (
    <>
      <span className="flex w-4 shrink-0 justify-center text-muted-foreground transition-colors group-hover:text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.8rem] text-foreground">{label}</span>
      {hint && (
        <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">{hint}</span>
      )}
    </>
  )

  const className =
    'group flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-md py-1 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-40'

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={className}>
      {inner}
    </button>
  )
}

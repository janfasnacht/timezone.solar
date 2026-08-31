interface SunDialLogoProps {
  onClick: () => void
  /** Row mode: just the mark, wordmark cross-faded out. */
  compact?: boolean
}

export function SunDialLogo({ onClick, compact = false }: SunDialLogoProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center"
      aria-label="Back to start — timezone.solar"
      title="Back to start"
    >
      <div
        className={`rounded-full bg-accent shadow-[0_0_30px_var(--color-glow-strong),0_0_60px_var(--color-glow)] transition-all duration-300 group-hover:bg-accent-text group-hover:shadow-[0_0_45px_var(--color-glow-strong),0_0_90px_var(--color-glow)] ${
          compact ? 'h-6 w-6' : 'mb-2 h-9 w-9 md:mb-4'
        }`}
      />
      <div
        className={`overflow-hidden font-serif font-light italic text-muted-foreground transition-all duration-300 ${
          compact ? 'h-0 text-[0] opacity-0' : 'h-auto text-[1.1rem] opacity-100'
        }`}
      >
        <span className="not-italic font-semibold text-foreground">timezone</span>.solar
      </div>
    </button>
  )
}

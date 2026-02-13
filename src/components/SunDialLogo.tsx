interface SunDialLogoProps {
  onClick: () => void
}

export function SunDialLogo({ onClick }: SunDialLogoProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center"
      aria-label="Reset — timezone.solar"
    >
      <div
        className="mb-4 h-9 w-9 rounded-full bg-accent shadow-[0_0_30px_var(--color-glow-strong),0_0_60px_var(--color-glow)] transition-shadow duration-300 group-hover:shadow-[0_0_45px_var(--color-glow-strong),0_0_90px_var(--color-glow)]"
      />
      <div className="font-serif text-[1.1rem] font-light italic text-muted-foreground">
        <span className="not-italic font-semibold text-foreground">timezone</span>.solar
      </div>
    </button>
  )
}

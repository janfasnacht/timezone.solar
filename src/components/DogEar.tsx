interface DogEarProps {
  onClick: () => void
  label: string
  tooltip: string
}

export function DogEar({ onClick, label, tooltip }: DogEarProps) {
  return (
    <div className="group/ear absolute right-0 bottom-0 h-8 w-8">
      {/* CSS tooltip */}
      <span className="pointer-events-none absolute right-9 bottom-1 z-10 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 font-mono text-[0.65rem] text-muted-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover/ear:opacity-100">
        {tooltip}
      </span>

      {/* Fold triangle */}
      <button
        onClick={onClick}
        className="absolute inset-0 cursor-pointer [clip-path:polygon(100%_0,100%_100%,0_100%)] transition-colors duration-150 bg-border/50"
        aria-label={label}
      />
    </div>
  )
}

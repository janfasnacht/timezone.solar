import type { ConversionError } from '@/engine/types'

interface ErrorDisplayProps {
  error: ConversionError
  onOpenHelp: () => void
}

export function ErrorDisplay({ error, onOpenHelp }: ErrorDisplayProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-surface via-accent-soft to-surface" />

      <div className="p-[2rem]">
        <p className="font-serif text-[1.1rem] italic text-muted-foreground">
          {error.message}
        </p>
        {error.suggestion && (
          <p className="mt-3 text-[0.8rem] text-muted-foreground/70">
            {error.suggestion}
          </p>
        )}
        <button
          onClick={onOpenHelp}
          className="mt-4 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          View supported formats
        </button>
      </div>
    </div>
  )
}

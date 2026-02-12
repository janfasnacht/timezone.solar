import type { ConversionError } from '@/engine/types'

interface ErrorDisplayProps {
  error: ConversionError
  onOpenHelp: () => void
}

export function ErrorDisplay({ error, onOpenHelp }: ErrorDisplayProps) {
  return (
    <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="font-medium text-destructive">{error.message}</p>
      {error.suggestion && (
        <p className="mt-1 text-sm text-muted-foreground">{error.suggestion}</p>
      )}
      <button
        onClick={onOpenHelp}
        className="mt-2 text-sm text-accent underline underline-offset-2 transition-colors hover:text-accent/80"
      >
        View supported formats
      </button>
    </div>
  )
}

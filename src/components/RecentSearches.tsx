import { Clock, X } from 'lucide-react'

interface RecentSearchesProps {
  queries: string[]
  onSelect: (query: string) => void
  onRemove: (query: string) => void
}

export function RecentSearches({ queries, onSelect, onRemove }: RecentSearchesProps) {
  if (queries.length === 0) return null

  return (
    <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
      {queries.slice(0, 10).map((query) => (
        <div
          key={query}
          className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted"
        >
          <Clock size={13} className="flex-shrink-0 text-muted-foreground/40" />
          <button
            type="button"
            className="flex-1 text-left text-sm text-foreground"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(query)
            }}
          >
            {query}
          </button>
          <button
            type="button"
            className="flex-shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onMouseDown={(e) => {
              e.preventDefault()
              onRemove(query)
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

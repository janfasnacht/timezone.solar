interface HelpExamplesProps {
  onRunQuery: (query: string) => void
}

const categories: { hint: string; examples: string[] }[] = [
  { hint: 'between two cities', examples: ['Boston 6pm in LA', 'noon Tokyo to London'] },
  { hint: 'from your timezone', examples: ['6pm in Tokyo', '9am London'] },
  { hint: 'current time somewhere', examples: ['Tokyo', 'EST', 'Berlin'] },
  { hint: 'by airport code', examples: ['JFK to LHR', '3pm NRT in SFO', 'HND'] },
  { hint: 'with date or relative time', examples: ['tomorrow 3pm London in EST', 'in 2 hours in Berlin'] },
]

export function HelpExamples({ onRunQuery }: HelpExamplesProps) {
  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.hint}>
          <p className="mb-1.5 font-serif text-[0.75rem] italic text-muted-foreground/70">
            {cat.hint}
          </p>
          <div className="flex flex-wrap gap-2">
            {cat.examples.map((ex) => (
              <button
                key={ex}
                onClick={() => onRunQuery(ex)}
                className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[0.75rem] text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

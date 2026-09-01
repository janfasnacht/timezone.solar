import { SunDialLogo } from '@/components/SunDialLogo'
import { navigate } from '@/lib/navigate'

interface AboutPageProps {
  onRunQuery: (query: string) => void
}

const PATTERNS: { hint: string; examples: string[] }[] = [
  { hint: 'a city, on its own', examples: ['Tokyo', 'JFK', 'EST'] },
  { hint: 'a time, somewhere else', examples: ['6pm in Tokyo', '9am London'] },
  { hint: 'between two places', examples: ['noon Tokyo to London', 'Boston 6pm in LA'] },
  { hint: 'a date, or a while off', examples: ['14 march 3pm Berlin', 'in 2 hours'] },
]

/**
 * One screen, like every other view in this app.
 *
 * Shortcuts are deliberately *not* listed. The current set needs redesigning
 * (backlog #12) and three of them are macOS-only, so documenting it would be
 * documenting a defect.
 */
export function AboutPage({ onRunQuery }: AboutPageProps) {
  const runQuery = (query: string) => {
    navigate(`/?q=${encodeURIComponent(query)}`)
    onRunQuery(query)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-[620px] flex-col px-4 py-[6vh] md:px-8">
      <div className="mb-6 self-center md:mb-8">
        <SunDialLogo onClick={() => navigate('/')} />
      </div>

      <p className="text-[0.85rem] leading-relaxed text-foreground/70">
        <span className="font-semibold text-foreground">timezone</span>
        <span className="font-semibold text-accent">.solar</span> converts times
        between places from natural language.
      </p>

      <div className="mt-7 space-y-2.5">
        {PATTERNS.map(({ hint, examples }) => (
          <div key={hint} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="w-full font-serif text-[0.75rem] italic text-muted-foreground/70 sm:w-[10rem] sm:shrink-0">
              {hint}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => runQuery(ex)}
                  className="cursor-pointer rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[0.75rem] text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 border-t border-border pt-5 text-[0.7rem] text-muted-foreground/50">
        City icons by{' '}
        <a href="https://svgcities.com/" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent">
          Studio Partdirector
        </a>
        <span className="px-1.5 text-muted-foreground/40">·</span>
        <a href="https://github.com/janfasnacht/timezone.solar" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent">
          Open source on GitHub
        </a>
      </p>
    </div>
  )
}

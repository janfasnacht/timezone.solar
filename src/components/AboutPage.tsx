import { SunDialLogo } from '@/components/SunDialLogo'
import { navigate } from '@/lib/navigate'

interface AboutPageProps {
  onRunQuery: (query: string) => void
}

/** Ordered simplest to hardest, so the range shows without being labelled. */
const EXAMPLES = [
  'Tokyo',
  'JFK',
  '6pm in Tokyo',
  'noon Tokyo to London',
  '14 march 3pm Berlin',
  'in 2 hours',
]

/**
 * One screen, on the landing screen's own grid — same top offset, same 520px
 * column, same centred logo, so nothing moves when you arrive here from there.
 *
 * Shortcuts are deliberately not listed. The current set needs redesigning
 * (backlog #12) and three of them are macOS-only, so documenting it would be
 * documenting a defect.
 */
export function AboutPage({ onRunQuery }: AboutPageProps) {
  const runQuery = (query: string) => {
    navigate(`/?q=${encodeURIComponent(query)}`)
    onRunQuery(query)
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center px-4 pt-[5vh] pb-10 text-center md:px-8 md:pt-[22vh]">
      <SunDialLogo onClick={() => navigate('/')} />

      <p className="mt-5 text-[0.85rem] leading-relaxed text-muted-foreground">
        timezone.solar converts times between places from natural language.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => runQuery(ex)}
            className="cursor-pointer rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[0.75rem] text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>

      <p className="mt-10 text-[0.7rem] leading-relaxed text-muted-foreground/60">
        City icons by{' '}
        <a href="https://svgcities.com/" target="_blank" rel="noopener noreferrer" className="text-accent/70 hover:text-accent">
          Studio Partdirector
        </a>
        . The source is on{' '}
        <a href="https://github.com/janfasnacht/timezone.solar" target="_blank" rel="noopener noreferrer" className="text-accent/70 hover:text-accent">
          GitHub
        </a>
        .
      </p>
    </div>
  )
}

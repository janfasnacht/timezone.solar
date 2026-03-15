import { HelpExamples } from '@/components/HelpExamples'
import { SunDialLogo } from '@/components/SunDialLogo'

interface AboutPageProps {
  onRunQuery: (query: string) => void
}

export function AboutPage({ onRunQuery }: AboutPageProps) {
  const handleNavigateHome = () => {
    history.pushState(null, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleRunQuery = (query: string) => {
    history.pushState(null, '', `/?q=${encodeURIComponent(query)}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    onRunQuery(query)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center px-4 md:px-[2rem]">
      <div className="h-[4vh] md:h-[12vh] flex-shrink-0" />

      {/* Logo */}
      <div className="mb-4 md:mb-8 flex-shrink-0">
        <SunDialLogo onClick={handleNavigateHome} />
      </div>

      {/* About */}
      <div className="w-full space-y-6">
        <div>
          <p className="text-[0.85rem] text-foreground/80">
            <span className="font-semibold text-foreground">timezone</span>
            <span className="font-semibold text-accent">.solar</span>
            {' '}&mdash; natural language time conversion.
          </p>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-foreground/60">
            Type a city, a time, or both &mdash; and get an instant conversion.
            No dropdowns, no picker widgets, just plain language.
          </p>
        </div>

        {/* Examples */}
        <div>
          <p className="mb-3 text-[0.75rem] font-medium text-foreground/40">Try these</p>
          <HelpExamples onRunQuery={handleRunQuery} />
        </div>

        {/* Attribution */}
        <div className="border-t border-border pt-4 pb-8 space-y-1">
          <p className="text-[0.7rem] text-foreground/30">
            City icons by{' '}
            <a
              href="https://svgcities.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent/50 hover:text-accent hover:underline"
            >
              Studio Partdirector
            </a>
          </p>
          <p className="text-[0.7rem] text-foreground/30">
            Open source on{' '}
            <a
              href="https://github.com/janfasnacht/timezone.solar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent/50 hover:text-accent hover:underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

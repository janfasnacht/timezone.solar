import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { DateTime } from 'luxon'
import { LazyMotion, m, useReducedMotion } from 'motion/react'
import { QueryInput } from '@/components/QueryInput'
import { ResultCard } from '@/components/ResultCard'
import { ShareView } from '@/components/ShareView'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { CityVibe } from '@/components/CityVibe'
import { SettingsMenu } from '@/components/SettingsMenu'
import { AboutPage } from '@/components/AboutPage'
import { SunDialLogo } from '@/components/SunDialLogo'
import { ViewToggle } from '@/components/ViewToggle'
import { TimeControl } from '@/components/TimeControl'
import { useConversion } from '@/hooks/useConversion'
import { useRecentQueries } from '@/hooks/useRecentQueries'
import { useUrlState } from '@/hooks/useUrlState'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRotatingPlaceholder } from '@/hooks/useRotatingPlaceholder'
import { usePreferences } from '@/hooks/usePreferences'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { createDebouncedCallback } from '@/lib/debounce'
import { buildCanonicalParams } from '@/lib/canonicalUrl'
import { whenPhrase } from '@/lib/whenPhrase'

const MapView = lazy(() => import('@/components/MapView'))

function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return path
}

const loadMotionFeatures = () => import('@/lib/motionFeatures').then(mod => mod.default)

const layerVisible = { opacity: 1, scale: 1, visibility: 'visible' } as const
const layerHidden = { opacity: 0, scale: 0.98, transitionEnd: { visibility: 'hidden' } } as const

function App() {
  const path = usePath()
  const { result, error, isUsingCurrentTime, matchType, runConversion, runCanonicalConversion, swapConversion, clear } = useConversion()
  const { queries: recentQueries, addQuery, removeQuery } = useRecentQueries()
  const { query: urlQuery, canonicalQuery, setQuery: setUrlQuery, replaceQuery: replaceUrlQuery, replaceWithCanonical, view, setView } = useUrlState()
  const { use24h, homeCity } = usePreferences()
  const [inputValue, setInputValue] = useState<string | undefined>(undefined)
  const [currentInputValue, setCurrentInputValue] = useState('')
  const [isDebouncing, setIsDebouncing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const liveQueryRef = useRef('')
  const shouldCanonicalizeRef = useRef(false)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [vibeHovered, setVibeHovered] = useState(false)
  const reduceMotion = useReducedMotion()
  // The map chunk is lazy; once it has been shown we keep it mounted so pan/zoom,
  // layer toggles and the time nudge survive a trip through the card view.
  const [mapMounted, setMapMounted] = useState(view === 'map')
  useEffect(() => { if (view === 'map') setMapMounted(true) }, [view])
  useDocumentTitle(result, currentInputValue)

  const debouncedRef = useRef(createDebouncedCallback(() => {
    const q = liveQueryRef.current
    if (q.length >= 2) runConversion(q)
    setIsDebouncing(false)
  }, 350))
  useEffect(() => () => debouncedRef.current.cancel(), [])

  const handleClear = useCallback(() => {
    debouncedRef.current.cancel()
    setIsDebouncing(false)
    clear()
    setInputValue('')
    setCurrentInputValue('')
    replaceUrlQuery('')
  }, [clear, replaceUrlQuery])

  const showExamples = useCallback(() => {
    setSettingsOpen(false)
    handleClear()
    inputRef.current?.focus()
  }, [handleClear])

  const toggleView = useCallback(() => {
    setView(view === 'card' ? 'map' : 'card')
  }, [view, setView])

  useKeyboardShortcuts(inputRef, setSettingsOpen, showExamples, handleClear, toggleView)

  const hasResult = Boolean(result)
  // Landing is a screen in its own right, not the card view rendered empty. It
  // holds while there is nothing to show and the map has not been opened.
  const isLandingScreen = !result && !error && view !== 'map'
  // Examples cycle only while the landing screen is idle — not once you are
  // typing, and never in a view where a suggestion would be noise.
  const { placeholder, feelingWord, getCurrentExample, advance: advanceExample } =
    useRotatingPlaceholder(isLandingScreen && !inputFocused && !currentInputValue)
  // The header lifts once there is something to show — never merely because you
  // typed. Map counts as content in its own right: WorldMap uses
  // preserveAspectRatio="slice", so a short container crops the world rather than
  // shrinking it. Whenever a result exists both views are active, so toggling
  // never moves the input.
  const isActive = Boolean(result || error || view === 'map')

  useEffect(() => {
    if (urlQuery) {
      setInputValue(urlQuery)
      setCurrentInputValue(urlQuery)
      shouldCanonicalizeRef.current = true
      runConversion(urlQuery)
      addQuery(urlQuery)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery])

  // Load from canonical URL params (?from=&to=&t=)
  useEffect(() => {
    if (canonicalQuery) {
      const { fromIana, toIana, hour, minute, dateModifier } = canonicalQuery
      const outcome = runCanonicalConversion(fromIana, toIana, hour, minute, dateModifier)
      if (!outcome.error_type) {
        const fromCity = fromIana.split('/').pop()?.replace(/_/g, ' ') ?? fromIana
        const toCity = toIana.split('/').pop()?.replace(/_/g, ' ') ?? toIana
        if (hour !== null && minute !== null) {
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
          const display = `${timeStr} ${fromCity} to ${toCity}`
          setInputValue(display)
          setCurrentInputValue(display)
        } else {
          const display = `${fromCity} to ${toCity}`
          setInputValue(display)
          setCurrentInputValue(display)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalQuery])

  // After a submitted/swapped conversion, replace URL with canonical form if possible
  useEffect(() => {
    if (!result || !shouldCanonicalizeRef.current) return
    shouldCanonicalizeRef.current = false
    const canonical = buildCanonicalParams(result)
    if (canonical) {
      replaceWithCanonical(canonical)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // Logo returns to a clean landing state, not merely a cleared query.
  const handleGoHome = useCallback(() => {
    handleClear()
    setView('card')
    if (window.location.pathname !== '/') {
      history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [handleClear, setView])

  const handleSubmit = useCallback((query: string) => {
    debouncedRef.current.cancel()
    setIsDebouncing(false)
    setUrlQuery(query)
    setInputValue(query)
    setCurrentInputValue(query)
    shouldCanonicalizeRef.current = true
    runConversion(query)
    addQuery(query)
  }, [setUrlQuery, runConversion, addQuery])

  const handleSwap = useCallback(() => {
    if (!result) return
    const targetCity = result.target.city
    const sourceCity = result.source.city
    const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'
    const targetTime = result.target[timeKey].toLowerCase().replace(/\s/g, '')
    const display = `${targetCity} ${targetTime} in ${sourceCity}`
    setInputValue(display)
    setCurrentInputValue(display)
    shouldCanonicalizeRef.current = true
    swapConversion()
    // URL update is handled by the result effect above
  }, [result, use24h, swapConversion])

  /**
   * Rebuild the query with a different time. Nudging is an edit to the question,
   * not a lens over the answer — so it goes through the same pipeline as typing,
   * and the search bar and URL stay a complete description of what is shown.
   */
  const applyTime = useCallback((time: string | null) => {
    if (!result) return
    // Reuse the words the user typed — editing the time shouldn't silently
    // rewrite "nyc" as "New York".
    const from = result.intent.source.input ?? result.source.city
    const to = result.intent.target.input ?? result.target.city
    const query = time ? `${time} ${from} to ${to}` : `${from} to ${to}`
    setInputValue(query)
    setCurrentInputValue(query)
    shouldCanonicalizeRef.current = true
    // Replace rather than push: a run of nudges shouldn't flood history.
    replaceUrlQuery(query)
    runConversion(query)
  }, [result, replaceUrlQuery, runConversion])

  const nudgeTime = useCallback((deltaMinutes: number) => {
    if (!result) return
    const next = DateTime.fromISO(result.sourceDateTime)
      .setZone(result.source.iana)
      .plus({ minutes: deltaMinutes })
    if (!next.isValid) return
    applyTime(whenPhrase(next, DateTime.now().setZone(result.source.iana), use24h))
  }, [result, use24h, applyTime])

  const handleValueChange = useCallback((value: string) => {
    setCurrentInputValue(value)
    liveQueryRef.current = value
    if (!value.trim()) {
      debouncedRef.current.cancel()
      setIsDebouncing(false)
      clear()
    } else if (value.trim().length >= 2) {
      setIsDebouncing(true)
      debouncedRef.current.call()
    } else {
      debouncedRef.current.cancel()
      setIsDebouncing(false)
    }
  }, [clear])

  const handleFeelingClick = useCallback(() => {
    const example = getCurrentExample()
    setInputValue(example)
    setCurrentInputValue(example)
    handleSubmit(example)
    advanceExample()
  }, [getCurrentExample, handleSubmit, advanceExample])

  const handleCityClick = useCallback((cityName: string) => {
    handleSubmit(cityName)
  }, [handleSubmit])


  const layerTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }

  // The instant the picker should open on, in the source zone. When the query
  // named no time the answer is tracking the clock, so the picker must open on
  // the live now — not on the instant the conversion happened to run.
  const anchorDateTime = result
    ? isUsingCurrentTime
      ? DateTime.now().setZone(result.source.iana)
      : DateTime.fromISO(result.sourceDateTime).setZone(result.source.iana)
    : null


  // Landing sits a little above centre. A phone is tall and narrow, so the same
  // fraction that centres the stack on a desktop leaves it near the top here.
  const chromePadTop = isActive
    ? (isMobile ? '0.75rem' : '1.25rem')
    : (isMobile ? '28vh' : '22vh')

  // Card content starts below the chrome. Compact chrome is a single row; the
  // landing stack only ever coexists with an empty card layer, so one value does.
  const chromeHeight = isMobile ? '5.5rem' : '6rem'

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Main content */}
      <div className="flex-1 min-h-0">
        {path === '/about' ? (
          <div className="h-full overflow-y-auto bg-background">
            <AboutPage onRunQuery={handleSubmit} />
          </div>
        ) : (
          <div className="page-glow relative h-full w-full overflow-hidden bg-background">
            {/* Top right — where you are and what time it is there. Pinned to the
                corner rather than the search row, so it holds still between landing
                and active. */}
            {!isMobile && (
              <div className="absolute top-4 right-4 z-50">
                <SettingsMenu open={settingsOpen} onOpenChange={setSettingsOpen} />
              </div>
            )}

            {/* z-0 — map runs full bleed, continuing underneath the chrome */}
            {mapMounted && (
              <m.div
                className="absolute inset-0 z-0"
                initial={false}
                animate={view === 'map' ? layerVisible : layerHidden}
                transition={layerTransition}
                style={{ pointerEvents: view === 'map' ? 'auto' : 'none' }}
                inert={view !== 'map'}
              >
                <Suspense fallback={<div className="h-full w-full" />}>
                  <MapView
                    result={result}
                    homeCity={homeCity}
                    use24h={use24h}
                    isLive={isUsingCurrentTime}
                    onCityClick={handleCityClick}
                    isMobile={isMobile}
                  />
                </Suspense>
              </m.div>
            )}

            {/* z-10 — card, cleared of the chrome by a matching top pad */}
            <m.div
              className="absolute inset-0 z-10 overflow-y-auto px-4 pb-24 md:px-[2rem]"
              initial={false}
              animate={view === 'card' ? layerVisible : layerHidden}
              transition={layerTransition}
              style={{ pointerEvents: view === 'card' ? 'auto' : 'none', paddingTop: chromeHeight }}
              inert={view !== 'card'}
            >
              {result && (
                <div className="mx-auto w-full max-w-[520px]">
                  <ResultCard
                    result={result}
                    isUsingCurrentTime={isUsingCurrentTime}
                    matchType={matchType}
                    onSwap={handleSwap}
                  />
                </div>
              )}
            </m.div>

            {/* z-10 — share, a peer of card and map rather than a card face */}
            <m.div
              className="absolute inset-0 z-10 overflow-y-auto px-4 pb-24 md:px-[2rem]"
              initial={false}
              animate={view === 'share' ? layerVisible : layerHidden}
              transition={layerTransition}
              style={{ pointerEvents: view === 'share' ? 'auto' : 'none', paddingTop: chromeHeight }}
              inert={view !== 'share'}
            >
              {result && (
                <div className="mx-auto w-full max-w-[520px]">
                  <ShareView
                    result={result}
                    query={currentInputValue}
                    use24h={use24h}
                  />
                </div>
              )}
            </m.div>

            {/* Mobile settings — beside the switcher, not a segment in it:
                Card/Map/Share latch when pressed, this opens a panel. */}
            {isMobile && (
              <div
                className="absolute right-4 z-50"
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
              >
                <SettingsMenu open={settingsOpen} onOpenChange={setSettingsOpen} asButton />
              </div>
            )}

            {/* The switcher belongs to the result, not the question, so it sits with
                the other result-level tools along the bottom edge. */}
            {hasResult && (
              <div
                className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
                style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : '1rem' }}
              >
                <div className="pointer-events-auto">
                  <ViewToggle view={view} onChange={setView} />
                </div>
              </div>
            )}

            {/* Time control — outside the fading layers, so it holds still when
                you switch views, and has room here for more than a stepper. */}
            {hasResult && (
              <div
                className="absolute right-4 z-40"
                style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 4rem)' : '1rem' }}
              >
                <TimeControl
                  isLive={isUsingCurrentTime}
                  onNudge={nudgeTime}
                  onReset={() => applyTime(null)}
                  anchor={anchorDateTime}
                  use24h={use24h}
                />
              </div>
            )}

            {/* z-20 — chrome. One grid in both states, so the centre column that
                holds the input is the same 520px column the card sits in — that is
                what keeps the search bar and the result optically aligned. */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-20 transition-[padding-top] duration-[350ms] ease-out motion-reduce:transition-none ${
                view === 'map' ? 'bg-gradient-to-b from-background via-background/85 to-transparent pb-10' : ''
              }`}
              style={{ paddingTop: chromePadTop }}
            >
              <div className="pointer-events-auto mx-auto grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 md:grid-cols-[minmax(2.75rem,1fr)_minmax(0,520px)_minmax(2.75rem,1fr)] md:gap-x-4 md:px-[2rem]">
                {/* Logo: beside the input once active, above it on landing */}
                <m.div
                  layout="position"
                  transition={layerTransition}
                  className={isActive ? 'col-start-1 row-start-1 justify-self-end' : 'col-start-2 row-start-1 justify-self-center'}
                >
                  <SunDialLogo onClick={handleGoHome} compact={isActive} />
                </m.div>

                {/* Always the centre column, always 520px — never resized, so
                    nothing inside it is ever scaled during the morph. */}
                <div className={`col-start-2 ${isActive ? 'row-start-1' : 'row-start-2'}`}>
                  <QueryInput
                    ref={inputRef}
                    onSubmit={handleSubmit}
                    onClear={handleClear}
                    onValueChange={handleValueChange}
                    onRemoveQuery={removeQuery}
                    initialValue={inputValue}
                    placeholder={isLandingScreen ? placeholder : undefined}
                    recentQueries={recentQueries}
                    isProcessing={isDebouncing}
                    onFocusChange={setInputFocused}
                    placeholderActive={vibeHovered}
                  />
                </div>

                {error && (
                  <div className={`col-start-2 ${isActive ? 'row-start-2' : 'row-start-3'}`}>
                    <ErrorDisplay error={error} onClear={handleClear} />
                  </div>
                )}

                {/* Landing extras — this screen is not the card view with nothing in
                    it. Focusing the input fades these rather than unmounting them, so
                    the layout never jumps while you are typing. */}
                {isLandingScreen && (
                  <div
                    className={`col-start-2 row-start-3 mt-3 grid grid-cols-[1fr_auto_1fr] items-baseline gap-x-5 transition-opacity duration-200 ${
                      inputFocused ? 'pointer-events-none opacity-0' : 'opacity-100'
                    }`}
                  >
                    {/* "or" is pinned to the centre column, so the map link holds
                        still as the adjective changes length. */}
                    <div className="justify-self-end">
                      <CityVibe
                        fallbackFeelingWord={feelingWord}
                        onClick={handleFeelingClick}
                        onHoverChange={setVibeHovered}
                      />
                    </div>
                    {/* One voice — the card's serif italic — so these read as two
                        halves of a sentence, broken by the "or" and the space. */}
                    <span className="font-serif text-[0.95rem] italic text-muted-foreground/40" aria-hidden="true">or</span>
                    <button
                      onClick={() => setView('map')}
                      className="cursor-pointer justify-self-start font-serif text-[0.95rem] italic text-muted-foreground transition-colors hover:text-accent"
                    >
                      explore the map
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
    </LazyMotion>
  )
}

export default App

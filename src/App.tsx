import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { LazyMotion, m, useReducedMotion } from 'motion/react'
import { QueryInput } from '@/components/QueryInput'
import { ResultCard } from '@/components/ResultCard'
import { ShareView } from '@/components/ShareView'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { CityVibe } from '@/components/CityVibe'
import { SettingsMenu } from '@/components/SettingsMenu'
import { MobileTabBar } from '@/components/MobileTabBar'
import { AboutPage } from '@/components/AboutPage'
import { SunDialLogo } from '@/components/SunDialLogo'
import { ViewToggle } from '@/components/ViewToggle'
import { TimeOffsetControl } from '@/components/TimeOffsetControl'
import { useConversion } from '@/hooks/useConversion'
import { useRecentQueries } from '@/hooks/useRecentQueries'
import { useUrlState, type ViewMode } from '@/hooks/useUrlState'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRotatingPlaceholder } from '@/hooks/useRotatingPlaceholder'
import { usePreferences } from '@/hooks/usePreferences'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useTimeOffset } from '@/hooks/useTimeOffset'
import { createDebouncedCallback } from '@/lib/debounce'
import { buildCanonicalParams } from '@/lib/canonicalUrl'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const liveQueryRef = useRef('')
  const shouldCanonicalizeRef = useRef(false)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [inputFocused, setInputFocused] = useState(false)
  const [vibeHovered, setVibeHovered] = useState(false)
  const reduceMotion = useReducedMotion()
  // The map chunk is lazy; once it has been shown we keep it mounted so pan/zoom,
  // layer toggles and the time nudge survive a trip through the card view.
  const [mapMounted, setMapMounted] = useState(view === 'map')
  useEffect(() => { if (view === 'map') setMapMounted(true) }, [view])
  const homeIana = homeCity?.iana ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const offset = useTimeOffset(result, homeIana, use24h, isUsingCurrentTime)
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

  const handleMobileTabChange = useCallback((tab: ViewMode) => {
    setSettingsOpen(false)
    setView(tab)
    // Navigate away from /about when switching tabs
    if (window.location.pathname === '/about') {
      history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [setView])

  useKeyboardShortcuts(inputRef, settingsOpen, setSettingsOpen, showExamples, handleClear, toggleView)

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
    setSettingsOpen(false)
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

  const chromePadTop = isActive
    ? (isMobile ? '0.75rem' : '1.25rem')
    : (isMobile ? '5vh' : '22vh')

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
            {/* Settings — same pill language as the map's layers control. Pinned to
                the right on desktop; part of the row on mobile, where there is no
                spare width to overlay it. */}
            {!isMobile && (
              <div className="absolute top-4 right-4 z-30">
                <SettingsMenu open={settingsOpen} onOpenChange={setSettingsOpen} />
              </div>
            )}

            {/* Mobile: floating view switcher, once there is a result to switch between */}
            {isMobile && hasResult && (
              <MobileTabBar activeTab={view} onTabChange={handleMobileTabChange} />
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
                    offset={offset}
                    onCityClick={handleCityClick}
                    isMobile={isMobile}
                  />
                </Suspense>
              </m.div>
            )}

            {/* z-10 — card, cleared of the chrome by a matching top pad */}
            <m.div
              className="absolute inset-0 z-10 overflow-y-auto px-4 pb-6 md:px-[2rem]"
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
                    offsetMinutes={offset.offsetMinutes}
                    onResetOffset={offset.reset}
                  />
                </div>
              )}
            </m.div>

            {/* z-10 — share, a peer of card and map rather than a card face */}
            <m.div
              className="absolute inset-0 z-10 overflow-y-auto px-4 pb-6 md:px-[2rem]"
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

            {/* Time control — belongs to the result, not to any one rendering of
                it, so it sits outside the fading layers and never animates. */}
            {result && (
              <div
                className="absolute right-4 z-40"
                style={{ bottom: isMobile ? 'calc(env(safe-area-inset-bottom) + 5.25rem)' : '1rem' }}
              >
                <TimeOffsetControl offset={offset} roomy={isMobile} />
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
              <div className="pointer-events-auto mx-auto grid w-full grid-cols-[minmax(2.75rem,1fr)_minmax(0,520px)_minmax(2.75rem,1fr)] items-center gap-x-4 gap-y-3 px-4 md:px-[2rem]">
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

                {/* The switcher only exists once there is a result to switch between */}
                {!isMobile && hasResult && (
                  <m.div
                    layout="position"
                    transition={layerTransition}
                    className="col-start-3 row-start-1 justify-self-start"
                  >
                    <ViewToggle view={view} onChange={setView} />
                  </m.div>
                )}

                {isMobile && (
                  <div className={`col-start-3 justify-self-start ${isActive ? 'row-start-1' : 'row-start-2'}`}>
                    <SettingsMenu open={settingsOpen} onOpenChange={setSettingsOpen} asSheet />
                  </div>
                )}

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
                    className={`col-start-2 row-start-3 flex flex-col items-center gap-2 transition-opacity duration-200 ${
                      inputFocused ? 'pointer-events-none opacity-0' : 'opacity-100'
                    }`}
                  >
                    <CityVibe
                      fallbackFeelingWord={feelingWord}
                      onClick={handleFeelingClick}
                      onHoverChange={setVibeHovered}
                    />
                    <button
                      onClick={() => setView('map')}
                      className="text-[0.8rem] text-muted-foreground/60 transition-colors hover:text-foreground"
                    >
                      or explore the map
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

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { LazyMotion, m, useReducedMotion } from 'motion/react'
import { QueryInput } from '@/components/QueryInput'
import { FlippableCard } from '@/components/FlippableCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { CityVibe } from '@/components/CityVibe'
import { SettingsMenu } from '@/components/SettingsMenu'
import { MobileTabBar, type MobileTab } from '@/components/MobileTabBar'
import { MobileSettings } from '@/components/MobileSettings'
import { AboutPage } from '@/components/AboutPage'
import { SunDialLogo } from '@/components/SunDialLogo'
import { ViewToggle } from '@/components/ViewToggle'
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
  const { timeFormat, homeCity } = usePreferences()
  const [inputValue, setInputValue] = useState<string | undefined>(undefined)
  const [currentInputValue, setCurrentInputValue] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const liveQueryRef = useRef('')
  const shouldCanonicalizeRef = useRef(false)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [mobileSettings, setMobileSettings] = useState(false)
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

  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    if (tab === 'settings') {
      setMobileSettings(true)
    } else {
      setMobileSettings(false)
      setView(tab)
    }
    // Navigate away from /about when switching tabs
    if (window.location.pathname === '/about') {
      history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [setView])

  useKeyboardShortcuts(inputRef, settingsOpen, setSettingsOpen, showExamples, handleClear, toggleView)
  const { placeholder, feelingWord, getCurrentExample, previewCities } = useRotatingPlaceholder(currentInputValue.length > 0)

  const isLanding = !result && !error
  // The header lifts as soon as there is something to show. Map counts as content
  // in its own right: WorldMap uses preserveAspectRatio="slice", so a short
  // container crops the world instead of shrinking it. Whenever a result exists
  // both views are active, so toggling never moves the input — the only place the
  // header travels is the empty landing state, where there is nothing to anchor.
  const isActive = Boolean(result || error || currentInputValue.trim() || view === 'map')

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
    const timeKey = timeFormat === '24h' ? 'formattedTime24' : 'formattedTime12'
    const targetTime = result.target[timeKey].toLowerCase().replace(/\s/g, '')
    const display = `${targetCity} ${targetTime} in ${sourceCity}`
    setInputValue(display)
    setCurrentInputValue(display)
    shouldCanonicalizeRef.current = true
    swapConversion()
    // URL update is handled by the result effect above
  }, [result, timeFormat, swapConversion])

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
  }, [getCurrentExample, handleSubmit])

  const handleCityClick = useCallback((cityName: string) => {
    handleSubmit(cityName)
  }, [handleSubmit])

  // The view is the single source of truth; settings is the one screen that sits beside it.
  const mobileTab: MobileTab = mobileSettings ? 'settings' : view
  const showMobileSettings = isMobile && mobileSettings

  const layerTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }

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
        ) : showMobileSettings ? (
          <MobileSettings />
        ) : (
          <div className="page-glow relative h-full w-full overflow-hidden bg-background">
            {/* Settings — same pill language as the map's layers control */}
            {!isMobile && (
              <div className="absolute top-4 right-4 z-30">
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
                    use24h={timeFormat === '24h'}
                    hasQuery={currentInputValue.trim().length > 0}
                    onCityClick={handleCityClick}
                    previewCities={previewCities}
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
                  <FlippableCard
                    result={result}
                    isUsingCurrentTime={isUsingCurrentTime}
                    matchType={matchType}
                    onSwap={handleSwap}
                    query={currentInputValue}
                    use24h={timeFormat === '24h'}
                  />
                </div>
              )}
            </m.div>

            {/* z-20 — chrome. Scrim only once the map is behind it. */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-20 transition-[padding-top] duration-[350ms] ease-out motion-reduce:transition-none ${
                view === 'map' ? 'bg-gradient-to-b from-background via-background/85 to-transparent pb-10' : ''
              }`}
              style={{ paddingTop: isActive ? (isMobile ? '0.75rem' : '1.25rem') : (isMobile ? '5vh' : '22vh') }}
            >
              <div className="pointer-events-auto mx-auto flex w-full max-w-[820px] flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 md:px-[2rem]">
                <m.div layout="position" transition={layerTransition} className={isActive ? 'order-1' : 'order-1 flex basis-full justify-center'}>
                  <SunDialLogo onClick={handleGoHome} compact={isActive} />
                </m.div>

                {/* Width is identical in both states — only the position moves, so
                    nothing inside the input is ever scaled. */}
                <div className={isActive ? 'order-2 min-w-0 max-w-[520px] flex-1' : 'order-2 w-full max-w-[520px]'}>
                  <QueryInput
                    ref={inputRef}
                    onSubmit={handleSubmit}
                    onClear={handleClear}
                    onValueChange={handleValueChange}
                    onRemoveQuery={removeQuery}
                    initialValue={inputValue}
                    placeholder={placeholder}
                    recentQueries={recentQueries}
                    isProcessing={isDebouncing}
                  />
                </div>

                {!isMobile && (
                  <m.div layout="position" transition={layerTransition} className={isActive ? 'order-3' : 'order-3 basis-full flex justify-center'}>
                    <ViewToggle view={view} onChange={setView} />
                  </m.div>
                )}

                {error && (
                  <div className="order-4 mx-auto w-full max-w-[520px] basis-full">
                    <ErrorDisplay error={error} onClear={handleClear} />
                  </div>
                )}

                {isLanding && view === 'card' && (
                  <div className="order-5 flex basis-full justify-center">
                    <CityVibe
                      fallbackFeelingWord={feelingWord}
                      onClick={handleFeelingClick}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: bottom tab bar */}
      {isMobile && (
        <MobileTabBar activeTab={mobileTab} onTabChange={handleMobileTabChange} />
      )}
    </div>
    </LazyMotion>
  )
}

export default App

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { QueryInput } from '@/components/QueryInput'
import { FlippableCard } from '@/components/FlippableCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { CityVibe } from '@/components/CityVibe'
import { Sidebar, RAIL_WIDTH, EXPANDED_WIDTH } from '@/components/Sidebar'
import { MobileTabBar, type MobileTab } from '@/components/MobileTabBar'
import { MobileSettings } from '@/components/MobileSettings'
import { AboutPage } from '@/components/AboutPage'
import { SunDialLogo } from '@/components/SunDialLogo'
import { useConversion } from '@/hooks/useConversion'
import { useRecentQueries } from '@/hooks/useRecentQueries'
import { useUrlState } from '@/hooks/useUrlState'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRotatingPlaceholder } from '@/hooks/useRotatingPlaceholder'
import { usePreferences } from '@/hooks/usePreferences'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { createDebouncedCallback } from '@/lib/debounce'
import { sendTelemetry } from '@/lib/telemetry'
import { buildCanonicalParams } from '@/lib/canonicalUrl'
import { Analytics } from '@vercel/analytics/react'

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

export type ViewMode = 'card' | 'map'

function App() {
  const path = usePath()
  const { result, error, isUsingCurrentTime, matchType, runConversion, runCanonicalConversion, swapConversion, clear } = useConversion()
  const { queries: recentQueries, addQuery, removeQuery } = useRecentQueries()
  const { query: urlQuery, canonicalQuery, setQuery: setUrlQuery, replaceQuery: replaceUrlQuery, replaceWithCanonical } = useUrlState()
  const { timeFormat, homeCity } = usePreferences()
  const [inputValue, setInputValue] = useState<string | undefined>(undefined)
  const [currentInputValue, setCurrentInputValue] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('view') === 'map' ? 'map' : 'card'
  })
  const [isDebouncing, setIsDebouncing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const liveQueryRef = useRef('')
  const shouldCanonicalizeRef = useRef(false)
  const touchStart = useRef({ x: 0, y: 0 })
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('view') === 'map' ? 'map' : 'card'
  })
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
    setSidebarOpen(false)
    handleClear()
    inputRef.current?.focus()
  }, [handleClear])

  const toggleView = useCallback(() => {
    setViewMode(v => v === 'card' ? 'map' : 'card')
  }, [])

  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    setMobileTab(tab)
    if (tab === 'card' || tab === 'map') {
      setViewMode(tab)
    }
  }, [])

  useKeyboardShortcuts(inputRef, sidebarOpen, setSidebarOpen, showExamples, handleClear, toggleView)
  const { placeholder, feelingWord, getCurrentExample, previewCities } = useRotatingPlaceholder(currentInputValue.length > 0)

  const isLanding = !result && !error

  useEffect(() => {
    if (urlQuery) {
      setInputValue(urlQuery)
      setCurrentInputValue(urlQuery)
      shouldCanonicalizeRef.current = true
      const outcome = runConversion(urlQuery)
      sendTelemetry({ query: urlQuery, ...outcome })
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
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        const fromCity = fromIana.split('/').pop()?.replace(/_/g, ' ') ?? fromIana
        const toCity = toIana.split('/').pop()?.replace(/_/g, ' ') ?? toIana
        const display = `${timeStr} ${fromCity} to ${toCity}`
        setInputValue(display)
        setCurrentInputValue(display)
      }
      sendTelemetry({ query: `canonical:${fromIana}>${toIana}@${hour}:${minute}`, ...outcome })
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

  const handleSubmit = useCallback((query: string) => {
    debouncedRef.current.cancel()
    setIsDebouncing(false)
    setSidebarOpen(false)
    setUrlQuery(query)
    setInputValue(query)
    setCurrentInputValue(query)
    shouldCanonicalizeRef.current = true
    const outcome = runConversion(query)
    sendTelemetry({ query, ...outcome })
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

  const handleGoHome = useCallback(() => {
    setViewMode('card')
    handleClear()
  }, [handleClear])

  // Map mode query change handler
  const handleMapQueryChange = useCallback((value: string) => {
    setCurrentInputValue(value)
    handleValueChange(value)
  }, [handleValueChange])

  // Swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0 && !sidebarOpen) setSidebarOpen(true)
      if (dx < 0 && sidebarOpen) setSidebarOpen(false)
    }
  }, [sidebarOpen])

  const mainOffset = isMobile ? 0 : sidebarOpen ? EXPANDED_WIDTH : RAIL_WIDTH

  // On mobile, determine which screen to show based on tab
  const mobileScreen = isMobile ? mobileTab : null

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
      onTouchStart={!isMobile ? handleTouchStart : undefined}
      onTouchEnd={!isMobile ? handleTouchEnd : undefined}
    >
      <Analytics />

      {/* Desktop: sidebar (hidden on mobile — tabs replace it) */}
      {!isMobile && (
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onClose={() => setSidebarOpen(false)}
          isMobile={false}
          viewMode={viewMode}
          onViewChange={setViewMode}
        />
      )}

      {/* Main content */}
      <div
        className="flex-1 min-h-0 transition-[margin-left] duration-200 ease-out"
        style={{ marginLeft: mainOffset }}
      >
        {path === '/about' ? (
          <div className="h-full overflow-y-auto bg-background">
            <AboutPage onRunQuery={handleSubmit} />
          </div>
        ) : mobileScreen === 'settings' ? (
          <MobileSettings />
        ) : viewMode === 'map' ? (
          <div className="h-full bg-background">
            <Suspense fallback={<div className="h-full bg-background" />}>
              <MapView
                result={result}
                homeCity={homeCity}
                use24h={timeFormat === '24h'}
                query={currentInputValue}
                onQueryChange={handleMapQueryChange}
                onSubmit={handleSubmit}
                onClear={handleClear}
                onCityClick={handleCityClick}
                onGoHome={handleGoHome}
                placeholder={placeholder}
                previewCities={previewCities}
                isProcessing={isDebouncing}
                queryInputRef={inputRef}
                isMobile={isMobile}
              />
            </Suspense>
          </div>
        ) : (
          <div className="h-full bg-background">
            <div className="page-glow relative mx-auto flex h-full max-w-[520px] flex-col items-center px-4 md:px-[2rem]">
              {/* Spacer — compact on mobile to keep results above fold */}
              <div className="h-[5vh] md:h-[25vh] flex-shrink-0" />

              {/* Logo */}
              <div className="mb-2 md:mb-6 flex-shrink-0">
                <SunDialLogo onClick={handleClear} />
              </div>

              {/* Search bar */}
              <div className="w-full flex-shrink-0">
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

              {/* Landing */}
              {isLanding && (
                <div className="mt-4 flex-shrink-0">
                  <CityVibe
                    fallbackFeelingWord={feelingWord}
                    onClick={handleFeelingClick}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 md:mt-8 w-full flex-1 min-h-0 overflow-y-auto pb-4">
                  <ErrorDisplay error={error} onClear={handleClear} />
                </div>
              )}

              {/* Result card */}
              {result && (
                <div className="mt-4 md:mt-8 w-full flex-1 min-h-0 overflow-y-auto pb-4">
                  <FlippableCard
                    result={result}
                    isUsingCurrentTime={isUsingCurrentTime}
                    matchType={matchType}
                    onSwap={handleSwap}
                    query={currentInputValue}
                    use24h={timeFormat === '24h'}
                    onViewOnMap={() => {
                      setViewMode('map')
                      if (isMobile) setMobileTab('map')
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile: bottom tab bar */}
      {isMobile && (
        <MobileTabBar activeTab={mobileTab} onTabChange={handleMobileTabChange} />
      )}
    </div>
  )
}

export default App

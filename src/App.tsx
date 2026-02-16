import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { QueryInput } from '@/components/QueryInput'
import { FlippableCard } from '@/components/FlippableCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { CityVibe } from '@/components/CityVibe'
import { SettingsPage } from '@/components/SettingsPage'
import { SunDialLogo } from '@/components/SunDialLogo'
import { useConversion } from '@/hooks/useConversion'
import { useRecentQueries } from '@/hooks/useRecentQueries'
import { useUrlState } from '@/hooks/useUrlState'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRotatingPlaceholder } from '@/hooks/useRotatingPlaceholder'
import { usePreferences } from '@/hooks/usePreferences'
import { createDebouncedCallback } from '@/lib/debounce'
import { sendTelemetry } from '@/lib/telemetry'

function App() {
  const { result, error, isUsingCurrentTime, matchType, runConversion, swapConversion, clear } = useConversion()
  const { queries: recentQueries, addQuery, removeQuery } = useRecentQueries()
  const { query: urlQuery, setQuery: setUrlQuery, replaceQuery: replaceUrlQuery } = useUrlState()
  const { timeFormat } = usePreferences()
  const [inputValue, setInputValue] = useState<string | undefined>(undefined)
  const [currentInputValue, setCurrentInputValue] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const hintDismissed = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const liveQueryRef = useRef('')
  const touchStart = useRef({ x: 0, y: 0 })

  const handleOpenSettings = useCallback(() => {
    hintDismissed.current = true
    setShowHint(false)
    setShowSettings(true)
  }, [])

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
    setShowSettings(false)
    handleClear()
    inputRef.current?.focus()
  }, [handleClear])

  useKeyboardShortcuts(inputRef, showSettings, setShowSettings, showExamples, handleClear)
  const { placeholder, feelingWord, getCurrentExample } = useRotatingPlaceholder(currentInputValue.length > 0)

  const isLanding = !result && !error

  // Idle hint — fades in once after a few seconds, permanently dismissed after first flip
  useEffect(() => {
    if (!isLanding || showSettings || hintDismissed.current) {
      setShowHint(false)
      return
    }
    const timer = setTimeout(() => setShowHint(true), 3500)
    return () => clearTimeout(timer)
  }, [isLanding, showSettings])

  useEffect(() => {
    if (urlQuery) {
      setInputValue(urlQuery)
      setCurrentInputValue(urlQuery)
      const outcome = runConversion(urlQuery)
      sendTelemetry({ query: urlQuery, ...outcome })
      addQuery(urlQuery)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery])

  const handleSubmit = useCallback((query: string) => {
    debouncedRef.current.cancel()
    setIsDebouncing(false)
    setShowSettings(false)
    setUrlQuery(query)
    setCurrentInputValue(query)
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
    const swappedQuery = `${targetCity} ${targetTime} in ${sourceCity}`
    replaceUrlQuery(swappedQuery)
    swapConversion()
  }, [result, timeFormat, swapConversion, replaceUrlQuery])

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

  // Swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && !showSettings) handleOpenSettings()
      if (dx > 0 && showSettings) setShowSettings(false)
    }
  }, [showSettings, handleOpenSettings])

  return (
    <div
      className="h-dvh overflow-hidden"
      style={{ perspective: '2400px' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="relative h-full transition-transform duration-500 [transform-style:preserve-3d]"
        style={showSettings ? { transform: 'rotateY(180deg)' } : undefined}
      >
        {/* Front — Convert */}
        <div className="absolute inset-0 bg-background [backface-visibility:hidden]">
          <div className="page-glow relative mx-auto flex h-full max-w-[520px] flex-col items-center px-[2rem]">
            {/* Spacer — constant height, logo stays in place */}
            <div className="h-[25vh] flex-shrink-0" />

            {/* Logo */}
            <div className="mb-6 flex-shrink-0">
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

            {/* Landing — just CityVibe */}
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
              <div className="mt-8 w-full flex-1 min-h-0 overflow-y-auto pb-10">
                <ErrorDisplay error={error} onClear={handleClear} />
              </div>
            )}

            {/* Result card */}
            {result && (
              <div className="mt-8 w-full flex-1 min-h-0 overflow-y-auto pb-10">
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
          </div>

          {/* Idle hint — hand-drawn arrow draws in, then text fades in */}
          <button
            onClick={handleOpenSettings}
            className={`absolute bottom-14 right-4 flex items-end gap-2 ${
              showHint && isLanding ? '' : 'pointer-events-none'
            }`}
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={showHint && isLanding ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 1.2 }}
              className="mb-4 font-serif text-[1rem] italic text-muted-foreground/70 sm:text-[1.15rem]"
            >
              details & usage
            </motion.span>
            <motion.div
              initial={{ clipPath: 'inset(0% 100% 100% 0%)' }}
              animate={showHint && isLanding ? { clipPath: 'inset(0% 0% 0% 0%)' } : { clipPath: 'inset(0% 100% 100% 0%)' }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
            >
              <svg
                width="100" height="80" viewBox="0 0 122 97" fill="none"
                className="text-muted-foreground/50"
                style={{ transform: 'scaleY(-1)' }}
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M116.102 0.0996005C114.952 0.334095 112.7 1.53002 111.433 2.53834C110.869 2.98388 109.368 4.15635 108.077 5.11778C103.455 8.6352 102.61 9.40903 102.187 10.4877C101.39 12.5982 102.798 14.5914 105.097 14.5914C106.13 14.5914 108.241 13.7941 109.696 12.8561C110.424 12.3871 111.01 12.0823 111.01 12.1526C111.01 12.692 107.796 17.8274 106.2 19.8206C102.023 25.0733 95.6642 29.6928 86.2548 34.2889C81.0926 36.8214 77.4555 38.2753 73.9123 39.2367C71.7066 39.823 70.6507 39.9871 67.9053 40.0809C66.0516 40.1513 64.5499 40.1747 64.5499 40.1278C64.5499 40.0809 64.808 38.9788 65.1365 37.6891C65.465 36.3993 65.8404 34.1716 66.0047 32.7647C66.4505 28.3796 65.4884 24.2994 63.4704 22.2359C62.1564 20.8758 60.9363 20.3599 59.0121 20.3599C57.6043 20.3599 57.1115 20.4537 55.7975 21.1103C52.8878 22.5407 50.5648 25.9878 49.5089 30.4197C48.453 34.922 49.2742 38.0877 52.3481 41.1127C53.4744 42.2148 54.46 42.9183 55.9852 43.6921C57.1584 44.2549 58.1439 44.7473 58.1909 44.7708C58.5898 45.0053 54.5304 53.4705 52.0666 57.6211C47.4674 65.3125 39.3486 74.575 30.5728 82.0789C22.2427 89.2309 16.7285 92.4435 9.87677 94.1553C8.28116 94.554 7.13138 94.6478 4.2452 94.6478C1.17131 94.6712 0.608154 94.7181 0.608154 95.023C0.608154 95.234 1.19478 95.5857 2.13337 95.9609C3.54126 96.4768 3.96363 96.5472 7.41296 96.5237C10.5572 96.5237 11.4724 96.4299 13.1149 96.0078C21.7265 93.6863 31.1594 87.1908 42.6102 75.7006C49.2977 69.0175 52.5828 64.9373 56.1494 58.9343C58.0501 55.7217 60.6312 50.6801 61.7575 47.9365L62.5553 45.9902L64.0806 46.1543C71.3547 46.9047 77.7136 45.3101 88.3667 40.034C96.2274 36.1414 101.976 32.3426 106.505 28.0748C108.617 26.0816 111.855 22.2828 112.794 20.7117C113.028 20.313 113.286 19.9847 113.357 19.9847C113.427 19.9847 113.662 20.782 113.873 21.72C114.084 22.6814 114.647 24.276 115.093 25.2609C115.82 26.8085 116.008 27.043 116.454 26.9727C116.876 26.9258 117.228 26.4333 117.956 24.9795C119.317 22.2828 119.833 20.2661 120.772 13.8879C121.757 7.25168 121.781 4.4143 120.889 2.56179C119.95 0.615488 118.12 -0.322489 116.102 0.0996005ZM60.7016 25.7767C61.4525 26.9023 61.8279 29.2942 61.6637 31.9205C61.4759 34.7813 60.5139 38.9788 60.0681 38.9788C59.5284 38.9788 57.1584 37.6422 56.2198 36.8214C54.8354 35.6021 54.3426 34.2889 54.5538 32.2957C54.8589 29.2473 56.1964 26.2223 57.5808 25.3547C58.7306 24.6512 60.0681 24.8388 60.7016 25.7767Z" fill="currentColor" />
              </svg>
            </motion.div>
          </button>

        </div>

        {/* Back — Settings */}
        <div className="absolute inset-0 bg-background [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
          <div className="mx-auto h-full max-w-[520px] overflow-y-auto px-[2rem]">
            <div className="flex min-h-full flex-col justify-center py-8 pb-12">
              <SettingsPage onRunQuery={handleSubmit} />
            </div>
          </div>
        </div>
      </div>

      {/* Dog-ear — outside flip container, always stable */}
      <button
        onClick={showSettings ? () => setShowSettings(false) : handleOpenSettings}
        className="absolute right-0 bottom-0 z-10 h-11 w-11 cursor-pointer transition-colors [clip-path:polygon(100%_0,100%_100%,0_100%)] bg-muted-foreground/25 hover:bg-muted-foreground/40"
        aria-label={showSettings ? 'Back to converter' : 'Open settings'}
      />
    </div>
  )
}

export default App

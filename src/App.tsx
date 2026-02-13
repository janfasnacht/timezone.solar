import { useState, useCallback, useEffect, useRef } from 'react'
import { QueryInput } from '@/components/QueryInput'
import { ResultCard } from '@/components/ResultCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { CityVibe } from '@/components/CityVibe'
import { HelpModal } from '@/components/HelpModal'
import { AboutModal } from '@/components/AboutModal'
import { SettingsModal } from '@/components/SettingsModal'
import { Footer } from '@/components/Footer'
import { SunDialLogo } from '@/components/SunDialLogo'
import { useConversion } from '@/hooks/useConversion'
import { useRecentQueries } from '@/hooks/useRecentQueries'
import { useUrlState } from '@/hooks/useUrlState'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRotatingPlaceholder } from '@/hooks/useRotatingPlaceholder'
import { usePreferences } from '@/hooks/usePreferences'

function App() {
  const { result, error, isUsingCurrentTime, runConversion, swapConversion, clear } = useConversion()
  const { queries: recentQueries, addQuery, removeQuery } = useRecentQueries()
  const { query: urlQuery, setQuery: setUrlQuery, replaceQuery: replaceUrlQuery } = useUrlState()
  const { timeFormat } = usePreferences()
  const [inputValue, setInputValue] = useState<string | undefined>(undefined)
  const [currentInputValue, setCurrentInputValue] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleHelp = useCallback(() => setHelpOpen((v) => !v), [])
  const openHelp = useCallback(() => setHelpOpen(true), [])
  const openAbout = useCallback(() => setAboutOpen(true), [])
  const toggleSettings = useCallback(() => setSettingsOpen((v) => !v), [])

  const handleClear = useCallback(() => {
    clear()
    setInputValue('')
    setCurrentInputValue('')
    replaceUrlQuery('')
  }, [clear, replaceUrlQuery])

  useKeyboardShortcuts(inputRef, toggleHelp, handleClear)
  const { placeholder, feelingWord, getCurrentExample } = useRotatingPlaceholder(currentInputValue.length > 0)

  useEffect(() => {
    if (urlQuery) {
      setInputValue(urlQuery)
      setCurrentInputValue(urlQuery)
      runConversion(urlQuery)
      addQuery(urlQuery)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery])

  const handleSubmit = useCallback((query: string) => {
    setUrlQuery(query)
    setCurrentInputValue(query)
    runConversion(query)
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
  }, [])

  const handleFeelingClick = useCallback(() => {
    const example = getCurrentExample()
    setInputValue(example)
    setCurrentInputValue(example)
    handleSubmit(example)
  }, [getCurrentExample, handleSubmit])

  const isLanding = !result && !error

  return (
    <div className="page-glow relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center px-[2rem] pt-[25vh]">
      {/* Logo — always visible, stable position */}
      <div className="mb-6">
        <SunDialLogo onClick={handleClear} />
      </div>

      {/* Search bar — always same position */}
      <div className="w-full">
        <QueryInput
          ref={inputRef}
          onSubmit={handleSubmit}
          onClear={handleClear}
          onValueChange={handleValueChange}
          onRemoveQuery={removeQuery}
          initialValue={inputValue}
          placeholder={placeholder}
          recentQueries={recentQueries}
        />
      </div>

      {/* Feeling line — only on landing */}
      {isLanding && (
        <div className="mt-4">
          <CityVibe
            fallbackFeelingWord={feelingWord}
            onClick={handleFeelingClick}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-8 w-full">
          <ErrorDisplay error={error} onOpenHelp={openHelp} />
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="mt-8 w-full">
          <ResultCard
            result={result}
            isUsingCurrentTime={isUsingCurrentTime}
            onSwap={handleSwap}
          />
        </div>
      )}

      {/* Footer — pushed to bottom */}
      <div className="mt-auto">
        <Footer onOpenHelp={openHelp} onOpenAbout={openAbout} onOpenSettings={toggleSettings} />
      </div>

      {/* Modals */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

export default App

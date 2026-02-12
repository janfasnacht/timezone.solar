import { useState, useCallback, useEffect, useRef } from 'react'
import { QueryInput } from '@/components/QueryInput'
import { ResultCard } from '@/components/ResultCard'
import { ErrorDisplay } from '@/components/ErrorDisplay'
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
  const { segments: placeholder, feelingWord, getCurrentExample } = useRotatingPlaceholder(currentInputValue.length > 0)

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
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center px-4">
      <div className={`w-full flex flex-col items-center ${isLanding ? 'my-auto' : 'mt-16'}`}>
        {/* Logo */}
        <div className="mb-6">
          <SunDialLogo onClick={handleClear} />
        </div>

        {/* Input */}
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

        {/* "Feeling X" — only on landing */}
        {isLanding && (
          <div className="mt-3">
            <button
              onClick={handleFeelingClick}
              className="text-sm text-muted-foreground/70"
            >
              Feeling <span className="font-serif italic underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/30">{feelingWord}</span>?
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 w-full">
            <ErrorDisplay error={error} onOpenHelp={openHelp} />
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-6 w-full">
            <ResultCard
              result={result}
              isUsingCurrentTime={isUsingCurrentTime}
              onSwap={handleSwap}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer onOpenHelp={openHelp} onOpenAbout={openAbout} onOpenSettings={toggleSettings} />

      {/* Panels & Modals */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

export default App

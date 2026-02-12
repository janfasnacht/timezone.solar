import { useState, useCallback } from 'react'
import { parse } from '@/engine/parser'
import { resolveLocation, getSuggestion } from '@/engine/resolver'
import { convert, swapResult } from '@/engine/converter'
import { getSnapshot } from '@/lib/preferences'
import type { ConversionResult, ConversionError, ResolvedTimezone } from '@/engine/types'

interface UseConversionReturn {
  result: ConversionResult | null
  error: ConversionError | null
  isUsingCurrentTime: boolean
  isImplicitLocal: boolean
  sourceAlternatives: ResolvedTimezone[]
  targetAlternatives: ResolvedTimezone[]
  runConversion: (query: string) => void
  swapConversion: () => void
  clear: () => void
}

function getLocalTimezone(): ResolvedTimezone {
  // Check if user has a home city preference
  const { homeCity } = getSnapshot()
  if (homeCity) {
    const resolved = resolveLocation(homeCity.city)
    if (resolved && resolved.primary.iana === homeCity.iana) {
      return resolved.primary
    }
    return { iana: homeCity.iana, city: homeCity.city, country: homeCity.country, method: 'alias' }
  }

  const iana = Intl.DateTimeFormat().resolvedOptions().timeZone
  // Extract city name from IANA string: "America/New_York" → "New York"
  const parts = iana.split('/')
  const city = (parts[parts.length - 1] ?? iana).replace(/_/g, ' ')

  // Try to resolve via city database for country info
  const resolved = resolveLocation(city)
  if (resolved && resolved.primary.iana === iana) {
    return resolved.primary
  }

  return { iana, city, method: 'alias' }
}

export function useConversion(): UseConversionReturn {
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<ConversionError | null>(null)
  const [isUsingCurrentTime, setIsUsingCurrentTime] = useState(false)
  const [isImplicitLocal, setIsImplicitLocal] = useState(false)
  const [sourceAlternatives, setSourceAlternatives] = useState<ResolvedTimezone[]>([])
  const [targetAlternatives, setTargetAlternatives] = useState<ResolvedTimezone[]>([])

  const swapConversion = useCallback(() => {
    if (!result) return
    const swapped = swapResult(result)
    setResult(swapped)
    setIsUsingCurrentTime(false)
  }, [result])

  const clear = useCallback(() => {
    setResult(null)
    setError(null)
    setIsUsingCurrentTime(false)
    setIsImplicitLocal(false)
    setSourceAlternatives([])
    setTargetAlternatives([])
  }, [])

  const runConversion = useCallback((query: string) => {
    setError(null)
    setResult(null)
    setIsUsingCurrentTime(false)
    setIsImplicitLocal(false)
    setSourceAlternatives([])
    setTargetAlternatives([])

    // Parse
    const parsed = parse(query)
    if (!parsed) {
      setError({
        type: 'parse',
        message: "I didn't understand that query.",
      })
      return
    }

    // Resolve source
    let source: ResolvedTimezone
    let srcAlternatives: ResolvedTimezone[] = []
    const implicitLocal = parsed.sourceLocation === null

    if (parsed.sourceLocation === null) {
      // Use browser's local timezone
      source = getLocalTimezone()
    } else {
      const sourceResult = resolveLocation(parsed.sourceLocation)
      if (!sourceResult) {
        const suggestion = getSuggestion(parsed.sourceLocation)
        setError({
          type: 'resolve-source',
          message: `Couldn't find "${parsed.sourceLocation}"`,
          suggestion: suggestion ? `Did you mean ${suggestion}?` : 'Try a city name, state, or timezone abbreviation',
        })
        return
      }
      source = sourceResult.primary
      srcAlternatives = sourceResult.alternatives
    }

    // Resolve target
    const targetResult = resolveLocation(parsed.targetLocation)
    if (!targetResult) {
      const suggestion = getSuggestion(parsed.targetLocation)
      setError({
        type: 'resolve-target',
        message: `Couldn't find "${parsed.targetLocation}"`,
        suggestion: suggestion ? `Did you mean ${suggestion}?` : 'Try a city name, state, or timezone abbreviation',
      })
      return
    }
    const target = targetResult.primary
    const tgtAlternatives = targetResult.alternatives

    // Convert
    const conversionResult = convert(source, target, parsed.time, parsed.dateModifier, parsed.relativeMinutes)
    setResult(conversionResult)
    setIsUsingCurrentTime(parsed.time === null)
    setIsImplicitLocal(implicitLocal)
    setSourceAlternatives(srcAlternatives)
    setTargetAlternatives(tgtAlternatives)
  }, [])

  return {
    result,
    error,
    isUsingCurrentTime,
    isImplicitLocal,
    sourceAlternatives,
    targetAlternatives,
    runConversion,
    swapConversion,
    clear,
  }
}

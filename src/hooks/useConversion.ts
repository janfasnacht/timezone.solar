import { useState, useCallback } from 'react'
import { parse } from '@/engine/parser'
import type { MatchType } from '@/engine/confidence'
import { resolveLocation, getSuggestion } from '@/engine/resolver'
import { convert, swapResult } from '@/engine/converter'
import { getSnapshot } from '@/lib/preferences'
import type { ConversionResult, ConversionError, LocationRef, ConversionIntent } from '@/engine/types'

export interface ConversionOutcome {
  source_iana: string | null
  target_iana: string | null
  source_method: string | null
  target_method: string | null
  error_type: string | null
}

interface UseConversionReturn {
  result: ConversionResult | null
  error: ConversionError | null
  isUsingCurrentTime: boolean
  isImplicitLocal: boolean
  matchType: MatchType
  sourceAlternatives: LocationRef[]
  targetAlternatives: LocationRef[]
  runConversion: (query: string) => ConversionOutcome
  swapConversion: () => void
  clear: () => void
}

function getLocalTimezone(): LocationRef {
  // Check if user has a home city preference
  const { homeCity } = getSnapshot()
  if (homeCity) {
    const resolved = resolveLocation(homeCity.city)
    if (resolved && resolved.primary.iana === homeCity.iana) {
      return resolved.primary
    }
    return { iana: homeCity.iana, displayName: homeCity.city, kind: 'city', country: homeCity.country, resolveMethod: 'alias' }
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

  return { iana, displayName: city, kind: 'city', resolveMethod: 'alias' }
}

export function useConversion(): UseConversionReturn {
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<ConversionError | null>(null)
  const [isUsingCurrentTime, setIsUsingCurrentTime] = useState(false)
  const [isImplicitLocal, setIsImplicitLocal] = useState(false)
  const [matchType, setMatchType] = useState<MatchType>('none')
  const [sourceAlternatives, setSourceAlternatives] = useState<LocationRef[]>([])
  const [targetAlternatives, setTargetAlternatives] = useState<LocationRef[]>([])

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
    setMatchType('none')
    setSourceAlternatives([])
    setTargetAlternatives([])
  }, [])

  const runConversion = useCallback((query: string): ConversionOutcome => {
    setError(null)
    setResult(null)
    setIsUsingCurrentTime(false)
    setIsImplicitLocal(false)
    setMatchType('none')
    setSourceAlternatives([])
    setTargetAlternatives([])

    // Parse
    const { parsed, matchType: mt } = parse(query)
    setMatchType(mt)
    if (!parsed) {
      setError({
        type: 'parse',
        message: "I didn't understand that query.",
      })
      return { source_iana: null, target_iana: null, source_method: null, target_method: null, error_type: 'parse' }
    }

    // Resolve source
    let source: LocationRef
    let srcAlternatives: LocationRef[] = []
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
        return { source_iana: null, target_iana: null, source_method: null, target_method: null, error_type: 'resolve-source' }
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
      return { source_iana: source.iana, target_iana: null, source_method: source.resolveMethod, target_method: null, error_type: 'resolve-target' }
    }
    const target = targetResult.primary
    const tgtAlternatives = targetResult.alternatives

    // Build intent and convert
    const intent: ConversionIntent = {
      source,
      target,
      time: parsed.time,
      dateModifier: parsed.dateModifier,
    }
    const conversionResult = convert(intent)
    setResult(conversionResult)
    setIsUsingCurrentTime(parsed.time.type === 'now')
    setIsImplicitLocal(implicitLocal)
    setSourceAlternatives(srcAlternatives)
    setTargetAlternatives(tgtAlternatives)

    return { source_iana: source.iana, target_iana: target.iana, source_method: source.resolveMethod, target_method: target.resolveMethod, error_type: null }
  }, [])

  return {
    result,
    error,
    isUsingCurrentTime,
    isImplicitLocal,
    matchType,
    sourceAlternatives,
    targetAlternatives,
    runConversion,
    swapConversion,
    clear,
  }
}

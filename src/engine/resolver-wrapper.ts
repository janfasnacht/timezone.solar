import type { ResolveResult } from './types'
import { resolveLocation } from './resolver'
import { lookupEntity } from './city-entities'
import { US_STATE_TIMEZONES } from './aliases'
import { resolveConfidence } from './confidence'

export interface ResolveResultWithConfidence {
  result: ResolveResult
  confidence: number
}

function isEntityCity(input: string): boolean {
  return lookupEntity(input) !== null
}

function shortInputGating(input: string, result: ResolveResult): boolean {
  if (input.length > 3) return true
  const method = result.primary.resolveMethod
  if (method === 'entity' || method === 'state' || method === 'abbreviation') return true
  if (method === 'city-db' && isEntityCity(input)) return true
  return false
}

function tryHintSplit(input: string): ResolveResult | null {
  const words = input.split(/\s+/)
  if (words.length < 2) return null

  const lastWord = words[words.length - 1].toLowerCase()
  const cityPart = words.slice(0, -1).join(' ')

  // Try last word as US state hint
  const stateIana = US_STATE_TIMEZONES[lastWord]
  if (stateIana) {
    const result = resolveLocation(cityPart)
    if (result && result.primary.iana === stateIana) {
      return result
    }
  }

  // Try resolving city part alone if full input failed
  return resolveLocation(cityPart)
}

function filterDistinctAlternatives(result: ResolveResult): ResolveResult {
  const primaryIana = result.primary.iana
  const seen = new Set<string>([primaryIana])
  const filtered = result.alternatives.filter((alt) => {
    if (seen.has(alt.iana)) return false
    seen.add(alt.iana)
    return true
  })
  return { primary: result.primary, alternatives: filtered }
}

export function resolveWithConfidence(input: string): ResolveResultWithConfidence | null {
  let result = resolveLocation(input)

  if (!result) {
    result = tryHintSplit(input)
  }

  if (!result) return null

  if (!shortInputGating(input, result)) return null

  const filtered = filterDistinctAlternatives(result)
  const isEntity = filtered.primary.resolveMethod === 'entity' || isEntityCity(input)
  const conf = resolveConfidence(filtered.primary, filtered.alternatives, isEntity)

  return { result: filtered, confidence: conf }
}

export function hasDistinctAlternatives(input: string): boolean {
  const wrapped = resolveWithConfidence(input)
  if (!wrapped) return false
  return wrapped.result.alternatives.length > 0
}

import type { LocationRef } from '../types'

export type MatchType = 'exact' | 'exact-noisy' | 'greedy' | 'promoted' | 'none'

export interface ParseConfidenceInput {
  matchType: MatchType
  noiseCount: number
}

export function parseConfidence(input: ParseConfidenceInput): number {
  switch (input.matchType) {
    case 'exact':
      return 1.0
    case 'exact-noisy':
      return Math.max(0, 1.0 - 0.02 * input.noiseCount)
    case 'greedy':
      return Math.max(0, 0.9 - 0.02 * input.noiseCount)
    case 'promoted':
      return 0.1
    case 'none':
      return 0.0
  }
}

const METHOD_SCORES: Record<LocationRef['resolveMethod'], number> = {
  'entity': 1.0,
  'alias': 1.0,
  'state': 1.0,
  'abbreviation': 0.9,
  'city-db': 0.9,
  'fuzzy': 0.7,
}

export function resolveConfidence(
  primary: LocationRef,
  alternatives: LocationRef[],
  isEntity: boolean,
): number {
  let score = METHOD_SCORES[primary.resolveMethod] ?? 0.5
  if (isEntity) score = Math.min(1.0, score + 0.1)
  const distinctIana = new Set(alternatives.map((a) => a.iana).filter((iana) => iana !== primary.iana))
  score -= 0.05 * Math.min(distinctIana.size, 3)
  return Math.max(0, score)
}

export function combinedConfidence(parseConf: number, resolveConf: number): number {
  return parseConf * 0.7 + resolveConf * 0.3
}

export function assignTier(
  confidence: number,
  hasAlternatives: boolean,
): 1 | 2 | 3 {
  if (hasAlternatives && confidence >= 0.75) {
    return 2 // cap at Tier 2 when ambiguous
  }
  if (confidence >= 0.75) return 1
  if (confidence >= 0.3) return 2
  return 3
}

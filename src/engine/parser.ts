import type { Token, ParsedQuery, TimeRef } from './types'
import { DATE_MODIFIERS } from './constants'
import {
  parseTimeToken,
  preprocess,
  mergeLocationTokens,
  removeConnectorBeforeTime,
  stripLeadingConnectors,
} from './parser-utils'
import { classifyToken, type TokenTypeExtended } from './noise-words'
import type { MatchType } from './confidence'

export type { MatchType } from './confidence'

export interface ParseResult {
  parsed: ParsedQuery | null
  matchType: MatchType
  noiseCount: number
}

interface ExtendedToken {
  type: TokenTypeExtended
  value: string
  raw: string
}

function tokenize(input: string): ExtendedToken[] {
  const parts = input.trim().split(/\s+/)
  const tokens: ExtendedToken[] = []
  for (const part of parts) {
    if (!part) continue
    tokens.push({ type: classifyToken(part), value: part, raw: part })
  }
  return tokens
}

function toBaseTokens(tokens: ExtendedToken[]): Token[] {
  return tokens.map((t) => ({
    type: t.type as Token['type'],
    value: t.value,
    raw: t.raw,
  }))
}

interface TimeValueInternal {
  hour: number
  minute: number
}

function tryPatternMatch(tokens: Token[]): {
  sourceLocation: string | null
  targetLocation: string
  time: TimeValueInternal | null
} | null {
  const types = tokens.map((t) => t.type).join(' ')

  // Pattern 1: LOC TIME CONN LOC
  if (types === 'LOCATION TIME CONNECTOR LOCATION') {
    return { sourceLocation: tokens[0].value, time: parseTimeToken(tokens[1].value), targetLocation: tokens[3].value }
  }
  // Pattern 2: TIME LOC CONN LOC
  if (types === 'TIME LOCATION CONNECTOR LOCATION') {
    return { time: parseTimeToken(tokens[0].value), sourceLocation: tokens[1].value, targetLocation: tokens[3].value }
  }
  // Pattern 3: LOC CONN LOC TIME
  if (types === 'LOCATION CONNECTOR LOCATION TIME') {
    return { sourceLocation: tokens[0].value, targetLocation: tokens[2].value, time: parseTimeToken(tokens[3].value) }
  }
  // Pattern 4: LOC TIME LOC
  if (types === 'LOCATION TIME LOCATION') {
    return { sourceLocation: tokens[0].value, time: parseTimeToken(tokens[1].value), targetLocation: tokens[2].value }
  }
  // Pattern 5: LOC CONN LOC
  if (types === 'LOCATION CONNECTOR LOCATION') {
    return { sourceLocation: tokens[0].value, targetLocation: tokens[2].value, time: null }
  }
  // Pattern 6: TIME LOC LOC
  if (types === 'TIME LOCATION LOCATION') {
    return { time: parseTimeToken(tokens[0].value), sourceLocation: tokens[1].value, targetLocation: tokens[2].value }
  }
  // Pattern 7: LOC LOC TIME
  if (types === 'LOCATION LOCATION TIME') {
    return { sourceLocation: tokens[0].value, targetLocation: tokens[1].value, time: parseTimeToken(tokens[2].value) }
  }
  // Pattern 8: LOC LOC
  if (types === 'LOCATION LOCATION') {
    return { sourceLocation: tokens[0].value, targetLocation: tokens[1].value, time: null }
  }
  // Pattern 9: TIME CONN LOC CONN LOC
  if (types === 'TIME CONNECTOR LOCATION CONNECTOR LOCATION') {
    return { time: parseTimeToken(tokens[0].value), sourceLocation: tokens[2].value, targetLocation: tokens[4].value }
  }
  // Pattern 10: TIME CONN LOC
  if (types === 'TIME CONNECTOR LOCATION') {
    return { time: parseTimeToken(tokens[0].value), sourceLocation: null, targetLocation: tokens[2].value }
  }
  // Pattern 11: LOC TIME
  if (types === 'LOCATION TIME') {
    return { time: parseTimeToken(tokens[1].value), sourceLocation: null, targetLocation: tokens[0].value }
  }
  // Pattern 12: TIME LOC
  if (types === 'TIME LOCATION') {
    return { time: parseTimeToken(tokens[0].value), sourceLocation: null, targetLocation: tokens[1].value }
  }
  // Pattern 13: LOC
  if (types === 'LOCATION') {
    return { sourceLocation: null, targetLocation: tokens[0].value, time: null }
  }

  return null
}

function greedyExtract(tokens: ExtendedToken[]): {
  sourceLocation: string | null
  targetLocation: string
  time: TimeValueInternal | null
} | null {
  const timeTokens = tokens.filter((t) => t.type === 'TIME')
  const locationTokens = tokens.filter((t) => t.type === 'LOCATION')

  if (locationTokens.length === 0) return null

  const time = timeTokens.length > 0 ? parseTimeToken(timeTokens[0].value) : null

  if (locationTokens.length === 1) {
    return { sourceLocation: null, targetLocation: locationTokens[0].value, time }
  }

  // 2+ locations: first = source, last = target
  return {
    sourceLocation: locationTokens[0].value,
    targetLocation: locationTokens[locationTokens.length - 1].value,
    time,
  }
}

export function parse(input: string): ParseResult {
  const raw = input.trim()
  if (!raw) return { parsed: null, matchType: 'none', noiseCount: 0 }

  // Pre-process
  const { cleaned, relativeMinutes } = preprocess(raw)
  if (!cleaned) return { parsed: null, matchType: 'none', noiseCount: 0 }

  // Tokenize with extended classifier
  const allTokens = tokenize(cleaned)

  // Extract date modifiers
  let dateModifier: ParsedQuery['dateModifier'] = null
  const afterDateMod = allTokens.filter((t) => {
    if (t.type === 'DATE_MODIFIER') {
      dateModifier = DATE_MODIFIERS[t.value.toLowerCase()] ?? null
      return false
    }
    return true
  })

  // Separate noise from signal
  const noiseTokens = afterDateMod.filter((t) => t.type === 'NOISE')
  const signalTokens = afterDateMod.filter((t) => t.type !== 'NOISE')
  const noiseCount = noiseTokens.length

  // Convert signal tokens to base Token type for cleanup/pattern matching
  const baseTokens = toBaseTokens(signalTokens)
  const merged = mergeLocationTokens(baseTokens)
  const cleanedTokens = stripLeadingConnectors(removeConnectorBeforeTime(merged))

  // Pass 1: exact pattern match on cleaned signal tokens
  const patternResult = tryPatternMatch(cleanedTokens)
  if (patternResult) {
    const matchType: MatchType = noiseCount === 0 ? 'exact' : 'exact-noisy'
    return {
      parsed: buildParsedQuery(patternResult, relativeMinutes, dateModifier),
      matchType,
      noiseCount,
    }
  }

  // Pass 2: greedy extraction from unmerged signal tokens
  const greedyResult = greedyExtract(signalTokens)
  if (greedyResult) {
    return {
      parsed: buildParsedQuery(greedyResult, relativeMinutes, dateModifier),
      matchType: 'greedy',
      noiseCount,
    }
  }

  // Pass 3: if signal has no locations, promote noise tokens to locations
  if (noiseTokens.length > 0 && signalTokens.every((t) => t.type !== 'LOCATION')) {
    const promoted = afterDateMod.map((t): ExtendedToken =>
      t.type === 'NOISE' ? { ...t, type: 'LOCATION' } : t
    )
    const promotedSignal = promoted.filter((t) => t.type !== 'NOISE')
    const promotedBase = toBaseTokens(promotedSignal)
    const promotedMerged = mergeLocationTokens(promotedBase)
    const promotedCleaned = stripLeadingConnectors(removeConnectorBeforeTime(promotedMerged))
    const promotedPattern = tryPatternMatch(promotedCleaned)
    if (promotedPattern) {
      return {
        parsed: buildParsedQuery(promotedPattern, relativeMinutes, dateModifier),
        matchType: 'promoted',
        noiseCount,
      }
    }
  }

  return { parsed: null, matchType: 'none', noiseCount }
}

function buildParsedQuery(
  extracted: { sourceLocation: string | null; targetLocation: string; time: TimeValueInternal | null },
  relativeMinutes: number | null,
  dateModifier: ParsedQuery['dateModifier'],
): ParsedQuery {
  let timeRef: TimeRef
  if (relativeMinutes !== null) {
    timeRef = { type: 'relative', minutes: relativeMinutes }
  } else if (extracted.time !== null) {
    timeRef = { type: 'absolute', hour: extracted.time.hour, minute: extracted.time.minute }
  } else {
    timeRef = { type: 'now' }
  }

  return {
    sourceLocation: extracted.sourceLocation,
    targetLocation: extracted.targetLocation,
    time: timeRef,
    dateModifier,
  }
}

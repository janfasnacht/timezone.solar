import type { Token, TokenType, TimeRef, ParsedQuery } from './types'
import { CONNECTORS, NAMED_TIMES, DATE_MODIFIERS } from './constants'

const TIME_REGEX = /^(\d{1,2})([:.](\d{2}))?\s*(am|pm)?$/i
const TIME_24H_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/

interface TimeValueInternal {
  hour: number
  minute: number
}

export function parseTimeToken(value: string): TimeValueInternal | null {
  const lower = value.toLowerCase()

  // Named times
  if (NAMED_TIMES[lower]) {
    return NAMED_TIMES[lower]
  }

  // 24h format: 18:00, 09:30
  const match24 = value.match(TIME_24H_REGEX)
  if (match24) {
    return { hour: parseInt(match24[1]), minute: parseInt(match24[2]) }
  }

  // 12h format: 6pm, 3:30pm, 6am
  const match12 = value.match(TIME_REGEX)
  if (match12) {
    let hour = parseInt(match12[1])
    const minute = match12[3] ? parseInt(match12[3]) : 0
    const period = match12[4]?.toLowerCase()

    if (period === 'pm' && hour !== 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute }
    }
  }

  return null
}

function classifyToken(raw: string): TokenType {
  const lower = raw.toLowerCase()
  if (CONNECTORS.has(lower)) return 'CONNECTOR'
  if (NAMED_TIMES[lower]) return 'TIME'
  if (parseTimeToken(raw) !== null) return 'TIME'
  if (DATE_MODIFIERS[lower]) return 'DATE_MODIFIER'
  return 'LOCATION'
}

function tokenize(input: string): Token[] {
  const parts = input.trim().split(/\s+/)
  const tokens: Token[] = []

  for (const part of parts) {
    if (!part) continue
    const type = classifyToken(part)
    tokens.push({ type, value: part, raw: part })
  }

  return tokens
}

export function mergeLocationTokens(tokens: Token[]): Token[] {
  const merged: Token[] = []

  for (const token of tokens) {
    if (
      token.type === 'LOCATION' &&
      merged.length > 0 &&
      merged[merged.length - 1].type === 'LOCATION'
    ) {
      const prev = merged[merged.length - 1]
      prev.value = `${prev.value} ${token.value}`
      prev.raw = `${prev.raw} ${token.raw}`
    } else {
      merged.push({ ...token })
    }
  }

  return merged
}

// --- Pre-processing: extract relative time and strip noise from raw input ---

interface PreprocessResult {
  cleaned: string
  relativeMinutes: number | null
}

export function extractRelativeTime(input: string): PreprocessResult {
  // Compound: "in 1h30m", "in 2h 15m", "in 1h30"
  const compoundMatch = input.match(/\bin\s+(\d+)\s*h\s*(\d+)\s*m?\b/i)
  if (compoundMatch) {
    const mins = parseInt(compoundMatch[1]) * 60 + parseInt(compoundMatch[2])
    return { cleaned: input.replace(compoundMatch[0], ' ').trim(), relativeMinutes: mins }
  }

  // "in half an hour" / "in a half hour"
  const halfHourMatch = input.match(/\bin\s+(?:half\s+an?|a\s+half)\s+hour\b/i)
  if (halfHourMatch) {
    return { cleaned: input.replace(halfHourMatch[0], ' ').trim(), relativeMinutes: 30 }
  }

  // "in an hour"
  const anHourMatch = input.match(/\bin\s+an?\s+hour\b/i)
  if (anHourMatch) {
    return { cleaned: input.replace(anHourMatch[0], ' ').trim(), relativeMinutes: 60 }
  }

  // "in N hours/hrs/h"
  const hoursMatch = input.match(/\bin\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i)
  if (hoursMatch) {
    const mins = Math.round(parseFloat(hoursMatch[1]) * 60)
    return { cleaned: input.replace(hoursMatch[0], ' ').trim(), relativeMinutes: mins }
  }

  // "in N minutes/mins/min/m"
  const minsMatch = input.match(/\bin\s+(\d+)\s*(minutes?|mins?|min|m)\b/i)
  if (minsMatch) {
    return { cleaned: input.replace(minsMatch[0], ' ').trim(), relativeMinutes: parseInt(minsMatch[1]) }
  }

  return { cleaned: input, relativeMinutes: null }
}

export function preprocess(input: string): PreprocessResult {
  let cleaned = input

  // Strip trailing question mark
  cleaned = cleaned.replace(/\?+$/, '').trim()

  // Extract relative time expressions (before tokenization so "in" isn't eaten as connector)
  const { cleaned: afterRelative, relativeMinutes } = extractRelativeTime(cleaned)
  cleaned = afterRelative

  // Strip standalone "now" (no-op — equivalent to no time specified)
  cleaned = cleaned.replace(/\bnow\b/gi, ' ').replace(/\s+/g, ' ').trim()

  return { cleaned, relativeMinutes }
}

// --- Post-tokenize cleanup ---

/** Remove CONNECTOR tokens immediately before TIME tokens (handles "at 6pm", "Boston to LA at 6pm") */
export function removeConnectorBeforeTime(tokens: Token[]): Token[] {
  const result: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (
      tokens[i].type === 'CONNECTOR' &&
      i + 1 < tokens.length &&
      tokens[i + 1].type === 'TIME'
    ) {
      // Skip this connector — "at 6pm" becomes just "6pm"
      continue
    }
    result.push(tokens[i])
  }
  return result
}

/** Strip leading CONNECTOR tokens (handles "from Boston to LA", "in Tokyo" after relative time extraction) */
export function stripLeadingConnectors(tokens: Token[]): Token[] {
  let start = 0
  while (start < tokens.length && tokens[start].type === 'CONNECTOR') {
    start++
  }
  return start > 0 ? tokens.slice(start) : tokens
}

// --- Main parse function ---

export function parse(input: string): ParsedQuery | null {
  const raw = input.trim()
  if (!raw) return null

  // Pre-process raw input
  const { cleaned, relativeMinutes } = preprocess(raw)
  if (!cleaned) return null

  // Tokenize → merge locations → extract date modifiers → clean up connectors
  const rawTokens = mergeLocationTokens(tokenize(cleaned))

  // Extract date modifier tokens
  let dateModifier: ParsedQuery['dateModifier'] = null
  const afterDateMod = rawTokens.filter((t) => {
    if (t.type === 'DATE_MODIFIER') {
      dateModifier = DATE_MODIFIERS[t.value.toLowerCase()] ?? null
      return false
    }
    return true
  })

  // Post-tokenize cleanup
  const tokens = stripLeadingConnectors(removeConnectorBeforeTime(afterDateMod))

  const types = tokens.map((t) => t.type).join(' ')

  let sourceLocation: string | null = null
  let targetLocation = ''
  let time: TimeValueInternal | null = null

  // === Two-location patterns (existing 8) ===

  // Pattern 1: LOC TIME CONN LOC — "Boston 6pm in California"
  if (types === 'LOCATION TIME CONNECTOR LOCATION') {
    sourceLocation = tokens[0].value
    time = parseTimeToken(tokens[1].value)
    targetLocation = tokens[3].value
  }
  // Pattern 2: TIME LOC CONN LOC — "6pm Boston to California"
  else if (types === 'TIME LOCATION CONNECTOR LOCATION') {
    time = parseTimeToken(tokens[0].value)
    sourceLocation = tokens[1].value
    targetLocation = tokens[3].value
  }
  // Pattern 3: LOC CONN LOC TIME — "Boston to California 6pm"
  else if (types === 'LOCATION CONNECTOR LOCATION TIME') {
    sourceLocation = tokens[0].value
    targetLocation = tokens[2].value
    time = parseTimeToken(tokens[3].value)
  }
  // Pattern 4: LOC TIME LOC — "Boston 6pm California" (no connector)
  else if (types === 'LOCATION TIME LOCATION') {
    sourceLocation = tokens[0].value
    time = parseTimeToken(tokens[1].value)
    targetLocation = tokens[2].value
  }
  // Pattern 5: LOC CONN LOC — "Boston to California" (no time)
  else if (types === 'LOCATION CONNECTOR LOCATION') {
    sourceLocation = tokens[0].value
    targetLocation = tokens[2].value
  }
  // Pattern 6: TIME LOC LOC — "6pm Boston California"
  else if (types === 'TIME LOCATION LOCATION') {
    time = parseTimeToken(tokens[0].value)
    sourceLocation = tokens[1].value
    targetLocation = tokens[2].value
  }
  // Pattern 7: LOC LOC TIME — "Boston California 6pm"
  else if (types === 'LOCATION LOCATION TIME') {
    sourceLocation = tokens[0].value
    targetLocation = tokens[1].value
    time = parseTimeToken(tokens[2].value)
  }
  // Pattern 8: LOC LOC — "Boston California" (no time, no connector)
  else if (types === 'LOCATION LOCATION') {
    sourceLocation = tokens[0].value
    targetLocation = tokens[1].value
  }

  // === Two-location with double connector ===

  // Pattern 9: TIME CONN LOC CONN LOC — "6pm in Boston to LA"
  else if (types === 'TIME CONNECTOR LOCATION CONNECTOR LOCATION') {
    time = parseTimeToken(tokens[0].value)
    sourceLocation = tokens[2].value
    targetLocation = tokens[4].value
  }

  // === Single-location / implicit source patterns ===

  // Pattern 10: TIME CONN LOC — "6pm in California" (implicit local source)
  else if (types === 'TIME CONNECTOR LOCATION') {
    time = parseTimeToken(tokens[0].value)
    sourceLocation = null
    targetLocation = tokens[2].value
  }
  // Pattern 11: LOCATION TIME — "London 5pm" (implicit local source)
  else if (types === 'LOCATION TIME') {
    time = parseTimeToken(tokens[1].value)
    sourceLocation = null
    targetLocation = tokens[0].value
  }
  // Pattern 12: TIME LOCATION — "5pm London" (implicit local source)
  else if (types === 'TIME LOCATION') {
    time = parseTimeToken(tokens[0].value)
    sourceLocation = null
    targetLocation = tokens[1].value
  }
  // Pattern 13: LOCATION — "Tokyo" (bare location, no time)
  else if (types === 'LOCATION') {
    sourceLocation = null
    targetLocation = tokens[0].value
  }
  else {
    return null
  }

  // Build TimeRef from extracted values
  let timeRef: TimeRef
  if (relativeMinutes !== null) {
    timeRef = { type: 'relative', minutes: relativeMinutes }
  } else if (time !== null) {
    timeRef = { type: 'absolute', hour: time.hour, minute: time.minute }
  } else {
    timeRef = { type: 'now' }
  }

  return { sourceLocation, targetLocation, time: timeRef, dateModifier }
}

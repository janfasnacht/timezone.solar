import type { Token } from './types'
import { NAMED_TIMES } from './constants'

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

// Day-of-week names — full names always stripped, short names stripped standalone
// "sun" only stripped when preceded by a day prefix to avoid colliding with location "Sun City"
const FULL_DAYS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi
const SHORT_DAYS_NO_SUN = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi
// Prefixes only stripped when followed by a day name (full or short including sun)
const PREFIX_DAY = /\b(next|this|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/gi

export function stripDayOfWeek(input: string): string {
  let cleaned = input
  // First strip "prefix + day" combos (including "next sun", "this sun", "last sun")
  cleaned = cleaned.replace(PREFIX_DAY, ' ')
  // Then strip remaining full day names
  cleaned = cleaned.replace(FULL_DAYS, ' ')
  // Then strip remaining short day names (except "sun")
  cleaned = cleaned.replace(SHORT_DAYS_NO_SUN, ' ')
  return cleaned.replace(/\s+/g, ' ').trim()
}

export function preprocess(input: string): PreprocessResult {
  let cleaned = input

  // Strip trailing question mark
  cleaned = cleaned.replace(/\?+$/, '').trim()

  // Extract relative time expressions (before tokenization so "in" isn't eaten as connector)
  const { cleaned: afterRelative, relativeMinutes } = extractRelativeTime(cleaned)
  cleaned = afterRelative

  // Strip day-of-week tokens (before tokenization so they don't become locations)
  cleaned = stripDayOfWeek(cleaned)

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

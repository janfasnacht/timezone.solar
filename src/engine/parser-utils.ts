import type { Token, DayOfWeek, DayOfWeekModifier, AbsoluteDate } from './types'
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

interface RelativeTimeResult {
  cleaned: string
  relativeMinutes: number | null
}

interface PreprocessResult {
  cleaned: string
  relativeMinutes: number | null
  dayOfWeek: DayOfWeekModifier | null
  absoluteDate: AbsoluteDate | null
}

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
}

const MONTH_PATTERN = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|')

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/
/**
 * Slash-separated only. `.` is a legitimate European date separator but also how
 * plenty of people write "3.30pm", and a wrong date is worse than an unparsed
 * one. ISO with dashes is handled above.
 */
const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/

let dayFirstOverride: boolean | null = null

/** Test seam — pass null to go back to reading the environment. */
export function setDayFirstForTests(value: boolean | null): void {
  dayFirstOverride = value
}

/**
 * Does this user write 14/03 or 3/14? Ask their locale rather than guess: the
 * person typing is the one whose convention matters, and the link they share is
 * canonicalised to an unambiguous form anyway.
 */
export function resolvesDayFirst(): boolean {
  if (dayFirstOverride !== null) return dayFirstOverride
  try {
    const parts = new Intl.DateTimeFormat().formatToParts(new Date(2000, 0, 2))
    const day = parts.findIndex((p) => p.type === 'day')
    const month = parts.findIndex((p) => p.type === 'month')
    if (day === -1 || month === -1) return true
    return day < month
  } catch {
    return true
  }
}

function expandYear(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw)
  return raw.length === 2 ? 2000 + n : n
}
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\b(?:,?\\s*(\\d{4}))?`, 'i')
const MONTH_DAY = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, 'i')

function validDate(year: number | null, month: number, day: number): AbsoluteDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { type: 'date', year, month, day }
}

/**
 * Pull a named calendar date out of the query before tokenizing, so month names
 * never reach the location resolver. Month names collide with nothing in the
 * entity registry — verified against every city, slug and IATA code — so a bare
 * month word is safe to claim here.
 *
 * Numeric-only dates are deliberately not accepted beyond ISO: `3/14` means
 * different days either side of the Atlantic, and this app's whole point is not
 * guessing about that.
 */
export function extractAbsoluteDate(input: string): { cleaned: string; absoluteDate: AbsoluteDate | null } {
  const iso = input.match(ISO_DATE)
  if (iso) {
    const date = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    if (date) return { cleaned: input.replace(ISO_DATE, ' ').replace(/\s+/g, ' ').trim(), absoluteDate: date }
  }

  // Numeric: unambiguous when one number can only be a day; otherwise the
  // user's own locale decides.
  const numeric = input.match(NUMERIC_DATE)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    const year = expandYear(numeric[3])
    let month: number
    let dayNum: number
    if (a > 12 && b <= 12) {
      dayNum = a
      month = b
    } else if (b > 12 && a <= 12) {
      month = a
      dayNum = b
    } else if (resolvesDayFirst()) {
      dayNum = a
      month = b
    } else {
      month = a
      dayNum = b
    }
    const date = validDate(year, month, dayNum)
    if (date) return { cleaned: input.replace(NUMERIC_DATE, ' ').replace(/\s+/g, ' ').trim(), absoluteDate: date }
  }

  const dayFirst = input.match(DAY_MONTH)
  if (dayFirst) {
    const date = validDate(
      dayFirst[3] ? Number(dayFirst[3]) : null,
      MONTH_NAMES[dayFirst[2].toLowerCase()],
      Number(dayFirst[1]),
    )
    if (date) return { cleaned: input.replace(DAY_MONTH, ' ').replace(/\s+/g, ' ').trim(), absoluteDate: date }
  }

  const monthFirst = input.match(MONTH_DAY)
  if (monthFirst) {
    const date = validDate(
      monthFirst[3] ? Number(monthFirst[3]) : null,
      MONTH_NAMES[monthFirst[1].toLowerCase()],
      Number(monthFirst[2]),
    )
    if (date) return { cleaned: input.replace(MONTH_DAY, ' ').replace(/\s+/g, ' ').trim(), absoluteDate: date }
  }

  return { cleaned: input, absoluteDate: null }
}

export function extractRelativeTime(input: string): RelativeTimeResult {
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

const DAY_NAME_MAP: Record<string, DayOfWeek> = {
  monday: 'monday', mon: 'monday',
  tuesday: 'tuesday', tue: 'tuesday', tues: 'tuesday',
  wednesday: 'wednesday', wed: 'wednesday',
  thursday: 'thursday', thu: 'thursday', thur: 'thursday', thurs: 'thursday',
  friday: 'friday', fri: 'friday',
  saturday: 'saturday', sat: 'saturday',
  sunday: 'sunday', sun: 'sunday',
}

export function extractDayOfWeek(input: string): { cleaned: string; dayOfWeek: DayOfWeekModifier | null } {
  let cleaned = input
  let dayOfWeek: DayOfWeekModifier | null = null

  // First try "prefix + day" combos (including "next sun", "this sun", "last sun")
  const prefixMatch = cleaned.match(PREFIX_DAY)
  if (prefixMatch) {
    const parts = prefixMatch[0].trim().toLowerCase().split(/\s+/)
    const anchor = parts[0] as 'next' | 'this' | 'last'
    const day = DAY_NAME_MAP[parts[1]]
    if (day) {
      dayOfWeek = { type: 'day-of-week', day, anchor }
    }
    cleaned = cleaned.replace(PREFIX_DAY, ' ')
  }

  // Then strip remaining full day names (extract if not already captured)
  if (!dayOfWeek) {
    const fullMatch = cleaned.match(FULL_DAYS)
    if (fullMatch) {
      const day = DAY_NAME_MAP[fullMatch[0].toLowerCase()]
      if (day) {
        dayOfWeek = { type: 'day-of-week', day, anchor: 'bare' }
      }
    }
  }
  cleaned = cleaned.replace(FULL_DAYS, ' ')

  // Then strip remaining short day names (except "sun"), extract if not already captured
  if (!dayOfWeek) {
    const shortMatch = cleaned.match(SHORT_DAYS_NO_SUN)
    if (shortMatch) {
      const day = DAY_NAME_MAP[shortMatch[0].toLowerCase()]
      if (day) {
        dayOfWeek = { type: 'day-of-week', day, anchor: 'bare' }
      }
    }
  }
  cleaned = cleaned.replace(SHORT_DAYS_NO_SUN, ' ')

  return { cleaned: cleaned.replace(/\s+/g, ' ').trim(), dayOfWeek }
}

/**
 * "5 pm" and "5 p.m." mean the same as "5pm". Without this the tokenizer reads
 * the number alone and drops the meridiem, silently answering 5am — wrong by
 * twelve hours, with nothing on screen to suggest it.
 */
export function normalizeMeridiem(input: string): string {
  return input.replace(/(\d)\s+([ap])\.?\s?m\.?(?![a-z])/gi, (_m, digit: string, ap: string) =>
    `${digit}${ap.toLowerCase()}m`,
  )
}

export function preprocess(input: string): PreprocessResult {
  let cleaned = input

  // Strip trailing question mark
  cleaned = cleaned.replace(/\?+$/, '').trim()

  // Join a number to a detached meridiem before anything tries to tokenize it
  cleaned = normalizeMeridiem(cleaned)

  // Extract relative time expressions (before tokenization so "in" isn't eaten as connector)
  const { cleaned: afterRelative, relativeMinutes } = extractRelativeTime(cleaned)
  cleaned = afterRelative

  // Extract a named date (before tokenization so month names don't become locations)
  const { cleaned: afterDate, absoluteDate } = extractAbsoluteDate(cleaned)
  cleaned = afterDate

  // Extract day-of-week tokens (before tokenization so they don't become locations)
  const { cleaned: afterDayOfWeek, dayOfWeek } = extractDayOfWeek(cleaned)
  cleaned = afterDayOfWeek

  // Strip standalone "now" (no-op — equivalent to no time specified)
  cleaned = cleaned.replace(/\bnow\b/gi, ' ').replace(/\s+/g, ' ').trim()

  return { cleaned, relativeMinutes, dayOfWeek, absoluteDate }
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

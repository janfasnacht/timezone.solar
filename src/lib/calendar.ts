import { DateTime } from 'luxon'
import type { ConversionResult } from '@/engine/types'

/** Default block length for an exported event, in minutes. */
const DEFAULT_DURATION = 60

function utcStamp(iso: string, addMinutes = 0): string | null {
  const dt = DateTime.fromISO(iso).toUTC().plus({ minutes: addMinutes })
  return dt.isValid ? dt.toFormat("yyyyLLdd'T'HHmmss'Z'") : null
}

export function calendarWindow(result: ConversionResult, durationMinutes = DEFAULT_DURATION) {
  const start = utcStamp(result.targetDateTime)
  const end = utcStamp(result.targetDateTime, durationMinutes)
  return start && end ? { start, end } : null
}

export function calendarTitle(result: ConversionResult): string {
  return `${result.source.city} → ${result.target.city}`
}

export function calendarDescription(result: ConversionResult, use24h: boolean, url: string): string {
  const key = use24h ? 'formattedTime24' : 'formattedTime12'
  const { source, target } = result
  return `${source.city} ${source[key]} ${source.abbreviation} = ${target.city} ${target[key]} ${target.abbreviation}\n\n${url}`
}

/** RFC 5545 escaping: backslash, semicolon, comma, and newline. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function buildIcs(
  result: ConversionResult,
  use24h: boolean,
  url: string,
  durationMinutes = DEFAULT_DURATION,
): string | null {
  const window = calendarWindow(result, durationMinutes)
  if (!window) return null
  const stamp = DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'")
  const uid = `${window.start}-${result.source.iana}-${result.target.iana}@timezone.solar`

  // CRLF line endings are required by the spec, and several clients enforce it.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//timezone.solar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${window.start}`,
    `DTEND:${window.end}`,
    `SUMMARY:${escapeIcsText(calendarTitle(result))}`,
    `DESCRIPTION:${escapeIcsText(calendarDescription(result, use24h, url))}`,
    `URL:${escapeIcsText(url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function buildGoogleCalendarUrl(
  result: ConversionResult,
  use24h: boolean,
  url: string,
  durationMinutes = DEFAULT_DURATION,
): string | null {
  const window = calendarWindow(result, durationMinutes)
  if (!window) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: calendarTitle(result),
    dates: `${window.start}/${window.end}`,
    details: calendarDescription(result, use24h, url),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

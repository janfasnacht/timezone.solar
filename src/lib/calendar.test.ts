import { describe, it, expect } from 'vitest'
import { buildIcs, buildGoogleCalendarUrl, calendarWindow, calendarTitle } from '@/lib/calendar'
import type { ConversionResult } from '@/engine/types'

const result = {
  source: {
    city: 'New York',
    country: 'USA',
    iana: 'America/New_York',
    abbreviation: 'EDT',
    offsetFromUTC: '-04:00',
    formattedTime12: '3:00 PM',
    formattedTime24: '15:00',
  },
  target: {
    city: 'London',
    country: 'United Kingdom',
    iana: 'Europe/London',
    abbreviation: 'BST',
    offsetFromUTC: '+01:00',
    formattedTime12: '8:00 PM',
    formattedTime24: '20:00',
  },
  sourceDateTime: '2026-08-31T15:00:00.000-04:00',
  targetDateTime: '2026-08-31T20:00:00.000+01:00',
  offsetDifference: '+5h',
  dayBoundary: 'same day',
} as unknown as ConversionResult

const URL_ = 'https://timezone.solar/?from=America%2FNew_York&to=Europe%2FLondon'

describe('calendarWindow', () => {
  it('anchors to the target time in UTC and runs an hour by default', () => {
    expect(calendarWindow(result)).toEqual({
      start: '20260831T190000Z',
      end: '20260831T200000Z',
    })
  })

  it('honours a custom duration', () => {
    expect(calendarWindow(result, 30)?.end).toBe('20260831T193000Z')
  })

  it('returns null for an unparseable instant', () => {
    expect(calendarWindow({ ...result, targetDateTime: 'nonsense' })).toBeNull()
  })
})

describe('buildIcs', () => {
  const ics = buildIcs(result, false, URL_) ?? ''

  it('uses CRLF line endings as the spec requires', () => {
    expect(ics.includes('\r\n')).toBe(true)
    expect(/[^\r]\n/.test(ics)).toBe(false)
  })

  it('wraps a single VEVENT in a VCALENDAR', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })

  it('carries the converted window', () => {
    expect(ics).toContain('DTSTART:20260831T190000Z')
    expect(ics).toContain('DTEND:20260831T200000Z')
  })

  it('escapes commas and newlines in the description', () => {
    // The description joins both sides with a blank line and no bare commas.
    expect(ics).toContain('\\n\\n')
    expect(ics).not.toMatch(/DESCRIPTION:[^\r]*[^\\],/)
  })

  it('names the event after both cities', () => {
    expect(calendarTitle(result)).toBe('New York → London')
    expect(ics).toContain('SUMMARY:New York → London')
  })
})

describe('buildGoogleCalendarUrl', () => {
  it('builds a TEMPLATE link with the same window', () => {
    const url = new URL(buildGoogleCalendarUrl(result, false, URL_) ?? '')
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20260831T190000Z/20260831T200000Z')
    expect(url.searchParams.get('text')).toBe('New York → London')
  })

  it('returns null when the instant will not parse', () => {
    expect(buildGoogleCalendarUrl({ ...result, targetDateTime: '' }, false, URL_)).toBeNull()
  })
})

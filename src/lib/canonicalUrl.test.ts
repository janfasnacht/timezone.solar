import { describe, it, expect } from 'vitest'
import {
  buildCanonicalParams,
  parseCanonicalParams,
  buildCanonicalUrl,
  formatCanonicalDisplay,
  serializeDateModifier,
  parseDateModifier,
} from './canonicalUrl'
import type { ConversionResult } from '@/engine/types'

function makeResult(overrides: Partial<ConversionResult> = {}): ConversionResult {
  return {
    intent: {
      source: { iana: 'America/New_York', displayName: 'New York', kind: 'city', resolveMethod: 'city-db' },
      target: { iana: 'Europe/London', displayName: 'London', kind: 'city', resolveMethod: 'city-db' },
      time: { type: 'absolute', hour: 15, minute: 0 },
      dateModifier: null,
    },
    source: {
      formattedTime12: '3:00 PM', formattedTime24: '15:00', abbreviation: 'EST',
      iana: 'America/New_York', city: 'New York', country: 'US', isDST: false, offsetFromUTC: '-05:00',
    },
    target: {
      formattedTime12: '8:00 PM', formattedTime24: '20:00', abbreviation: 'GMT',
      iana: 'Europe/London', city: 'London', country: 'GB', isDST: false, offsetFromUTC: '+00:00',
    },
    offsetDifference: '+5h',
    dayBoundary: 'same day',
    dstNote: null,
    relativeTime: null,
    sourceDateTime: '2026-03-10T15:00:00.000-05:00',
    targetDateTime: '2026-03-10T20:00:00.000+00:00',
    anchoredToTomorrow: false,
    anchorNote: null,
    ...overrides,
  }
}

describe('serializeDateModifier', () => {
  it('returns null for null', () => {
    expect(serializeDateModifier(null)).toBeNull()
  })

  it('serializes string modifiers directly', () => {
    expect(serializeDateModifier('tomorrow')).toBe('tomorrow')
    expect(serializeDateModifier('yesterday')).toBe('yesterday')
    expect(serializeDateModifier('today')).toBe('today')
  })

  it('serializes day-of-week with anchor', () => {
    expect(serializeDateModifier({ type: 'day-of-week', anchor: 'next', day: 'monday' })).toBe('next-monday')
    expect(serializeDateModifier({ type: 'day-of-week', anchor: 'last', day: 'friday' })).toBe('last-friday')
  })

  it('serializes bare day-of-week as just the day', () => {
    expect(serializeDateModifier({ type: 'day-of-week', anchor: 'bare', day: 'wednesday' })).toBe('wednesday')
  })
})

describe('parseDateModifier', () => {
  it('parses string modifiers', () => {
    expect(parseDateModifier('tomorrow')).toBe('tomorrow')
    expect(parseDateModifier('yesterday')).toBe('yesterday')
    expect(parseDateModifier('today')).toBe('today')
  })

  it('parses anchor-day format', () => {
    expect(parseDateModifier('next-monday')).toEqual({ type: 'day-of-week', anchor: 'next', day: 'monday' })
    expect(parseDateModifier('last-friday')).toEqual({ type: 'day-of-week', anchor: 'last', day: 'friday' })
    expect(parseDateModifier('this-sunday')).toEqual({ type: 'day-of-week', anchor: 'this', day: 'sunday' })
  })

  it('parses bare day name as bare anchor', () => {
    expect(parseDateModifier('monday')).toEqual({ type: 'day-of-week', anchor: 'bare', day: 'monday' })
  })

  it('returns null for invalid strings', () => {
    expect(parseDateModifier('invalid')).toBeNull()
    expect(parseDateModifier('next-invalid')).toBeNull()
  })
})

describe('buildCanonicalParams', () => {
  it('returns params for absolute time', () => {
    const result = makeResult()
    const params = buildCanonicalParams(result)
    expect(params).not.toBeNull()
    expect(params!.get('from')).toBe('America/New_York')
    expect(params!.get('to')).toBe('Europe/London')
    expect(params!.get('t')).toBe('15:00')
    expect(params!.has('d')).toBe(false)
  })

  it('includes date modifier when present', () => {
    const result = makeResult({
      intent: {
        ...makeResult().intent,
        dateModifier: 'tomorrow',
      },
    })
    const params = buildCanonicalParams(result)
    expect(params!.get('d')).toBe('tomorrow')
  })

  it('returns params without t for now time', () => {
    const result = makeResult({
      intent: { ...makeResult().intent, time: { type: 'now' } },
    })
    const params = buildCanonicalParams(result)
    expect(params).not.toBeNull()
    expect(params!.get('from')).toBe('America/New_York')
    expect(params!.get('to')).toBe('Europe/London')
    expect(params!.has('t')).toBe(false)
  })

  it('returns null for relative time', () => {
    const result = makeResult({
      intent: { ...makeResult().intent, time: { type: 'relative', minutes: 120 } },
    })
    expect(buildCanonicalParams(result)).toBeNull()
  })

  it('pads single-digit hours and handles midnight', () => {
    const result = makeResult({
      intent: { ...makeResult().intent, time: { type: 'absolute', hour: 0, minute: 5 } },
    })
    const params = buildCanonicalParams(result)
    expect(params!.get('t')).toBe('00:05')
  })
})

describe('parseCanonicalParams', () => {
  it('parses valid canonical params', () => {
    const params = new URLSearchParams('from=America/New_York&to=Europe/London&t=15:00')
    const result = parseCanonicalParams(params)
    expect(result).toEqual({
      fromIana: 'America/New_York',
      toIana: 'Europe/London',
      hour: 15,
      minute: 0,
      dateModifier: null,
    })
  })

  it('parses with date modifier', () => {
    const params = new URLSearchParams('from=America/New_York&to=Europe/London&t=15:00&d=tomorrow')
    const result = parseCanonicalParams(params)
    expect(result!.dateModifier).toBe('tomorrow')
  })

  it('parses without t param as now time', () => {
    const params = new URLSearchParams('from=America/New_York&to=Europe/London')
    const result = parseCanonicalParams(params)
    expect(result).toEqual({
      fromIana: 'America/New_York',
      toIana: 'Europe/London',
      hour: null,
      minute: null,
      dateModifier: null,
    })
  })

  it('returns null when from or to are missing', () => {
    expect(parseCanonicalParams(new URLSearchParams('from=A&t=15:00'))).toBeNull()
    expect(parseCanonicalParams(new URLSearchParams('to=B&t=15:00'))).toBeNull()
  })

  it('returns null for invalid time format', () => {
    expect(parseCanonicalParams(new URLSearchParams('from=A&to=B&t=3pm'))).toBeNull()
    expect(parseCanonicalParams(new URLSearchParams('from=A&to=B&t=25:00'))).toBeNull()
    expect(parseCanonicalParams(new URLSearchParams('from=A&to=B&t=12:60'))).toBeNull()
  })

  it('handles single-digit hour', () => {
    const params = new URLSearchParams('from=A&to=B&t=9:30')
    const result = parseCanonicalParams(params)
    expect(result!.hour).toBe(9)
    expect(result!.minute).toBe(30)
  })
})

describe('buildCanonicalUrl', () => {
  it('builds canonical URL for absolute time', () => {
    const result = makeResult()
    const url = buildCanonicalUrl(result, '3pm nyc to london')
    expect(url).toContain('from=America%2FNew_York')
    expect(url).toContain('to=Europe%2FLondon')
    expect(url).toContain('t=15%3A00')
    expect(url).not.toContain('q=')
  })

  it('builds canonical URL without t for now time', () => {
    const result = makeResult({
      intent: { ...makeResult().intent, time: { type: 'now' } },
    })
    const url = buildCanonicalUrl(result, 'london')
    expect(url).toContain('from=America%2FNew_York')
    expect(url).toContain('to=Europe%2FLondon')
    expect(url).not.toContain('t=')
    expect(url).not.toContain('q=')
  })

  it('preserves view=map', () => {
    const result = makeResult()
    const url = buildCanonicalUrl(result, '', 'map')
    expect(url).toContain('view=map')
  })
})

describe('formatCanonicalDisplay', () => {
  it('returns canonical display for absolute time', () => {
    const result = makeResult()
    const display = formatCanonicalDisplay(result, '3pm nyc to london')
    expect(display).toContain('timezone.solar?')
    expect(display).toContain('from=America')
    expect(display).toContain('to=Europe')
    expect(display).toContain('t=15')
  })

  it('returns canonical display for now time', () => {
    const result = makeResult({
      intent: { ...makeResult().intent, time: { type: 'now' } },
    })
    const display = formatCanonicalDisplay(result, 'london')
    expect(display).toContain('timezone.solar?')
    expect(display).toContain('from=America')
    expect(display).toContain('to=Europe')
    expect(display).not.toContain('q=')
  })
})

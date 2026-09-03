import { describe, it, expect } from 'vitest'
import { compactTime, formatDate, conversionText } from '@/lib/shareUtils'
import type { ConversionResult } from '@/engine/types'

describe('compactTime', () => {
  describe('12h format', () => {
    it('drops :00 and lowercases PM', () => {
      expect(compactTime('3:00 PM', false)).toBe('3pm')
    })

    it('drops :00 and lowercases AM', () => {
      expect(compactTime('11:00 AM', false)).toBe('11am')
    })

    it('replaces : with . for non-zero minutes', () => {
      expect(compactTime('11:30 AM', false)).toBe('11.30am')
    })

    it('handles 12:00 PM (noon)', () => {
      expect(compactTime('12:00 PM', false)).toBe('12pm')
    })

    it('handles 12:00 AM (midnight)', () => {
      expect(compactTime('12:00 AM', false)).toBe('12am')
    })

    it('handles minutes with PM', () => {
      expect(compactTime('1:45 PM', false)).toBe('1.45pm')
    })
  })

  describe('24h format', () => {
    it('replaces : with .', () => {
      expect(compactTime('15:00', true)).toBe('15.00')
    })

    it('handles morning time with leading zero', () => {
      expect(compactTime('09:30', true)).toBe('09.30')
    })

    it('handles midnight', () => {
      expect(compactTime('00:00', true)).toBe('00.00')
    })

    it('handles noon', () => {
      expect(compactTime('12:00', true)).toBe('12.00')
    })
  })
})

describe('formatDate', () => {
  it('formats valid ISO date', () => {
    const result = formatDate('2026-02-12T15:00:00.000-05:00')
    expect(result).toMatch(/^Feb1[12]$/) // timezone may shift the day
  })

  it('formats single-digit day', () => {
    const result = formatDate('2026-03-01T12:00:00.000Z')
    expect(result).toBe('Mar1')
  })

  it('returns empty string for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('')
  })
})

describe('conversionText', () => {
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

  it('carries both places, in the order they were asked about', () => {
    expect(conversionText(result, false)).toBe('3:00 PM New York → 8:00 PM London')
  })

  it('follows the clock format', () => {
    expect(conversionText(result, true)).toBe('15:00 New York → 20:00 London')
  })

  it('says nothing about the day when both are on it', () => {
    expect(conversionText(result, false)).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)
  })

  it('names the weekday once the two fall on different days', () => {
    const overnight = {
      ...result,
      target: { ...result.target, formattedTime12: '4:00 AM' },
      targetDateTime: '2026-09-01T04:00:00.000+01:00',
      dayBoundary: 'next day',
    } as unknown as ConversionResult
    expect(conversionText(overnight, false)).toBe('3:00 PM Mon New York → 4:00 AM Tue London')
  })
})

import { describe, it, expect } from 'vitest'
import { compactTime, formatDate } from '@/lib/shareUtils'

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

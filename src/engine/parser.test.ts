import { describe, it, expect } from 'vitest'
import { parse } from './parser'

describe('parser', () => {
  // --- Time parsing ---

  describe('time parsing', () => {
    it('parses 12h pm time', () => {
      const result = parse('NYC 3pm London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 15, minute: 0 })
    })

    it('parses 12h am time', () => {
      const result = parse('NYC 3am London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 3, minute: 0 })
    })

    it('parses 12h time with minutes', () => {
      const result = parse('NYC 3:30pm London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 15, minute: 30 })
    })

    it('parses 24h time', () => {
      const result = parse('NYC 18:00 London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('parses 24h time with leading zero', () => {
      const result = parse('NYC 09:30 London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 9, minute: 30 })
    })

    it('parses noon as named time', () => {
      const result = parse('NYC noon London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('parses midnight as named time', () => {
      const result = parse('NYC midnight London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 0, minute: 0 })
    })

    it('parses midday as named time', () => {
      const result = parse('NYC midday London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('handles 12pm edge case (noon)', () => {
      const result = parse('NYC 12pm London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('handles 12am edge case (midnight)', () => {
      const result = parse('NYC 12am London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 0, minute: 0 })
    })
  })

  // --- Two-location patterns ---

  describe('two-location patterns', () => {
    it('pattern 1: LOC TIME CONN LOC', () => {
      const result = parse('Boston 6pm in California')
      expect(result).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 2: TIME LOC CONN LOC', () => {
      const result = parse('6pm Boston to California')
      expect(result).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 3: LOC CONN LOC TIME', () => {
      const result = parse('Boston to California 6pm')
      expect(result).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 4: LOC TIME LOC (no connector)', () => {
      const result = parse('Boston 6pm California')
      expect(result).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 5: LOC CONN LOC (no time)', () => {
      const result = parse('Boston to California')
      expect(result).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'now' },
        dateModifier: null,
      })
    })

    it('pattern 6: TIME LOC LOC — adjacent locations merge', () => {
      // mergeLocationTokens merges adjacent LOCATION tokens,
      // so "Boston California" becomes one location → single-location pattern
      const result = parse('6pm Boston California')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('Boston California')
      expect(result?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('pattern 7: LOC LOC TIME — adjacent locations merge', () => {
      const result = parse('Boston California 6pm')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('Boston California')
      expect(result?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('pattern 8: LOC LOC — adjacent locations merge', () => {
      const result = parse('Boston California')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('Boston California')
      expect(result?.time).toEqual({ type: 'now' })
    })

    it('pattern 9: TIME CONN LOC CONN LOC (double connector)', () => {
      const result = parse('6pm in Boston to LA')
      expect(result).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'LA',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })
  })

  // --- Connector variations ---

  describe('connector variations', () => {
    it('supports "to" connector', () => {
      const result = parse('NYC to London')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })

    it('supports "in" connector', () => {
      const result = parse('NYC 6pm in London')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })

    it('supports "->" connector', () => {
      const result = parse('NYC -> London')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })

    it('supports "=>" connector', () => {
      const result = parse('NYC => London')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })

    it('supports "from" connector (stripped as leading)', () => {
      const result = parse('from NYC to London')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })
  })

  // --- Single-location / implicit source ---

  describe('single-location patterns', () => {
    it('pattern 10: TIME CONN LOC (implicit source)', () => {
      const result = parse('6pm in California')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('California')
      expect(result?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('pattern 11: LOC TIME (implicit source)', () => {
      const result = parse('London 5pm')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 17, minute: 0 })
    })

    it('pattern 12: TIME LOC (implicit source)', () => {
      const result = parse('5pm London')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 17, minute: 0 })
    })

    it('pattern 13: LOC (bare location)', () => {
      const result = parse('Tokyo')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('Tokyo')
      expect(result?.time).toEqual({ type: 'now' })
    })
  })

  // --- Multi-word cities ---

  describe('multi-word cities', () => {
    it('handles New York', () => {
      const result = parse('New York to London')
      expect(result?.sourceLocation).toBe('New York')
      expect(result?.targetLocation).toBe('London')
    })

    it('handles Los Angeles', () => {
      const result = parse('Los Angeles to London')
      expect(result?.sourceLocation).toBe('Los Angeles')
      expect(result?.targetLocation).toBe('London')
    })

    it('handles San Francisco', () => {
      const result = parse('San Francisco to London')
      expect(result?.sourceLocation).toBe('San Francisco')
      expect(result?.targetLocation).toBe('London')
    })

    it('handles Ho Chi Minh City', () => {
      const result = parse('Ho Chi Minh City')
      expect(result?.sourceLocation).toBeNull()
      expect(result?.targetLocation).toBe('Ho Chi Minh City')
    })
  })

  // --- Connector cleanup ---

  describe('connector cleanup', () => {
    it('removes "at" before time', () => {
      const result = parse('Boston to LA at 3:30pm')
      expect(result?.sourceLocation).toBe('Boston')
      expect(result?.targetLocation).toBe('LA')
      expect(result?.time).toEqual({ type: 'absolute', hour: 15, minute: 30 })
    })

    it('strips leading "from" connector', () => {
      const result = parse('from Boston to LA')
      expect(result?.sourceLocation).toBe('Boston')
      expect(result?.targetLocation).toBe('LA')
    })
  })

  // --- Relative time ---

  describe('relative time', () => {
    it('parses "in 2 hours"', () => {
      const result = parse('in 2 hours London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 120 })
      expect(result?.targetLocation).toBe('London')
    })

    it('parses "in 30 minutes"', () => {
      const result = parse('in 30 minutes London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 30 })
      expect(result?.targetLocation).toBe('London')
    })

    it('parses "in 30 mins"', () => {
      const result = parse('in 30 mins London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 30 })
    })

    it('parses compound "in 1h30m"', () => {
      const result = parse('in 1h30m London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 90 })
    })

    it('parses "in 2h 15m"', () => {
      const result = parse('in 2h 15m London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 135 })
    })

    it('parses "in half an hour"', () => {
      const result = parse('in half an hour London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 30 })
    })

    it('parses "in an hour"', () => {
      const result = parse('in an hour London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 60 })
    })

    it('parses decimal hours "in 1.5 hours"', () => {
      const result = parse('in 1.5 hours London')
      expect(result?.time).toEqual({ type: 'relative', minutes: 90 })
    })
  })

  // --- Date modifiers ---

  describe('date modifiers', () => {
    it('parses "tomorrow"', () => {
      const result = parse('NYC to London tomorrow')
      expect(result?.dateModifier).toBe('tomorrow')
    })

    it('parses "tmrw"', () => {
      const result = parse('NYC to London tmrw')
      expect(result?.dateModifier).toBe('tomorrow')
    })

    it('parses "tmw"', () => {
      const result = parse('NYC to London tmw')
      expect(result?.dateModifier).toBe('tomorrow')
    })

    it('parses "yesterday"', () => {
      const result = parse('NYC to London yesterday')
      expect(result?.dateModifier).toBe('yesterday')
    })

    it('parses "today"', () => {
      const result = parse('NYC to London today')
      expect(result?.dateModifier).toBe('today')
    })

    it('parses date modifier in any position', () => {
      const result = parse('tomorrow NYC to London')
      expect(result?.dateModifier).toBe('tomorrow')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })
  })

  // --- Pre-processing ---

  describe('pre-processing', () => {
    it('strips trailing question mark', () => {
      const result = parse('NYC to London?')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })

    it('strips standalone "now"', () => {
      const result = parse('now NYC to London')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
      expect(result?.time).toEqual({ type: 'now' })
    })

    it('handles "now" alone as a stripped no-op → null', () => {
      const result = parse('now')
      expect(result).toBeNull()
    })
  })

  // --- Edge cases / null ---

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parse('')).toBeNull()
    })

    it('returns null for whitespace only', () => {
      expect(parse('   ')).toBeNull()
    })

    it('returns null for connector only', () => {
      expect(parse('to')).toBeNull()
    })

    it('returns null for multiple connectors only', () => {
      expect(parse('to in from')).toBeNull()
    })

    it('returns null for time only (no location)', () => {
      expect(parse('6pm')).toBeNull()
    })

    it('returns null for unrecognized pattern', () => {
      // TIME TIME is not a valid pattern
      expect(parse('6pm 3am')).toBeNull()
    })

    it('no time produces now TimeRef', () => {
      const result = parse('Tokyo')
      expect(result?.time).toEqual({ type: 'now' })
    })
  })

  // --- Case insensitivity ---

  describe('case insensitivity', () => {
    it('handles uppercase location', () => {
      const result = parse('LONDON')
      expect(result?.targetLocation).toBe('LONDON')
    })

    it('handles mixed case time', () => {
      const result = parse('NYC 3PM London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 15, minute: 0 })
    })

    it('handles uppercase named time', () => {
      const result = parse('NYC NOON London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('handles uppercase date modifier', () => {
      const result = parse('NYC to London TOMORROW')
      expect(result?.dateModifier).toBe('tomorrow')
    })

    it('handles uppercase connector', () => {
      const result = parse('NYC TO London')
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })
  })

  // --- Connector-at-before-time ---

  describe('connector before time removal', () => {
    it('removes "at" before time in two-location pattern', () => {
      const result = parse('NYC to London at 3:30pm')
      expect(result?.time).toEqual({ type: 'absolute', hour: 15, minute: 30 })
      expect(result?.sourceLocation).toBe('NYC')
      expect(result?.targetLocation).toBe('London')
    })

    it('removes leading "at" before time in single-location', () => {
      const result = parse('at 6pm London')
      expect(result?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
      expect(result?.targetLocation).toBe('London')
    })
  })
})

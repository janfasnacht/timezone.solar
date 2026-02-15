import { describe, it, expect } from 'vitest'
import { parse } from './parser'

describe('parser', () => {
  // --- Time parsing ---

  describe('time parsing', () => {
    it('parses 12h pm time', () => {
      const { parsed } = parse('NYC 3pm London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 15, minute: 0 })
    })

    it('parses 12h am time', () => {
      const { parsed } = parse('NYC 3am London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 3, minute: 0 })
    })

    it('parses 12h time with minutes', () => {
      const { parsed } = parse('NYC 3:30pm London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 15, minute: 30 })
    })

    it('parses 24h time', () => {
      const { parsed } = parse('NYC 18:00 London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('parses 24h time with leading zero', () => {
      const { parsed } = parse('NYC 09:30 London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 9, minute: 30 })
    })

    it('parses noon as named time', () => {
      const { parsed } = parse('NYC noon London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('parses midnight as named time', () => {
      const { parsed } = parse('NYC midnight London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 0, minute: 0 })
    })

    it('parses midday as named time', () => {
      const { parsed } = parse('NYC midday London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('handles 12pm edge case (noon)', () => {
      const { parsed } = parse('NYC 12pm London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('handles 12am edge case (midnight)', () => {
      const { parsed } = parse('NYC 12am London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 0, minute: 0 })
    })
  })

  // --- Two-location patterns ---

  describe('two-location patterns', () => {
    it('pattern 1: LOC TIME CONN LOC', () => {
      const { parsed } = parse('Boston 6pm in California')
      expect(parsed).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 2: TIME LOC CONN LOC', () => {
      const { parsed } = parse('6pm Boston to California')
      expect(parsed).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 3: LOC CONN LOC TIME', () => {
      const { parsed } = parse('Boston to California 6pm')
      expect(parsed).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 4: LOC TIME LOC (no connector)', () => {
      const { parsed } = parse('Boston 6pm California')
      expect(parsed).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'absolute', hour: 18, minute: 0 },
        dateModifier: null,
      })
    })

    it('pattern 5: LOC CONN LOC (no time)', () => {
      const { parsed } = parse('Boston to California')
      expect(parsed).toEqual({
        sourceLocation: 'Boston',
        targetLocation: 'California',
        time: { type: 'now' },
        dateModifier: null,
      })
    })

    it('pattern 6: TIME LOC LOC — adjacent locations merge', () => {
      // mergeLocationTokens merges adjacent LOCATION tokens,
      // so "Boston California" becomes one location → single-location pattern
      const { parsed } = parse('6pm Boston California')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('Boston California')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('pattern 7: LOC LOC TIME — adjacent locations merge', () => {
      const { parsed } = parse('Boston California 6pm')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('Boston California')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('pattern 8: LOC LOC — adjacent locations merge', () => {
      const { parsed } = parse('Boston California')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('Boston California')
      expect(parsed?.time).toEqual({ type: 'now' })
    })

    it('pattern 9: TIME CONN LOC CONN LOC (double connector)', () => {
      const { parsed } = parse('6pm in Boston to LA')
      expect(parsed).toEqual({
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
      const { parsed } = parse('NYC to London')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('supports "in" connector', () => {
      const { parsed } = parse('NYC 6pm in London')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('supports "->" connector', () => {
      const { parsed } = parse('NYC -> London')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('supports "=>" connector', () => {
      const { parsed } = parse('NYC => London')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('supports "from" connector (stripped as leading)', () => {
      const { parsed } = parse('from NYC to London')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })
  })

  // --- Single-location / implicit source ---

  describe('single-location patterns', () => {
    it('pattern 10: TIME CONN LOC (implicit source)', () => {
      const { parsed } = parse('6pm in California')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('California')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
    })

    it('pattern 11: LOC TIME (implicit source)', () => {
      const { parsed } = parse('London 5pm')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 17, minute: 0 })
    })

    it('pattern 12: TIME LOC (implicit source)', () => {
      const { parsed } = parse('5pm London')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 17, minute: 0 })
    })

    it('pattern 13: LOC (bare location)', () => {
      const { parsed } = parse('Tokyo')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('Tokyo')
      expect(parsed?.time).toEqual({ type: 'now' })
    })
  })

  // --- Multi-word cities ---

  describe('multi-word cities', () => {
    it('handles New York', () => {
      const { parsed } = parse('New York to London')
      expect(parsed?.sourceLocation).toBe('New York')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('handles Los Angeles', () => {
      const { parsed } = parse('Los Angeles to London')
      expect(parsed?.sourceLocation).toBe('Los Angeles')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('handles San Francisco', () => {
      const { parsed } = parse('San Francisco to London')
      expect(parsed?.sourceLocation).toBe('San Francisco')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('handles Ho Chi Minh City', () => {
      const { parsed } = parse('Ho Chi Minh City')
      expect(parsed?.sourceLocation).toBeNull()
      expect(parsed?.targetLocation).toBe('Ho Chi Minh City')
    })
  })

  // --- Connector cleanup ---

  describe('connector cleanup', () => {
    it('removes "at" before time', () => {
      const { parsed } = parse('Boston to LA at 3:30pm')
      expect(parsed?.sourceLocation).toBe('Boston')
      expect(parsed?.targetLocation).toBe('LA')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 15, minute: 30 })
    })

    it('strips leading "from" connector', () => {
      const { parsed } = parse('from Boston to LA')
      expect(parsed?.sourceLocation).toBe('Boston')
      expect(parsed?.targetLocation).toBe('LA')
    })
  })

  // --- Relative time ---

  describe('relative time', () => {
    it('parses "in 2 hours"', () => {
      const { parsed } = parse('in 2 hours London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 120 })
      expect(parsed?.targetLocation).toBe('London')
    })

    it('parses "in 30 minutes"', () => {
      const { parsed } = parse('in 30 minutes London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 30 })
      expect(parsed?.targetLocation).toBe('London')
    })

    it('parses "in 30 mins"', () => {
      const { parsed } = parse('in 30 mins London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 30 })
    })

    it('parses compound "in 1h30m"', () => {
      const { parsed } = parse('in 1h30m London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 90 })
    })

    it('parses "in 2h 15m"', () => {
      const { parsed } = parse('in 2h 15m London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 135 })
    })

    it('parses "in half an hour"', () => {
      const { parsed } = parse('in half an hour London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 30 })
    })

    it('parses "in an hour"', () => {
      const { parsed } = parse('in an hour London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 60 })
    })

    it('parses decimal hours "in 1.5 hours"', () => {
      const { parsed } = parse('in 1.5 hours London')
      expect(parsed?.time).toEqual({ type: 'relative', minutes: 90 })
    })
  })

  // --- Date modifiers ---

  describe('date modifiers', () => {
    it('parses "tomorrow"', () => {
      const { parsed } = parse('NYC to London tomorrow')
      expect(parsed?.dateModifier).toBe('tomorrow')
    })

    it('parses "tmrw"', () => {
      const { parsed } = parse('NYC to London tmrw')
      expect(parsed?.dateModifier).toBe('tomorrow')
    })

    it('parses "tmw"', () => {
      const { parsed } = parse('NYC to London tmw')
      expect(parsed?.dateModifier).toBe('tomorrow')
    })

    it('parses "yesterday"', () => {
      const { parsed } = parse('NYC to London yesterday')
      expect(parsed?.dateModifier).toBe('yesterday')
    })

    it('parses "today"', () => {
      const { parsed } = parse('NYC to London today')
      expect(parsed?.dateModifier).toBe('today')
    })

    it('parses date modifier in any position', () => {
      const { parsed } = parse('tomorrow NYC to London')
      expect(parsed?.dateModifier).toBe('tomorrow')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })
  })

  // --- Pre-processing ---

  describe('pre-processing', () => {
    it('strips trailing question mark', () => {
      const { parsed } = parse('NYC to London?')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('strips standalone "now"', () => {
      const { parsed } = parse('now NYC to London')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
      expect(parsed?.time).toEqual({ type: 'now' })
    })

    it('handles "now" alone as a stripped no-op → null', () => {
      const { parsed } = parse('now')
      expect(parsed).toBeNull()
    })
  })

  // --- Edge cases / null ---

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parse('').parsed).toBeNull()
    })

    it('returns null for whitespace only', () => {
      expect(parse('   ').parsed).toBeNull()
    })

    it('returns null for connector only', () => {
      expect(parse('to').parsed).toBeNull()
    })

    it('returns null for multiple connectors only', () => {
      expect(parse('to in from').parsed).toBeNull()
    })

    it('returns null for time only (no location)', () => {
      expect(parse('6pm').parsed).toBeNull()
    })

    it('returns null for unrecognized pattern', () => {
      // TIME TIME is not a valid pattern
      expect(parse('6pm 3am').parsed).toBeNull()
    })

    it('no time produces now TimeRef', () => {
      const { parsed } = parse('Tokyo')
      expect(parsed?.time).toEqual({ type: 'now' })
    })
  })

  // --- Case insensitivity ---

  describe('case insensitivity', () => {
    it('handles uppercase location', () => {
      const { parsed } = parse('LONDON')
      expect(parsed?.targetLocation).toBe('LONDON')
    })

    it('handles mixed case time', () => {
      const { parsed } = parse('NYC 3PM London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 15, minute: 0 })
    })

    it('handles uppercase named time', () => {
      const { parsed } = parse('NYC NOON London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 12, minute: 0 })
    })

    it('handles uppercase date modifier', () => {
      const { parsed } = parse('NYC to London TOMORROW')
      expect(parsed?.dateModifier).toBe('tomorrow')
    })

    it('handles uppercase connector', () => {
      const { parsed } = parse('NYC TO London')
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })
  })

  // --- Connector-at-before-time ---

  describe('connector before time removal', () => {
    it('removes "at" before time in two-location pattern', () => {
      const { parsed } = parse('NYC to London at 3:30pm')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 15, minute: 30 })
      expect(parsed?.sourceLocation).toBe('NYC')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('removes leading "at" before time in single-location', () => {
      const { parsed } = parse('at 6pm London')
      expect(parsed?.time).toEqual({ type: 'absolute', hour: 18, minute: 0 })
      expect(parsed?.targetLocation).toBe('London')
    })
  })
})

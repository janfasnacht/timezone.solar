import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Settings } from 'luxon'
import { parse } from './parser'
import { resolveLocation } from './resolver'
import { convert } from './converter'
import type { ConversionResult, ConversionIntent } from './types'

// Full pipeline helper
function pipeline(input: string): ConversionResult | null {
  const { parsed } = parse(input)
  if (!parsed) return null

  const target = resolveLocation(parsed.targetLocation)
  if (!target) return null

  let source = parsed.sourceLocation ? resolveLocation(parsed.sourceLocation) : null
  // If no source, use NYC as default local timezone
  if (!source) {
    source = resolveLocation('New York')
  }
  if (!source) return null

  const intent: ConversionIntent = {
    source: source.primary,
    target: target.primary,
    time: parsed.time,
    dateModifier: parsed.dateModifier,
  }
  return convert(intent)
}

describe('integration', () => {
  // Pin to 2026-03-01 10:00 EST
  const DEFAULT_PIN = new Date('2026-03-01T15:00:00Z').getTime()

  beforeEach(() => {
    Settings.now = () => DEFAULT_PIN
  })

  afterEach(() => {
    Settings.now = () => Date.now()
  })

  // --- Common queries ---

  describe('common queries', () => {
    it('3pm NYC to London', () => {
      const result = pipeline('3pm NYC to London')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('15:00')
      expect(result!.target.formattedTime24).toBe('20:00')
    })

    it('NYC to LA', () => {
      const result = pipeline('NYC to LA')
      expect(result).not.toBeNull()
      expect(result!.offsetDifference).toBe('-3h')
    })

    it('6pm Boston to California', () => {
      const result = pipeline('6pm Boston to California')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('18:00')
      expect(result!.target.formattedTime24).toBe('15:00')
    })

    it('Tokyo 9am in London', () => {
      const result = pipeline('Tokyo 9am in London')
      expect(result).not.toBeNull()
      // Tokyo 9:00 → London 0:00 (same day, before UK DST)
      expect(result!.source.formattedTime24).toBe('09:00')
      expect(result!.target.formattedTime24).toBe('00:00')
    })

    it('London to Sydney', () => {
      const result = pipeline('London to Sydney')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('Europe/London')
      expect(result!.target.iana).toBe('Australia/Sydney')
    })

    it('midnight NYC to Tokyo', () => {
      const result = pipeline('midnight NYC to Tokyo')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('00:00')
    })
  })

  // --- Alias chains ---

  describe('alias chains', () => {
    it('sf to hk', () => {
      const result = pipeline('sf to hk')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/Los_Angeles')
      expect(result!.target.iana).toBe('Asia/Hong_Kong')
    })

    it('nz to india', () => {
      const result = pipeline('nz to india')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('Pacific/Auckland')
      expect(result!.target.iana).toMatch(/Asia\/(Kolkata|Mumbai)/)
    })
  })

  // --- Relative time E2E ---

  describe('relative time E2E', () => {
    it('in 2 hours London', () => {
      const result = pipeline('in 2 hours London')
      expect(result).not.toBeNull()
      // NYC 10:00 + 2h = 12:00 EST → 17:00 GMT
      expect(result!.target.formattedTime24).toBe('17:00')
    })

    it('in 30 mins NYC to LA', () => {
      const result = pipeline('in 30 mins NYC to LA')
      expect(result).not.toBeNull()
      // NYC 10:00 + 30m = 10:30 EST → 7:30 PST
      expect(result!.source.formattedTime24).toBe('10:30')
      expect(result!.target.formattedTime24).toBe('07:30')
    })
  })

  // --- Date modifier E2E ---

  describe('date modifier E2E', () => {
    it('tomorrow NYC to London', () => {
      const result = pipeline('tomorrow NYC to London')
      expect(result).not.toBeNull()
      expect(result!.sourceDateTime).toContain('2026-03-02')
    })

    it('yesterday NYC to London', () => {
      const result = pipeline('yesterday NYC to London')
      expect(result).not.toBeNull()
      expect(result!.sourceDateTime).toContain('2026-02-28')
    })
  })

  // --- Multi-word location E2E ---

  describe('multi-word location E2E', () => {
    it('New York to London', () => {
      const result = pipeline('New York to London')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/New_York')
    })

    it('San Francisco to Tokyo', () => {
      const result = pipeline('San Francisco to Tokyo')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/Los_Angeles')
    })

    it('Ho Chi Minh City', () => {
      const result = pipeline('Ho Chi Minh City')
      expect(result).not.toBeNull()
      expect(result!.target.iana).toBe('Asia/Ho_Chi_Minh')
    })
  })

  // --- Failure cases ---

  describe('failure cases', () => {
    it('empty input returns null', () => {
      expect(pipeline('')).toBeNull()
    })

    it('garbage location returns null', () => {
      expect(pipeline('xyzzy123 to abcdef456')).toBeNull()
    })

    it('connector only returns null', () => {
      expect(pipeline('to')).toBeNull()
    })
  })

  // --- Named times E2E ---

  describe('named times E2E', () => {
    it('midnight NYC to London', () => {
      const result = pipeline('midnight NYC to London')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('00:00')
      expect(result!.target.formattedTime24).toBe('05:00')
    })

    it('noon London to Tokyo', () => {
      const result = pipeline('noon London to Tokyo')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('12:00')
      expect(result!.target.formattedTime24).toBe('21:00')
    })
  })

  // --- Connector variations E2E ---

  describe('connector variations E2E', () => {
    it('NYC -> London', () => {
      const result = pipeline('NYC -> London')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/New_York')
      expect(result!.target.iana).toBe('Europe/London')
    })

    it('NYC => London', () => {
      const result = pipeline('NYC => London')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/New_York')
    })

    it('from NYC to London', () => {
      const result = pipeline('from NYC to London')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/New_York')
    })
  })

  // --- Trailing ? ---

  describe('trailing question mark', () => {
    it('NYC to London?', () => {
      const result = pipeline('NYC to London?')
      expect(result).not.toBeNull()
      expect(result!.target.iana).toBe('Europe/London')
    })
  })

  // --- DST-aware E2E ---

  describe('DST-aware E2E', () => {
    it('before US spring forward (Mar 1)', () => {
      const result = pipeline('10am NYC to London')
      expect(result).not.toBeNull()
      // EST to GMT: +5h
      expect(result!.offsetDifference).toBe('+5h')
    })

    it('during US spring forward gap (Mar 8)', () => {
      Settings.now = () => new Date('2026-03-08T06:00:00Z').getTime()
      const result = pipeline('10am NYC to London')
      expect(result).not.toBeNull()
      // EDT to GMT: +4h
      expect(result!.offsetDifference).toBe('+4h')
    })

    it('after London spring forward (Apr 1)', () => {
      Settings.now = () => new Date('2026-04-01T14:00:00Z').getTime()
      const result = pipeline('10am NYC to London')
      expect(result).not.toBeNull()
      // EDT to BST: -4h + 1h = +5h... wait: EDT is -4, BST is +1, diff is +5h
      expect(result!.offsetDifference).toBe('+5h')
    })
  })

  // --- "now" stripping E2E ---

  // --- Day-of-week E2E ---

  describe('day-of-week E2E', () => {
    // Pinned to 2026-03-01 (Sunday) 10:00 EST

    it('next Tuesday 3pm NYC to London resolves to correct date', () => {
      const result = pipeline('next Tuesday 3pm NYC to London')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('15:00')
      // Sunday → next Tuesday = 2026-03-03
      expect(result!.sourceDateTime).toContain('2026-03-03')
    })

    it('Monday 9am Berlin to Tokyo (bare) resolves to next Monday', () => {
      const result = pipeline('Monday 9am Berlin to Tokyo')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('09:00')
      // Sunday → next Monday = 2026-03-02
      expect(result!.sourceDateTime).toContain('2026-03-02')
    })

    it('next Wednesday Tokyo without time uses current time', () => {
      const result = pipeline('next Wednesday Tokyo')
      expect(result).not.toBeNull()
      // Sunday → next Wednesday = 2026-03-04
      expect(result!.sourceDateTime).toContain('2026-03-04')
    })

    it('last Saturday 8pm Sydney to London resolves to past date', () => {
      const result = pipeline('last Saturday 8pm Sydney to London')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('20:00')
      // Sunday → last Saturday = 2026-02-28
      expect(result!.sourceDateTime).toContain('2026-02-28')
    })

    it('day-of-week uses correct DST rules for target date', () => {
      // Pin to 2026-03-06 (Friday) before US spring-forward on Mar 8
      const fridayPin = new Date('2026-03-06T15:00:00Z').getTime()
      Settings.now = () => fridayPin

      // "next Tuesday" from Friday Mar 6 = Mar 10, which is AFTER spring-forward
      const result = pipeline('next Tuesday 10am NYC to London')
      expect(result).not.toBeNull()
      expect(result!.sourceDateTime).toContain('2026-03-10')
      // After spring-forward: NYC is EDT (-4), London is GMT (+0), offset = +4h
      expect(result!.target.formattedTime24).toBe('14:00')
      expect(result!.offsetDifference).toBe('+4h')
    })
  })

  describe('"now" stripping E2E', () => {
    it('now NYC to London', () => {
      const result = pipeline('now NYC to London')
      expect(result).not.toBeNull()
      expect(result!.source.formattedTime24).toBe('10:00')
    })

    it('NYC now to London', () => {
      const result = pipeline('NYC now to London')
      expect(result).not.toBeNull()
    })

    it('NYC to London now', () => {
      const result = pipeline('NYC to London now')
      expect(result).not.toBeNull()
    })
  })
})

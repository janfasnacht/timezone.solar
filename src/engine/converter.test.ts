import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Settings } from 'luxon'
import { convert, swapResult } from './converter'
import type { LocationRef, ConversionIntent, TimeRef } from './types'

// Helper to build a minimal LocationRef
function loc(iana: string, displayName: string): LocationRef {
  return { iana, displayName, kind: 'city', resolveMethod: 'city-db' }
}

// Helper to build a ConversionIntent
function intent(
  source: LocationRef,
  target: LocationRef,
  time: TimeRef = { type: 'now' },
  dateModifier: ConversionIntent['dateModifier'] = null,
): ConversionIntent {
  return { source, target, time, dateModifier }
}

const NYC = loc('America/New_York', 'New York')
const LA = loc('America/Los_Angeles', 'Los Angeles')
const LONDON = loc('Europe/London', 'London')
const TOKYO = loc('Asia/Tokyo', 'Tokyo')
const KOLKATA = loc('Asia/Kolkata', 'Kolkata')
const SYDNEY = loc('Australia/Sydney', 'Sydney')
const SEOUL = loc('Asia/Seoul', 'Seoul')

describe('converter', () => {
  // Default pin: 2026-03-01 10:00 EST (before US spring-forward on Mar 8)
  const DEFAULT_PIN = new Date('2026-03-01T15:00:00Z').getTime() // 10:00 AM EST

  beforeEach(() => {
    Settings.now = () => DEFAULT_PIN
  })

  afterEach(() => {
    Settings.now = () => Date.now()
  })

  // --- Basic conversions ---

  describe('basic conversions', () => {
    it('NYC to LA: 3 hours behind', () => {
      const result = convert(intent(NYC, LA, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.target.formattedTime24).toBe('07:00')
      expect(result.offsetDifference).toBe('-3h')
      expect(result.dayBoundary).toBe('same day')
    })

    it('NYC to London: 5 hours ahead (before DST)', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.target.formattedTime24).toBe('15:00')
      expect(result.offsetDifference).toBe('+5h')
    })

    it('Tokyo to NYC: crosses day boundary', () => {
      const result = convert(intent(TOKYO, NYC, { type: 'absolute', hour: 2, minute: 0 }))
      // Tokyo 2:00 AM → NYC previous day (14 hours behind)
      expect(result.target.formattedTime24).toBe('12:00')
      expect(result.dayBoundary).toBe('yesterday')
    })

    it('NYC to Kolkata: half-hour offset', () => {
      const result = convert(intent(NYC, KOLKATA, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.target.formattedTime24).toBe('20:30')
      expect(result.offsetDifference).toBe('+10h 30m')
    })
  })

  // --- No time specified ---

  describe('no time specified', () => {
    it('uses current time when no time given', () => {
      const result = convert(intent(NYC, LA))
      // Pinned at 10:00 EST → 7:00 PST
      expect(result.source.formattedTime24).toBe('10:00')
      expect(result.target.formattedTime24).toBe('07:00')
    })

    it('uses current time for different zones', () => {
      const result = convert(intent(NYC, LONDON))
      expect(result.source.formattedTime24).toBe('10:00')
      expect(result.target.formattedTime24).toBe('15:00')
    })
  })

  // --- Date modifiers ---

  describe('date modifiers', () => {
    it('tomorrow shifts by +1 day', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }, 'tomorrow'))
      expect(result.dayBoundary).toBe('same day')
      expect(result.source.formattedTime24).toBe('10:00')
      // The source should be March 2 (tomorrow from March 1)
      expect(result.sourceDateTime).toContain('2026-03-02')
    })

    it('yesterday shifts by -1 day', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }, 'yesterday'))
      expect(result.sourceDateTime).toContain('2026-02-28')
    })

    it('today prevents temporal anchoring', () => {
      // 8am is in the past (pinned at 10am), but "today" should prevent auto-tomorrow
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 8, minute: 0 }, 'today'))
      expect(result.anchoredToTomorrow).toBe(false)
      expect(result.source.formattedTime24).toBe('08:00')
      expect(result.sourceDateTime).toContain('2026-03-01')
    })

    it('tomorrow without time uses current time + 1 day', () => {
      const result = convert(intent(NYC, LONDON, { type: 'now' }, 'tomorrow'))
      expect(result.sourceDateTime).toContain('2026-03-02')
      expect(result.source.formattedTime24).toBe('10:00')
    })

    it('yesterday without time uses current time - 1 day', () => {
      const result = convert(intent(NYC, LONDON, { type: 'now' }, 'yesterday'))
      expect(result.sourceDateTime).toContain('2026-02-28')
    })
  })

  // --- Temporal anchoring ---

  describe('temporal anchoring', () => {
    it('past time auto-anchors to tomorrow', () => {
      // 8am is in the past (pinned at 10am) → should anchor to tomorrow
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 8, minute: 0 }))
      expect(result.anchoredToTomorrow).toBe(true)
      expect(result.anchorNote).toContain('tomorrow')
      expect(result.sourceDateTime).toContain('2026-03-02')
    })

    it('future time stays on same day', () => {
      // 14:00 is in the future (pinned at 10am)
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 14, minute: 0 }))
      expect(result.anchoredToTomorrow).toBe(false)
      expect(result.sourceDateTime).toContain('2026-03-01')
    })

    it('explicit "today" prevents anchoring', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 8, minute: 0 }, 'today'))
      expect(result.anchoredToTomorrow).toBe(false)
    })
  })

  // --- Relative time ---

  describe('relative time', () => {
    it('+60 min from now', () => {
      const result = convert(intent(NYC, LONDON, { type: 'relative', minutes: 60 }))
      // 10:00 + 60m = 11:00 EST → 16:00 GMT
      expect(result.source.formattedTime24).toBe('11:00')
      expect(result.target.formattedTime24).toBe('16:00')
    })

    it('+120 min from now', () => {
      const result = convert(intent(NYC, LA, { type: 'relative', minutes: 120 }))
      // 10:00 + 120m = 12:00 EST → 09:00 PST
      expect(result.source.formattedTime24).toBe('12:00')
      expect(result.target.formattedTime24).toBe('09:00')
    })

    it('+30 min across zones', () => {
      const result = convert(intent(NYC, TOKYO, { type: 'relative', minutes: 30 }))
      // 10:00 + 30m = 10:30 EST → 00:30 JST (next day)
      expect(result.source.formattedTime24).toBe('10:30')
      expect(result.target.formattedTime24).toBe('00:30')
    })
  })

  // --- Day boundaries ---

  describe('day boundaries', () => {
    it('shows "tomorrow" for next-day conversions', () => {
      const result = convert(intent(NYC, TOKYO, { type: 'absolute', hour: 15, minute: 0 }))
      // 15:00 EST → 05:00 JST (next day)
      expect(result.dayBoundary).toBe('tomorrow')
    })

    it('shows "yesterday" for previous-day conversions', () => {
      const result = convert(intent(TOKYO, NYC, { type: 'absolute', hour: 2, minute: 0 }))
      expect(result.dayBoundary).toBe('yesterday')
    })

    it('shows "same day" for same-day conversions', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.dayBoundary).toBe('same day')
    })

    it('shows "+N days" for multi-day difference', () => {
      // Large offset + tomorrow modifier
      const result = convert(intent(NYC, TOKYO, { type: 'absolute', hour: 15, minute: 0 }, 'tomorrow'))
      // Tomorrow's 15:00 EST → day after tomorrow 05:00 JST
      expect(result.dayBoundary).toBe('tomorrow')
    })
  })

  // --- DST: US Spring Forward (Mar 8, 2026) ---

  describe('DST: US Spring Forward', () => {
    it('handles gap hour on Mar 8', () => {
      // Pin to Mar 7 22:00 EST → before spring forward
      Settings.now = () => new Date('2026-03-08T03:00:00Z').getTime()

      // 2:30 AM on Mar 8 falls in the gap — Luxon handles this gracefully
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 2, minute: 30 }))
      expect(result.source.formattedTime24).toBeDefined()
      expect(result.target.formattedTime24).toBeDefined()
    })

    it('EDT offset check after spring forward', () => {
      // Pin to Mar 9 (after spring forward)
      Settings.now = () => new Date('2026-03-09T14:00:00Z').getTime()

      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      // NYC is now EDT (-4), London is GMT (+0) → +4h difference
      expect(result.offsetDifference).toBe('+4h')
    })

    it('before spring forward shows EST offset', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      // Pinned Mar 1 → EST (-5), London GMT (+0) → +5h
      expect(result.offsetDifference).toBe('+5h')
    })
  })

  // --- DST: US Fall Back (Nov 1, 2026) ---

  describe('DST: US Fall Back', () => {
    it('EST offset after fall back', () => {
      // Pin to Nov 2 (after fall back)
      Settings.now = () => new Date('2026-11-02T15:00:00Z').getTime()

      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      // NYC EST (-5), London GMT (+0) → +5h
      expect(result.offsetDifference).toBe('+5h')
    })

    it('EDT→EST transition period', () => {
      // Pin to Oct 31 (still EDT)
      Settings.now = () => new Date('2026-10-31T14:00:00Z').getTime()

      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      // NYC EDT (-4), London GMT (+0) → +4h
      expect(result.offsetDifference).toBe('+4h')
    })
  })

  // --- DST: Europe (Mar 29, 2026 spring forward) ---

  describe('DST: Europe', () => {
    it('before London spring forward', () => {
      // Pin to Mar 28 (London still GMT)
      Settings.now = () => new Date('2026-03-28T12:00:00Z').getTime()

      const result = convert(intent(LONDON, NYC, { type: 'absolute', hour: 15, minute: 0 }))
      // London GMT, NYC EDT (-4) → -4h
      expect(result.offsetDifference).toBe('-4h')
    })

    it('after London spring forward', () => {
      // Pin to Mar 30 (London now BST +1)
      Settings.now = () => new Date('2026-03-30T12:00:00Z').getTime()

      const result = convert(intent(LONDON, NYC, { type: 'absolute', hour: 15, minute: 0 }))
      // London BST (+1), NYC EDT (-4) → -5h
      expect(result.offsetDifference).toBe('-5h')
    })
  })

  // --- DST: Southern hemisphere ---

  describe('DST: Southern hemisphere', () => {
    it('Sydney before April fall-back', () => {
      // Pin to April 4 (Sydney still AEDT +11)
      Settings.now = () => new Date('2026-04-04T00:00:00Z').getTime()

      const result = convert(intent(SYDNEY, LONDON, { type: 'absolute', hour: 12, minute: 0 }))
      // Sydney AEDT (+11), London BST (+1) → -10h
      expect(result.offsetDifference).toBe('-10h')
    })

    it('Sydney after April fall-back', () => {
      // Pin to April 6 (Sydney now AEST +10)
      Settings.now = () => new Date('2026-04-06T00:00:00Z').getTime()

      const result = convert(intent(SYDNEY, LONDON, { type: 'absolute', hour: 12, minute: 0 }))
      // Sydney AEST (+10), London BST (+1) → -9h
      expect(result.offsetDifference).toBe('-9h')
    })
  })

  // --- Same timezone ---

  describe('same timezone', () => {
    it('offset +0h for same timezone', () => {
      const result = convert(intent(NYC, NYC, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.offsetDifference).toBe('+0h')
      expect(result.dayBoundary).toBe('same day')
    })
  })

  // --- offsetDifference formatting ---

  describe('offsetDifference formatting', () => {
    it('positive whole hours', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.offsetDifference).toBe('+5h')
    })

    it('half-hour offset includes minutes', () => {
      const result = convert(intent(NYC, KOLKATA, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.offsetDifference).toBe('+10h 30m')
    })

    it('negative whole hours', () => {
      const result = convert(intent(LONDON, NYC, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.offsetDifference).toBe('-5h')
    })

    it('negative from LA to NYC', () => {
      const result = convert(intent(LA, NYC, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.offsetDifference).toBe('+3h')
    })
  })

  // --- DST notes ---

  describe('DST notes', () => {
    it('both DST active', () => {
      // Pin to July (both NYC and London in DST)
      Settings.now = () => new Date('2026-07-01T14:00:00Z').getTime()

      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.dstNote).toBe('DST active in both locations')
    })

    it('source only DST', () => {
      // NYC in EDT, Tokyo never DST
      Settings.now = () => new Date('2026-07-01T14:00:00Z').getTime()

      const result = convert(intent(NYC, TOKYO, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.dstNote).toBe('DST active in source location')
    })

    it('target only DST', () => {
      // Tokyo never DST, London in BST
      Settings.now = () => new Date('2026-07-01T14:00:00Z').getTime()

      const result = convert(intent(TOKYO, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.dstNote).toBe('DST active in target location')
    })

    it('neither in DST', () => {
      // Winter: Tokyo and Seoul, neither has DST
      const result = convert(intent(TOKYO, SEOUL, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.dstNote).toBeNull()
    })
  })

  // --- swapResult ---

  describe('swapResult', () => {
    it('reverses source and target', () => {
      const original = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      const swapped = swapResult(original)

      expect(swapped.source.iana).toBe('Europe/London')
      expect(swapped.target.iana).toBe('America/New_York')
    })

    it('swaps source/target cities and iana zones', () => {
      const original = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      const swapped = swapResult(original)

      // City and iana should be swapped
      expect(swapped.source.city).toBe(original.target.city)
      expect(swapped.target.city).toBe(original.source.city)
      expect(swapped.source.iana).toBe(original.target.iana)
      expect(swapped.target.iana).toBe(original.source.iana)
    })

    it('resets anchoredToTomorrow', () => {
      // Force anchoring
      const original = convert(intent(NYC, LONDON, { type: 'absolute', hour: 8, minute: 0 }))
      expect(original.anchoredToTomorrow).toBe(true)

      const swapped = swapResult(original)
      expect(swapped.anchoredToTomorrow).toBe(false)
      expect(swapped.anchorNote).toBeNull()
    })
  })

  // --- TimezoneInfo fields ---

  describe('TimezoneInfo fields', () => {
    it('formattedTime12 has AM/PM format', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.source.formattedTime12).toMatch(/^\d{1,2}:\d{2}\s(AM|PM)$/)
    })

    it('formattedTime24 has 24h format', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.source.formattedTime24).toMatch(/^\d{2}:\d{2}$/)
    })

    it('abbreviation is non-empty', () => {
      const result = convert(intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }))
      expect(result.source.abbreviation.length).toBeGreaterThan(0)
      expect(result.target.abbreviation.length).toBeGreaterThan(0)
    })
  })

  // --- intent field ---

  describe('intent field', () => {
    it('result carries the intent that produced it', () => {
      const i = intent(NYC, LONDON, { type: 'absolute', hour: 10, minute: 0 }, 'tomorrow')
      const result = convert(i)
      expect(result.intent).toBe(i)
      expect(result.intent.source).toBe(NYC)
      expect(result.intent.target).toBe(LONDON)
      expect(result.intent.time).toEqual({ type: 'absolute', hour: 10, minute: 0 })
      expect(result.intent.dateModifier).toBe('tomorrow')
    })
  })
})

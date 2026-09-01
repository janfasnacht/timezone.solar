import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Settings, DateTime } from 'luxon'
import { parse } from '@/engine/parser'
import { convert } from '@/engine/converter'
import { resolveLocation } from '@/engine/resolver'
import { serializeDateModifier, parseDateModifier } from '@/lib/canonicalUrl'
import { setDayFirstForTests } from '@/engine/parser-utils'
import type { AbsoluteDate, DateModifier } from '@/engine/types'

// Pinned so date rollover assertions are stable.
const NOW = DateTime.fromISO('2026-09-15T12:00:00', { zone: 'America/New_York' })

beforeEach(() => {
  Settings.now = () => NOW.toMillis()
})
afterEach(() => {
  Settings.now = () => Date.now()
})

function dateOf(query: string): DateModifier {
  return parse(query).parsed?.dateModifier ?? null
}

describe('parsing named dates', () => {
  it('reads day-first', () => {
    expect(dateOf('3pm 14 march nyc to london')).toEqual({ type: 'date', year: null, month: 3, day: 14 })
  })

  it('reads month-first', () => {
    expect(dateOf('3pm march 14 nyc to london')).toEqual({ type: 'date', year: null, month: 3, day: 14 })
  })

  it('accepts abbreviations and ordinals', () => {
    expect(dateOf('3pm 14th mar nyc to london')).toEqual({ type: 'date', year: null, month: 3, day: 14 })
    expect(dateOf('3pm sept 2 nyc to london')).toEqual({ type: 'date', year: null, month: 9, day: 2 })
  })

  it('keeps an explicit year', () => {
    expect(dateOf('3pm 14 march 2027 nyc to london')).toEqual({ type: 'date', year: 2027, month: 3, day: 14 })
    expect(dateOf('3pm march 14, 2027 nyc to london')).toEqual({ type: 'date', year: 2027, month: 3, day: 14 })
  })

  it('reads ISO', () => {
    expect(dateOf('3pm 2027-03-14 nyc to london')).toEqual({ type: 'date', year: 2027, month: 3, day: 14 })
  })

  it('still resolves the locations around the date', () => {
    const { parsed } = parse('3pm 14 march nyc to london')
    expect(parsed?.sourceLocation).toBeTruthy()
    expect(resolveLocation(parsed!.sourceLocation!).primary?.iana).toBe('America/New_York')
    expect(resolveLocation(parsed!.targetLocation).primary?.iana).toBe('Europe/London')
  })

  it('does not claim a bare month word as a date', () => {
    expect(dateOf('3pm march nyc to london')).toBeNull()
  })

  it('reads numeric dates using the typist\'s own convention', () => {
    setDayFirstForTests(true) // e.g. a Swiss browser
    expect(dateOf('3pm 3/4 nyc to london')).toEqual({ type: 'date', year: null, month: 4, day: 3 })
    setDayFirstForTests(false) // e.g. a US browser
    expect(dateOf('3pm 3/4 nyc to london')).toEqual({ type: 'date', year: null, month: 3, day: 4 })
    setDayFirstForTests(null)
  })

  it('ignores the convention when only one reading is possible', () => {
    for (const dayFirst of [true, false]) {
      setDayFirstForTests(dayFirst)
      // 14 cannot be a month, so this is the 14th either way.
      expect(dateOf('3pm 14/03 nyc to london')).toEqual({ type: 'date', year: null, month: 3, day: 14 })
      expect(dateOf('3pm 03/14 nyc to london')).toEqual({ type: 'date', year: null, month: 3, day: 14 })
    }
    setDayFirstForTests(null)
  })

  it('expands a two-digit year', () => {
    setDayFirstForTests(true)
    expect(dateOf('3pm 14/03/27 nyc to london')).toEqual({ type: 'date', year: 2027, month: 3, day: 14 })
    setDayFirstForTests(null)
  })

  it('leaves dotted times alone', () => {
    // "3.30" is a time to plenty of people; only slashes mean a date.
    expect(dateOf('3.30pm nyc to london')).toBeNull()
  })

  it('rejects impossible dates', () => {
    expect(dateOf('3pm 45 march nyc to london')).toBeNull()
  })

  it('lets an explicit tomorrow win over a named date', () => {
    expect(dateOf('3pm tomorrow 14 march nyc to london')).toBe('tomorrow')
  })
})

describe('converting to a named date', () => {
  const nyc = resolveLocation('new york').primary!
  const london = resolveLocation('london').primary!

  function convertOn(dateModifier: DateModifier) {
    return convert({
      source: { ...nyc } as never,
      target: { ...london } as never,
      time: { type: 'absolute', hour: 15, minute: 0 },
      dateModifier,
    } as never)
  }

  it('lands on the named day', () => {
    const result = convertOn({ type: 'date', year: 2027, month: 3, day: 14 })
    expect(DateTime.fromISO(result.sourceDateTime).setZone('America/New_York').toISODate()).toBe('2027-03-14')
  })

  it('without a year, rolls forward to the next occurrence', () => {
    // "14 march" asked in September means next March, not the one that passed.
    const result = convertOn({ type: 'date', year: null, month: 3, day: 14 })
    expect(DateTime.fromISO(result.sourceDateTime).setZone('America/New_York').toISODate()).toBe('2027-03-14')
  })

  it('without a year, keeps a date still ahead this year', () => {
    const result = convertOn({ type: 'date', year: null, month: 12, day: 1 })
    expect(DateTime.fromISO(result.sourceDateTime).setZone('America/New_York').toISODate()).toBe('2026-12-01')
  })

  it('carries the date across the timezone conversion', () => {
    const result = convertOn({ type: 'date', year: 2027, month: 3, day: 14 })
    expect(DateTime.fromISO(result.targetDateTime).setZone('Europe/London').toISODate()).toBe('2027-03-14')
  })
})

describe('round-tripping through the URL', () => {
  const cases: [AbsoluteDate, string][] = [
    [{ type: 'date', year: 2027, month: 3, day: 14 }, '2027-03-14'],
    [{ type: 'date', year: null, month: 3, day: 14 }, '03-14'],
    [{ type: 'date', year: null, month: 12, day: 1 }, '12-01'],
  ]

  it.each(cases)('serialises %o to %s and back', (date, serialized) => {
    expect(serializeDateModifier(date)).toBe(serialized)
    expect(parseDateModifier(serialized)).toEqual(date)
  })

  it('leaves the older modifiers untouched', () => {
    expect(serializeDateModifier('tomorrow')).toBe('tomorrow')
    expect(serializeDateModifier({ type: 'day-of-week', day: 'friday', anchor: 'next' })).toBe('next-friday')
    expect(parseDateModifier('next-friday')).toEqual({ type: 'day-of-week', day: 'friday', anchor: 'next' })
  })
})

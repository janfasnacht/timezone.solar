import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Settings, DateTime } from 'luxon'
import { parse } from '@/engine/parser'

/**
 * The time control writes `${field} ${from} to ${to}` and runs it through the
 * ordinary pipeline — so the field is only as capable as the parser. With the
 * desktop date picker gone, this file is the guarantee that the phrasings a
 * person would reasonably type actually work.
 */
const NOW = DateTime.fromISO('2026-09-15T12:00:00', { zone: 'America/New_York' }) // a Tuesday

beforeEach(() => { Settings.now = () => NOW.toMillis() })
afterEach(() => { Settings.now = () => Date.now() })

function field(phrase: string) {
  const { parsed, error } = parse(`${phrase} New York to London`)
  return { parsed, error, time: parsed?.time, date: parsed?.dateModifier }
}

const at = (hour: number, minute = 0) => ({ type: 'absolute', hour, minute })

describe('times the field must understand', () => {
  it.each([
    ['5pm', at(17)],
    ['5 pm', at(17)],
    ['5 PM', at(17)],
    ['5 p.m.', at(17)],
    ['17:00', at(17)],
    ['5:30pm', at(17, 30)],
    ['5.30pm', at(17, 30)],
    ['9am', at(9)],
    ['11 am', at(11)],
    ['12pm', at(12)],
    ['12am', at(0)],
    ['noon', at(12)],
    ['midnight', at(0)],
  ])('%s', (phrase, expected) => {
    expect(field(phrase).time).toEqual(expected)
  })

  it('reads relative expressions', () => {
    expect(field('in 2 hours').time).toEqual({ type: 'relative', minutes: 120 })
    expect(field('in 90 minutes').time).toEqual({ type: 'relative', minutes: 90 })
    expect(field('in 1h30m').time).toEqual({ type: 'relative', minutes: 90 })
  })
})

describe('days and dates the field must understand', () => {
  it.each([
    ['tomorrow', 'tomorrow'],
    ['today', 'today'],
    ['yesterday', 'yesterday'],
  ])('%s', (phrase, expected) => {
    expect(field(phrase).date).toBe(expected)
  })

  it('reads weekdays with and without an anchor', () => {
    expect(field('friday').date).toEqual({ type: 'day-of-week', day: 'friday', anchor: 'bare' })
    expect(field('next friday').date).toEqual({ type: 'day-of-week', day: 'friday', anchor: 'next' })
    expect(field('last tuesday').date).toEqual({ type: 'day-of-week', day: 'tuesday', anchor: 'last' })
    expect(field('sat').date).toEqual({ type: 'day-of-week', day: 'saturday', anchor: 'bare' })
  })

  it.each(['14 march', 'march 14', '14th march', 'mar 14'])('%s', (phrase) => {
    expect(field(phrase).date).toEqual({ type: 'date', year: null, month: 3, day: 14 })
  })

  it('reads a year when given one', () => {
    expect(field('14 march 2027').date).toEqual({ type: 'date', year: 2027, month: 3, day: 14 })
    expect(field('2027-03-14').date).toEqual({ type: 'date', year: 2027, month: 3, day: 14 })
  })
})

describe('time and date together, in either order', () => {
  it.each([
    '3pm tomorrow',
    'tomorrow 3pm',
  ])('%s', (phrase) => {
    const r = field(phrase)
    expect(r.time).toEqual(at(15))
    expect(r.date).toBe('tomorrow')
  })

  it.each([
    '9am next friday',
    'next friday 9am',
  ])('%s', (phrase) => {
    const r = field(phrase)
    expect(r.time).toEqual(at(9))
    expect(r.date).toEqual({ type: 'day-of-week', day: 'friday', anchor: 'next' })
  })

  it('handles a time with a named date', () => {
    const r = field('5pm 14 march')
    expect(r.time).toEqual(at(17))
    expect(r.date).toEqual({ type: 'date', year: null, month: 3, day: 14 })
  })

  it('round-trips what whenPhrase writes back', () => {
    // These are exactly the forms the write-back emits.
    for (const phrase of ['5pm', '5:30pm friday', '9:30am 18 september', '09:00 14 march 2027']) {
      expect(field(phrase).error).toBeUndefined()
    }
  })
})

describe('the locations survive whatever the field contains', () => {
  it.each(['5pm', 'next friday', '14 march 2027', 'in 2 hours', '5pm 14 march'])('%s', (phrase) => {
    const { parsed, error } = parse(`${phrase} New York to London`)
    expect(error).toBeUndefined()
    expect(parsed?.sourceLocation).toBe('New York')
    expect(parsed?.targetLocation).toBe('London')
  })
})

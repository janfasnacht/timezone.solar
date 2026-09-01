import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { timePhrase, datePhrase, whenPhrase } from '@/lib/whenPhrase'

const zone = 'America/New_York'
const now = DateTime.fromISO('2026-09-15T12:00:00', { zone }) // a Tuesday

const at = (iso: string) => DateTime.fromISO(iso, { zone })

describe('timePhrase', () => {
  it('drops :00 in 12-hour form', () => {
    expect(timePhrase(at('2026-09-15T17:00'), false)).toBe('5pm')
  })
  it('keeps minutes when there are any', () => {
    expect(timePhrase(at('2026-09-15T17:30'), false)).toBe('5:30pm')
  })
  it('always pads in 24-hour form', () => {
    expect(timePhrase(at('2026-09-15T17:00'), true)).toBe('17:00')
    expect(timePhrase(at('2026-09-15T09:05'), true)).toBe('09:05')
  })
})

describe('datePhrase — minimal sufficient specificity', () => {
  it('says nothing at all for today', () => {
    expect(datePhrase(at('2026-09-15T17:00'), now)).toBeNull()
  })
  it('names the neighbouring days', () => {
    expect(datePhrase(at('2026-09-16T09:00'), now)).toBe('tomorrow')
    expect(datePhrase(at('2026-09-14T09:00'), now)).toBe('yesterday')
  })
  it('uses a weekday inside the coming week', () => {
    expect(datePhrase(at('2026-09-18T09:00'), now)).toBe('friday')
    expect(datePhrase(at('2026-09-21T09:00'), now)).toBe('monday')
  })
  it('switches to a date once a weekday would be ambiguous', () => {
    // 7 days out is the same weekday as today — "tuesday" would be a lie.
    expect(datePhrase(at('2026-09-22T09:00'), now)).toBe('22 september')
  })
  it('adds the year only when it differs', () => {
    expect(datePhrase(at('2026-12-01T09:00'), now)).toBe('1 december')
    expect(datePhrase(at('2027-03-14T09:00'), now)).toBe('14 march 2027')
  })
})

describe('whenPhrase', () => {
  it('is just a time when the day is today', () => {
    expect(whenPhrase(at('2026-09-15T17:00'), now, false)).toBe('5pm')
  })
  it('joins time and date otherwise', () => {
    expect(whenPhrase(at('2026-09-18T17:30'), now, false)).toBe('5:30pm friday')
    expect(whenPhrase(at('2027-03-14T09:00'), now, true)).toBe('09:00 14 march 2027')
  })
})

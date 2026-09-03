import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DateTime, Settings } from 'luxon'
import { timePhrase, datePhrase, whenPhrase, whenPhraseCandidates, verifiedWhenPhrase } from '@/lib/whenPhrase'
import { parse } from '@/engine/parser'
import { convert } from '@/engine/converter'

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

describe('verifiedWhenPhrase — the shortest phrase that provably round-trips', () => {
  // The verifier re-runs the real parser and converter, both of which read the
  // wall clock, so the clock has to agree with `now`.
  beforeEach(() => { Settings.now = () => now.toMillis() })
  afterEach(() => { Settings.now = () => Date.now() })

  const verify = (target: DateTime, use24h = false) =>
    verifiedWhenPhrase(target, now, use24h, 'nyc', 'london', zone)

  it('keeps the bare time when it still means today', () => {
    // 17:00 is later than the pinned 12:00, so nothing anchors it forward.
    expect(verify(at('2026-09-15T17:00'))).toBe('5pm')
  })

  it('climbs to "today" when a bare time would be anchored to tomorrow', () => {
    // 9am has already passed. `whenPhrase` alone writes "9am", which the
    // converter would read as tomorrow — a nudge backwards that jumps a day.
    expect(whenPhrase(at('2026-09-15T09:00'), now, false)).toBe('9am')
    expect(verify(at('2026-09-15T09:00'))).toBe('9am today')
  })

  it('keeps the short rungs that are already safe', () => {
    expect(verify(at('2026-09-16T09:00'))).toBe('9am tomorrow')
    expect(verify(at('2026-09-14T09:00'))).toBe('9am yesterday')
    expect(verify(at('2026-09-18T17:30'))).toBe('5:30pm friday')
    expect(verify(at('2026-09-22T09:00'))).toBe('9am 22 september')
    expect(verify(at('2027-03-14T09:00'), true)).toBe('09:00 14 march 2027')
  })

  it('never returns a phrase that lands on a different instant', () => {
    const targets = [
      '2026-09-15T00:30', '2026-09-15T09:00', '2026-09-15T12:00', '2026-09-15T23:45',
      '2026-09-14T09:00', '2026-09-16T09:00', '2026-09-18T17:30', '2026-09-21T06:15',
      '2026-09-22T09:00', '2026-12-01T09:00', '2027-03-14T09:00',
    ]
    for (const iso of targets) {
      for (const use24h of [false, true]) {
        const target = at(iso)
        const phrase = verify(target, use24h)
        const { parsed } = parse(`${phrase} nyc to london`)
        expect(parsed, phrase).not.toBeNull()
        const landed = DateTime.fromISO(convert({
          source: { iana: zone, displayName: 'nyc', kind: 'city', resolveMethod: 'alias' },
          target: { iana: zone, displayName: 'london', kind: 'city', resolveMethod: 'alias' },
          time: parsed!.time,
          dateModifier: parsed!.dateModifier,
        }).sourceDateTime)
        expect(landed.toMillis(), phrase).toBe(target.toMillis())
      }
    }
  })

  it('falls back to the most explicit rung rather than emitting a wrong one', () => {
    // No candidate can survive a target the locations swallow, so the floor holds.
    const phrase = verifiedWhenPhrase(at('2026-09-15T17:00'), now, false, 'nyc', '', zone)
    expect(phrase).toBe(whenPhraseCandidates(at('2026-09-15T17:00'), now, false).at(-1))
  })
})

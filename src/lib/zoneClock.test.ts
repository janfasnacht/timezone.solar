import { describe, it, expect } from 'vitest'
import { zoneClock } from '@/lib/zoneClock'

const now = new Date('2026-09-15T16:00:00Z')
const home = { iana: 'America/New_York', name: 'New York' }

describe('zoneClock', () => {
  it('reads the local time and the distance from home', () => {
    const c = zoneClock('Europe/London', now, true, home)
    expect(c).toEqual({ time: '17:00', offset: '+5h from New York', utc: 'UTC+01:00' })
  })

  it('follows the clock format', () => {
    expect(zoneClock('Europe/London', now, false, home)?.time).toBe('5:00 PM')
  })

  it('carries the minutes of a half-hour zone', () => {
    expect(zoneClock('Asia/Kolkata', now, true, home)?.offset).toBe('+9h 30m from New York')
  })

  it('says so when there is no distance', () => {
    expect(zoneClock('America/New_York', now, true, home)?.offset).toBe('same time as New York')
  })

  it('returns nothing for a zone the tz database does not have', () => {
    // The bug: `Asia/Kostanay` is not a zone — `Asia/Qostanay` is. Luxon does
    // not throw, so the card rendered "Invalid DateTime" and "-NaNh".
    expect(zoneClock('Asia/Kostanay', now, true, home)).toBeNull()
    expect(zoneClock('Asia/Qostanay', now, true, home)?.time).toBe('21:00')
  })

  it('still gives the time when it is the home zone that is unusable', () => {
    const c = zoneClock('Europe/London', now, true, { iana: 'Mars/Olympus', name: 'home' })
    expect(c?.time).toBe('17:00')
    expect(c?.offset).toBeNull()
  })
})

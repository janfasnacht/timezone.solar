import { DateTime } from 'luxon'

export interface ZoneClock {
  /** Local time in the zone, in the user's clock format. */
  time: string
  /** Distance from the reference zone, or null if that zone is unusable. */
  offset: string | null
  utc: string
}

/**
 * The time in `iana`, and how far that is from `reference`. Null for a zone the
 * tz database doesn't have: Luxon returns an invalid DateTime rather than
 * throwing, which formats as "Invalid DateTime" and subtracts to NaN.
 */
export function zoneClock(
  iana: string,
  now: Date,
  use24h: boolean,
  reference: { iana: string; name: string },
): ZoneClock | null {
  const dt = DateTime.fromJSDate(now).setZone(iana)
  if (!dt.isValid) return null

  const refDt = DateTime.fromJSDate(now).setZone(reference.iana)
  let offset: string | null = null
  if (refDt.isValid) {
    const diff = dt.offset - refDt.offset
    const hours = Math.floor(Math.abs(diff) / 60)
    const mins = Math.abs(diff) % 60
    const sign = diff >= 0 ? '+' : '-'
    if (diff === 0) offset = `same time as ${reference.name}`
    else if (mins) offset = `${sign}${hours}h ${mins}m from ${reference.name}`
    else offset = `${sign}${hours}h from ${reference.name}`
  }

  return {
    time: dt.toFormat(use24h ? 'HH:mm' : 'h:mm a'),
    offset,
    utc: dt.toFormat("'UTC'ZZ"),
  }
}

import { DateTime } from 'luxon'
import { parse } from '@/engine/parser'
import { convert } from '@/engine/converter'
import type { ConversionIntent, LocationRef } from '@/engine/types'

/**
 * Writing a moment back into the query says the least that still identifies it,
 * in the register the user was already using: "5pm friday", not
 * "17:00 2026-09-18".
 */
export function timePhrase(dt: DateTime, use24h: boolean): string {
  if (use24h) return dt.toFormat('HH:mm')
  return dt.minute === 0 ? dt.toFormat('ha').toLowerCase() : dt.toFormat('h:mma').toLowerCase()
}

/** Every phrasing of this day, shortest first. */
export function dateRungs(target: DateTime, now: DateTime): (string | null)[] {
  const day = target.startOf('day')
  const today = now.setZone(target.zoneName ?? undefined).startOf('day')
  const days = Math.round(day.diff(today, 'days').days)

  const rungs: (string | null)[] = []
  // "today" suppresses the converter's anchoring, which would read a bare time
  // that has already passed as tomorrow.
  if (days === 0) rungs.push(null, 'today')
  else if (days === 1) rungs.push('tomorrow')
  else if (days === -1) rungs.push('yesterday')
  // Past six days out it stops being obvious which week a weekday means.
  else if (days > 1 && days <= 6) rungs.push(target.toFormat('cccc').toLowerCase())

  const monthDay = `${target.day} ${target.toFormat('LLLL').toLowerCase()}`
  if (day.year === today.year) rungs.push(monthDay)
  rungs.push(`${monthDay} ${target.year}`)
  return rungs
}

/** The date half of the phrase, or null when the day needs no mention at all. */
export function datePhrase(target: DateTime, now: DateTime): string | null {
  return dateRungs(target, now)[0]
}

/** e.g. `5pm friday`, `17:00`, `9:30am 18 september 2027`. */
export function whenPhrase(target: DateTime, now: DateTime, use24h: boolean): string {
  const date = datePhrase(target, now)
  const time = timePhrase(target, use24h)
  return date ? `${time} ${date}` : time
}

/** Every phrasing of the moment, shortest first. */
export function whenPhraseCandidates(target: DateTime, now: DateTime, use24h: boolean): string[] {
  const time = timePhrase(target, use24h)
  return dateRungs(target, now).map((date) => (date ? `${time} ${date}` : time))
}

function stubLocation(iana: string, displayName: string): LocationRef {
  return { iana, displayName, kind: 'city', resolveMethod: 'alias' }
}

/**
 * The instant `query` would land on, or null if it wouldn't survive the trip.
 * Only the time half is under test, so the locations are stubbed rather than
 * resolved.
 */
function roundTrip(query: string, from: string, to: string, sourceIana: string): DateTime | null {
  const { parsed } = parse(query)
  if (!parsed) return null
  // A query that reads back with different places is not the same question.
  if ((parsed.sourceLocation ?? '').toLowerCase() !== from.toLowerCase()) return null
  if (parsed.targetLocation.toLowerCase() !== to.toLowerCase()) return null

  const intent: ConversionIntent = {
    source: stubLocation(sourceIana, from),
    target: stubLocation(sourceIana, to),
    time: parsed.time,
    dateModifier: parsed.dateModifier,
  }
  const dt = DateTime.fromISO(convert(intent).sourceDateTime)
  return dt.isValid ? dt : null
}

/**
 * The shortest phrase that provably means the moment it is written for. Each
 * rung is re-parsed and re-converted in the source zone; the first that lands
 * back on `target` wins, and the most explicit rung is the floor.
 */
export function verifiedWhenPhrase(
  target: DateTime,
  now: DateTime,
  use24h: boolean,
  from: string,
  to: string,
  sourceIana: string,
): string {
  const candidates = whenPhraseCandidates(target, now, use24h)
  // Compared as instants, so the zone it came back in doesn't matter.
  const wanted = target.startOf('minute').toMillis()

  for (const phrase of candidates) {
    const landed = roundTrip(`${phrase} ${from} to ${to}`, from, to, sourceIana)
    if (landed && landed.startOf('minute').toMillis() === wanted) return phrase
  }
  return candidates[candidates.length - 1]
}

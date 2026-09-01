import { DateTime } from 'luxon'

/**
 * How a moment should be written back into the query.
 *
 * The rule is **minimal sufficient specificity**: say the least that still
 * identifies the moment, in the register the user was already using. Rewriting
 * "3pm nyc to london" as "17:00 2026-09-18 New York to London" is technically
 * correct and humanly worse — it is longer, colder, and no more precise for
 * something happening in two hours.
 *
 * The ladder, coarsest first:
 *   today      → "5pm"
 *   tomorrow   → "5pm tomorrow"
 *   yesterday  → "5pm yesterday"
 *   this week  → "5pm friday"
 *   this year  → "5pm 18 september"
 *   otherwise  → "5pm 18 september 2027"
 *
 * Each rung also has a shorter `d=` form in the URL, so a minimal phrase yields
 * a minimal link for free.
 */
export function timePhrase(dt: DateTime, use24h: boolean): string {
  if (use24h) return dt.toFormat('HH:mm')
  return dt.minute === 0 ? dt.toFormat('ha').toLowerCase() : dt.toFormat('h:mma').toLowerCase()
}

/** The date half of the phrase, or null when the day needs no mention at all. */
export function datePhrase(target: DateTime, now: DateTime): string | null {
  const day = target.startOf('day')
  const today = now.setZone(target.zoneName ?? undefined).startOf('day')
  const days = Math.round(day.diff(today, 'days').days)

  if (days === 0) return null
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  // Inside the coming week a weekday name is unambiguous and far more readable
  // than a date. Past that it stops being obvious which week is meant.
  if (days > 1 && days <= 6) return target.toFormat('cccc').toLowerCase()
  if (day.year === today.year) return `${target.day} ${target.toFormat('LLLL').toLowerCase()}`
  return `${target.day} ${target.toFormat('LLLL').toLowerCase()} ${target.year}`
}

/**
 * The full temporal phrase for a moment — e.g. `5pm friday`, `17:00`,
 * `9:30am 18 september 2027`.
 */
export function whenPhrase(target: DateTime, now: DateTime, use24h: boolean): string {
  const date = datePhrase(target, now)
  const time = timePhrase(target, use24h)
  return date ? `${time} ${date}` : time
}

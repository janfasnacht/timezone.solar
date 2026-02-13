import { DateTime } from 'luxon'
import type { TimeValue, TimezoneInfo, ConversionResult, ResolvedTimezone } from './types'

function buildTimezoneInfo(dt: DateTime, resolved: ResolvedTimezone): TimezoneInfo {
  return {
    formattedTime12: dt.toFormat('h:mm a'),
    formattedTime24: dt.toFormat('HH:mm'),
    abbreviation: dt.toFormat('ZZZZ'),
    iana: resolved.iana,
    city: resolved.city,
    country: resolved.country,
    isDST: dt.isInDST,
    offsetFromUTC: dt.toFormat('ZZ'),
    entitySlug: resolved.entitySlug,
  }
}

function formatOffsetDifference(sourceOffset: number, targetOffset: number): string {
  const diffMinutes = targetOffset - sourceOffset
  const sign = diffMinutes >= 0 ? '+' : '-'
  const absDiff = Math.abs(diffMinutes)
  const hours = Math.floor(absDiff / 60)
  const minutes = absDiff % 60

  if (minutes === 0) {
    return `${sign}${hours}h`
  }
  return `${sign}${hours}h ${minutes}m`
}

function getDayBoundary(sourceDt: DateTime, targetDt: DateTime): ConversionResult['dayBoundary'] {
  // Compare calendar days (ignoring timezone offsets)
  const sourceDay = sourceDt.ordinal + (sourceDt.year * 366)
  const targetDay = targetDt.ordinal + (targetDt.year * 366)
  const diff = targetDay - sourceDay

  if (diff === 0) return 'same day'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 0) return `+${diff} days`
  return `${diff} days`
}

function getDstNote(sourceDt: DateTime, targetDt: DateTime): string | null {
  const sourceInDst = sourceDt.isInDST
  const targetInDst = targetDt.isInDST

  if (sourceInDst && targetInDst) return 'DST active in both locations'
  if (sourceInDst) return 'DST active in source location'
  if (targetInDst) return 'DST active in target location'
  return null
}

export function swapResult(original: ConversionResult): ConversionResult {
  const sourceDt = DateTime.fromISO(original.targetDateTime)
  const targetDt = DateTime.fromISO(original.sourceDateTime)

  if (!sourceDt.isValid || !targetDt.isValid) {
    return original
  }

  const offsetDiff = formatOffsetDifference(sourceDt.offset, targetDt.offset)
  const dayBoundary = getDayBoundary(sourceDt, targetDt)
  const dstNote = getDstNote(sourceDt, targetDt)

  const now = DateTime.now()
  let relativeTime: string | null = null
  const diffFromNow = targetDt.diff(now, 'minutes').minutes
  if (Math.abs(diffFromNow) >= 1 && Math.abs(diffFromNow) < 24 * 60) {
    relativeTime = targetDt.toRelative() ?? null
  }

  return {
    source: {
      ...original.target,
      // Recalculate from the swapped perspective
      formattedTime12: sourceDt.toFormat('h:mm a'),
      formattedTime24: sourceDt.toFormat('HH:mm'),
      abbreviation: sourceDt.toFormat('ZZZZ'),
      isDST: sourceDt.isInDST,
      offsetFromUTC: sourceDt.toFormat('ZZ'),
    },
    target: {
      ...original.source,
      formattedTime12: targetDt.toFormat('h:mm a'),
      formattedTime24: targetDt.toFormat('HH:mm'),
      abbreviation: targetDt.toFormat('ZZZZ'),
      isDST: targetDt.isInDST,
      offsetFromUTC: targetDt.toFormat('ZZ'),
    },
    offsetDifference: offsetDiff,
    dayBoundary,
    dstNote,
    relativeTime,
    sourceDateTime: sourceDt.toISO() ?? '',
    targetDateTime: targetDt.toISO() ?? '',
    anchoredToTomorrow: false,
    anchorNote: null,
  }
}

export function convert(
  source: ResolvedTimezone,
  target: ResolvedTimezone,
  time: TimeValue | null,
  dateModifier: 'tomorrow' | 'yesterday' | 'today' | null = null,
  relativeMinutes: number | null = null,
): ConversionResult {
  const now = DateTime.now()

  let anchoredToTomorrow = false
  let anchorNote: string | null = null

  // Build source datetime
  let sourceDt: DateTime
  if (relativeMinutes !== null) {
    // Relative time: now + offset in source zone (no anchoring, no date modifier)
    sourceDt = now.plus({ minutes: relativeMinutes }).setZone(source.iana)
  } else if (time) {
    sourceDt = DateTime.fromObject(
      { hour: time.hour, minute: time.minute },
      { zone: source.iana }
    )
    // If the resulting time is ambiguous, use today's date
    if (!sourceDt.isValid) {
      sourceDt = DateTime.fromObject(
        { year: now.year, month: now.month, day: now.day, hour: time.hour, minute: time.minute },
        { zone: source.iana }
      )
    }

    // Apply date modifier
    if (dateModifier === 'tomorrow') {
      sourceDt = sourceDt.plus({ days: 1 })
    } else if (dateModifier === 'yesterday') {
      sourceDt = sourceDt.minus({ days: 1 })
    } else if (dateModifier === 'today') {
      // Explicit "today" — no-op, but prevents auto-anchoring
    } else {
      // No explicit modifier — temporal anchoring
      const nowInSource = now.setZone(source.iana)
      if (sourceDt < nowInSource) {
        sourceDt = sourceDt.plus({ days: 1 })
        anchoredToTomorrow = true
        const h12 = time.hour === 0 ? 12 : time.hour > 12 ? time.hour - 12 : time.hour
        const ampm = time.hour >= 12 ? 'pm' : 'am'
        const minStr = time.minute ? ':' + String(time.minute).padStart(2, '0') : ''
        anchorNote = `Showing tomorrow — ${h12}${minStr}${ampm} has passed in ${source.city}`
      }
    }
  } else {
    // No time specified — use current time in source timezone
    sourceDt = now.setZone(source.iana)

    // Apply date modifier even without explicit time
    if (dateModifier === 'tomorrow') {
      sourceDt = sourceDt.plus({ days: 1 })
    } else if (dateModifier === 'yesterday') {
      sourceDt = sourceDt.minus({ days: 1 })
    }
  }

  // Convert to target timezone
  const targetDt = sourceDt.setZone(target.iana)

  // Calculate offset difference
  const offsetDiff = formatOffsetDifference(sourceDt.offset, targetDt.offset)

  // Day boundary
  const dayBoundary = getDayBoundary(sourceDt, targetDt)

  // DST note
  const dstNote = getDstNote(sourceDt, targetDt)

  // Relative time from now
  let relativeTime: string | null = null
  const diffFromNow = targetDt.diff(now, 'minutes').minutes
  if (Math.abs(diffFromNow) >= 1 && Math.abs(diffFromNow) < 24 * 60) {
    relativeTime = targetDt.toRelative() ?? null
  }

  return {
    source: buildTimezoneInfo(sourceDt, source),
    target: buildTimezoneInfo(targetDt, target),
    offsetDifference: offsetDiff,
    dayBoundary,
    dstNote,
    relativeTime,
    sourceDateTime: sourceDt.toISO() ?? '',
    targetDateTime: targetDt.toISO() ?? '',
    anchoredToTomorrow,
    anchorNote,
  }
}

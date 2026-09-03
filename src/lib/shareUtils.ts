import { DateTime } from 'luxon'
import { formatEntityLabel } from '@/engine/entities'
import type { ConversionResult } from '@/engine/types'

/** Compact time: "3:00 PM" → "3pm", "11:30 AM" → "11.30am", "15:00" → "15.00" */
export function compactTime(time: string, is24h: boolean): string {
  if (is24h) return time.replace(':', '.')
  return time
    .replace(/:00\s*/i, '')       // drop :00
    .replace(/:/g, '.')           // 11:30 → 11.30
    .replace(/\s*(AM|PM)/i, (_, p: string) => p.toLowerCase()) // 3 PM → 3pm
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const mon = d.toLocaleDateString('en-US', { month: 'short' })
  return `${mon}${d.getDate()}`
}

/**
 * The conversion as one line, for pasting into a message. Both places, in the
 * order they were asked about; the weekday only when the two fall on different
 * days.
 */
export function conversionText(result: ConversionResult, use24h: boolean): string {
  const key = use24h ? 'formattedTime24' : 'formattedTime12'
  const sourceName = formatEntityLabel(result.source.entitySlug, result.source.city)
  const targetName = formatEntityLabel(result.target.entitySlug, result.target.city)

  const sameDay = result.dayBoundary === 'same day'
  const day = (iso: string) => {
    if (sameDay) return ''
    const dt = DateTime.fromISO(iso)
    return dt.isValid ? ` ${dt.toFormat('ccc')}` : ''
  }

  const source = `${result.source[key]}${day(result.sourceDateTime)} ${sourceName}`
  const target = `${result.target[key]}${day(result.targetDateTime)} ${targetName}`
  return `${source} \u2192 ${target}`
}

import type { ConversionResult, DateModifier, DayOfWeek } from '@/engine/types'

export interface CanonicalQuery {
  fromIana: string
  toIana: string
  hour: number | null
  minute: number | null
  dateModifier: DateModifier
}

const VALID_DAYS: Record<string, DayOfWeek> = {
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
}

const VALID_ANCHORS = ['next', 'this', 'last'] as const

export function serializeDateModifier(mod: DateModifier): string | null {
  if (!mod) return null
  if (typeof mod === 'string') return mod // 'tomorrow' | 'yesterday' | 'today'
  if (mod.type === 'date') {
    const mm = String(mod.month).padStart(2, '0')
    const dd = String(mod.day).padStart(2, '0')
    // Year omitted when the query didn't name one, so the link keeps meaning
    // "the next 14th of March" rather than freezing to a past year.
    return mod.year ? `${mod.year}-${mm}-${dd}` : `${mm}-${dd}`
  }
  // DayOfWeekModifier
  if (mod.anchor === 'bare') return mod.day
  return `${mod.anchor}-${mod.day}`
}

export function parseDateModifier(s: string): DateModifier {
  if (s === 'tomorrow' || s === 'yesterday' || s === 'today') return s

  const withYear = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (withYear) {
    return { type: 'date', year: Number(withYear[1]), month: Number(withYear[2]), day: Number(withYear[3]) }
  }
  const noYear = s.match(/^(\d{2})-(\d{2})$/)
  if (noYear) {
    return { type: 'date', year: null, month: Number(noYear[1]), day: Number(noYear[2]) }
  }

  // Try "anchor-day" format (e.g., "next-monday")
  const dashIdx = s.indexOf('-')
  if (dashIdx > 0) {
    const anchor = s.slice(0, dashIdx)
    const day = s.slice(dashIdx + 1)
    if (
      VALID_ANCHORS.includes(anchor as typeof VALID_ANCHORS[number]) &&
      day in VALID_DAYS
    ) {
      return {
        type: 'day-of-week',
        anchor: anchor as 'next' | 'this' | 'last',
        day: VALID_DAYS[day],
      }
    }
  }

  // Bare day name (e.g., "monday")
  if (s in VALID_DAYS) {
    return { type: 'day-of-week', anchor: 'bare', day: VALID_DAYS[s] }
  }

  return null
}

/**
 * Build canonical URL search params from a conversion result.
 * Returns null only for relative time queries (e.g., "in 2 hours").
 * For "now" queries, omits the `t` param (receiver sees current time).
 */
export function buildCanonicalParams(result: ConversionResult): URLSearchParams | null {
  if (result.intent.time.type === 'relative') return null

  const params = new URLSearchParams()
  params.set('from', result.source.iana)
  params.set('to', result.target.iana)

  if (result.intent.time.type === 'absolute') {
    params.set('t', `${String(result.intent.time.hour).padStart(2, '0')}:${String(result.intent.time.minute).padStart(2, '0')}`)
  }

  const d = serializeDateModifier(result.intent.dateModifier)
  if (d) params.set('d', d)

  return params
}

/**
 * Parse canonical params from URL search params.
 * Returns null if required params are missing or invalid.
 * When `t` is omitted, hour/minute are null (meaning "now").
 */
export function parseCanonicalParams(params: URLSearchParams): CanonicalQuery | null {
  const from = params.get('from')
  const to = params.get('to')

  if (!from || !to) return null

  const t = params.get('t')
  let hour: number | null = null
  let minute: number | null = null

  if (t) {
    const timeMatch = t.match(/^(\d{1,2}):(\d{2})$/)
    if (!timeMatch) return null
    hour = parseInt(timeMatch[1], 10)
    minute = parseInt(timeMatch[2], 10)
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  }

  const d = params.get('d')
  const dateModifier = d ? parseDateModifier(d) : null

  return { fromIana: from, toIana: to, hour, minute, dateModifier }
}

/**
 * Build a full canonical URL for sharing.
 * Falls back to ?q= form for non-canonicalizable results.
 */
export function buildCanonicalUrl(result: ConversionResult, query: string, view?: 'card' | 'map'): string {
  const canonical = buildCanonicalParams(result)
  const url = new URL('https://timezone.solar')

  if (canonical) {
    canonical.forEach((v, k) => url.searchParams.set(k, v))
  } else {
    url.searchParams.set('q', query)
  }

  if (view === 'map') url.searchParams.set('view', 'map')
  return url.toString()
}

/** Display-friendly canonical URL, for the share menu's link row. */
export function formatCanonicalDisplay(result: ConversionResult, query: string): string {
  const canonical = buildCanonicalParams(result)
  if (!canonical) return `timezone.solar?q=${query}`
  return `timezone.solar?${canonical.toString()}`
}

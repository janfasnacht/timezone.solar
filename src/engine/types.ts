export type TokenType = 'TIME' | 'CONNECTOR' | 'LOCATION' | 'DATE_MODIFIER'

export interface Token {
  type: TokenType
  value: string
  raw: string
  /** Position in the input, before noise was dropped — see mergeLocationTokens. */
  index?: number
  /** Last position covered, once a merge has widened the token. */
  endIndex?: number
}

// --- TimeRef: discriminated union replacing TimeValue + relativeMinutes ---

export type TimeRef =
  | { type: 'now' }
  | { type: 'absolute'; hour: number; minute: number }
  | { type: 'relative'; minutes: number }

// --- LocationRef: replaces ResolvedTimezone ---

export type LocationKind = 'city' | 'country' | 'region' | 'timezone'

export interface LocationRef {
  iana: string
  displayName: string
  kind: LocationKind
  country?: string
  entitySlug?: string
  resolveMethod: 'entity' | 'alias' | 'state' | 'abbreviation' | 'utc-offset' | 'city-db' | 'fuzzy'
  interpretedAs?: string
  /**
   * The words the user actually typed for this location ("nyc"). Absent when the
   * query came from canonical URL params. Write-backs prefer this over
   * displayName so editing a query doesn't quietly rewrite the user's own words.
   */
  input?: string
}

// --- ParsedQuery ---

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export type DayOfWeekModifier = {
  type: 'day-of-week'
  day: DayOfWeek
  anchor: 'next' | 'this' | 'last' | 'bare'
}

/**
 * A calendar date named outright. `year` is null when the query didn't say one
 * ("14 march"), in which case the converter picks the next occurrence.
 */
export type AbsoluteDate = {
  type: 'date'
  year: number | null
  /** 1-12 */
  month: number
  /** 1-31 */
  day: number
}

export type DateModifier =
  | 'tomorrow'
  | 'yesterday'
  | 'today'
  | DayOfWeekModifier
  | AbsoluteDate
  | null

export interface ParsedQuery {
  sourceLocation: string | null
  targetLocation: string
  time: TimeRef
  dateModifier: DateModifier
}

// --- ResolveResult ---

export interface ResolveResult {
  primary: LocationRef
  alternatives: LocationRef[]
}

// --- TimezoneInfo (display type, unchanged for components) ---

export interface TimezoneInfo {
  formattedTime12: string
  formattedTime24: string
  abbreviation: string
  iana: string
  city: string
  country?: string
  isDST: boolean
  offsetFromUTC: string
  entitySlug?: string
}

// --- ConversionIntent ---

export interface ConversionIntent {
  source: LocationRef
  target: LocationRef
  time: TimeRef
  dateModifier: DateModifier
}

// --- ConversionResult ---

export interface ConversionResult {
  intent: ConversionIntent
  source: TimezoneInfo
  target: TimezoneInfo
  offsetDifference: string
  dayBoundary: 'same day' | 'tomorrow' | 'yesterday' | string
  dstNote: string | null
  relativeTime: string | null
  sourceDateTime: string
  targetDateTime: string
  anchoredToTomorrow: boolean
  anchorNote: string | null
}

export interface ConversionError {
  type: 'parse' | 'resolve-source' | 'resolve-target' | 'conversion'
  message: string
  suggestion?: string
}

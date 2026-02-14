export type TokenType = 'TIME' | 'CONNECTOR' | 'LOCATION' | 'DATE_MODIFIER'

export interface Token {
  type: TokenType
  value: string
  raw: string
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
  resolveMethod: 'entity' | 'alias' | 'state' | 'abbreviation' | 'city-db' | 'fuzzy'
  interpretedAs?: string
}

// --- ParsedQuery ---

export type DateModifier = 'tomorrow' | 'yesterday' | 'today' | null

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

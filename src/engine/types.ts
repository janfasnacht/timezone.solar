export type TokenType = 'TIME' | 'CONNECTOR' | 'LOCATION' | 'DATE_MODIFIER'

export interface Token {
  type: TokenType
  value: string
  raw: string
}

export interface TimeValue {
  hour: number
  minute: number
}

export interface ParsedQuery {
  sourceLocation: string | null
  targetLocation: string
  time: TimeValue | null
  dateModifier: 'tomorrow' | 'yesterday' | 'today' | null
  relativeMinutes: number | null
}

export interface ResolvedTimezone {
  iana: string
  city: string
  country?: string
  method: 'entity' | 'alias' | 'state' | 'abbreviation' | 'city-db' | 'fuzzy'
  entitySlug?: string
  interpretedAs?: string
}

export interface ResolveResult {
  primary: ResolvedTimezone
  alternatives: ResolvedTimezone[]
}

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

export interface ConversionResult {
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

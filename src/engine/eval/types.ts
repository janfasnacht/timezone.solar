import type { ParsedQuery, TimeRef, DateModifier, LocationKind } from '../types'

// --- Test case (canonical definition, replaces duplicates in parser-eval.test.ts and scripts/eval-types.ts) ---

export interface TestCase {
  id: number
  input: string
  expectedSource: string | null
  expectedTarget: string | null
  expectedTime: TimeRef
  expectedDateModifier: DateModifier
  expectedTier: 1 | 2 | 3
  expectedSourceKind?: LocationKind
  expectedTargetKind?: LocationKind
  difficultyTags: string[]
  notes: string
  set: 'realistic' | 'edge' | 'regression'
  split?: 'dev' | 'eval'
  persona?: string
}

// --- Parser adapter interface ---

export interface ParserResult {
  parsed: ParsedQuery | null
  tier?: 1 | 2 | 3
  confidence?: number
}

export interface ParserAdapter {
  name: string
  parse(input: string): ParserResult
  sourceFiles?: string[]
}

// --- Per-case assertion result ---

export interface ParseAssertionResult {
  passed: boolean
  sourceMatch: boolean
  targetMatch: boolean
  timeMatch: boolean
  dateModifierMatch: boolean
  parseReturned: boolean
}

// --- Scorecard types ---

export interface CalibrationBucket {
  range: [number, number]
  predictedConfidence: number
  actualAccuracy: number
  count: number
}

export interface EvalScorecard {
  adapterName: string
  totalCases: number
  accuracy: {
    overall: number
    bySet: Record<string, number>
    byField: { source: number; target: number; time: number; dateMod: number }
    byTag: Record<string, number>
  }
  tierSafety: number
  tierAccuracy: number | null
  latency: { p50: number; p95: number; mean: number }
  complexity: { loc: number; regexCount: number } | null
  calibration: CalibrationBucket[] | null
  composite: number
}

import type { ParsedQuery, TimeRef, DateModifier } from '../types'

// --- Test case ---

/** Where a case's expectations came from. `generated-from-parser` cannot fail. */
export type CaseProvenance =
  | 'generated-from-parser'
  | 'hand-written'
  | 'adversarial'
  | 'from-survey'

export interface TestCase {
  id: number
  input: string

  // --- Extraction: what the parser should pull out of the string ---
  expectedSource: string | null
  expectedTarget: string | null
  expectedTime: TimeRef
  expectedDateModifier: DateModifier
  expectedTier: 1 | 2 | 3

  // --- Resolution: where those strings should land ---
  // `undefined` is unannotated and unscored; `null` must not resolve.
  expectedSourceIana?: string | null
  expectedTargetIana?: string | null
  /** The query names more than one real place, e.g. bare `portland`. */
  expectedAmbiguous?: boolean

  difficultyTags: string[]
  notes: string
  set: 'realistic' | 'edge' | 'regression' | 'adversarial'
  split?: 'dev' | 'eval'
  persona?: string
  provenance?: CaseProvenance
}

// --- Parser adapter interface ---

export interface ParserResult {
  parsed: ParsedQuery | null
  tier?: 1 | 2 | 3
  confidence?: number
  /** What the extracted strings resolve to on the path the product uses. */
  resolution?: {
    sourceIana: string | null
    targetIana: string | null
    /** Distinct-zone alternatives were offered for at least one side. */
    ambiguous: boolean
  }
}

export interface ParserAdapter {
  name: string
  parse(input: string): ParserResult
  /** Hand-written logic files for the complexity metric. Data files excluded. */
  sourceFiles?: string[]
}

// --- Per-case resolution result ---

export interface ResolveAssertionResult {
  /** False when unannotated; the other fields are then meaningless. */
  annotated: boolean
  passed: boolean
  sourceMatch: boolean
  targetMatch: boolean
  ambiguityMatch: boolean
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

export interface ResolutionMetrics {
  /** How many cases carry a resolution annotation at all. */
  annotated: number
  /** Of the annotated cases, how many resolve to the expected zone on both sides. */
  accuracy: number | null
  byField: { source: number | null; target: number | null }
  bySet: Record<string, number>
  /** Parse succeeded and every name resolved. Anything else is an error card. */
  answerRate: number
  /**
   * Complements, so higher is always better: `compare.ts` reads any decrease as
   * a regression and has no notion of direction.
   */
  confidentAnswerable: number
  confidentCorrect: number | null
  /** Of cases annotated ambiguous, how many were offered alternatives. */
  ambiguityRecall: number | null
}

export interface EvalScorecard {
  adapterName: string
  totalCases: number
  accuracy: {
    overall: number
    bySet: Record<string, number>
    byField: { source: number; target: number; time: number; dateMod: number }
    byTag: Record<string, number>
    byProvenance: Record<string, number>
  }
  resolution: ResolutionMetrics
  /** Denominators, for the saturation flag. */
  setCounts: Record<string, number>
  provenanceCounts: Record<string, number>
  tierSafety: number
  tierAccuracy: number | null
  latency: { p50: number; p95: number; mean: number }
  complexity: { loc: number; regexCount: number } | null
  calibration: CalibrationBucket[] | null
  composite: number
  /** Ids of cases that did not pass, ascending. */
  failingCaseIds: number[]
}

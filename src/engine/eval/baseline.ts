/**
 * The committed scorecard a run is compared against. Records the numbers and
 * what produced them, so a score change and a fixture change stay separable.
 */

import { createHash } from 'node:crypto'
import type { TestCase, EvalScorecard } from './types'
import { filterBySet, groupByTag } from './fixture'

// --- Baseline shape ---

export interface BaselineMetric {
  /** Metric value, rounded to ROUNDING decimal places. */
  value: number
  /** How many cases the value was measured over. */
  n: number
}

export interface EvalBaseline {
  adapter: string
  fixture: {
    caseCount: number
    /** sha256 over the extraction expectations of every case, id-sorted. */
    expectationsHash: string
    /** sha256 over the resolution annotations, for the cases that carry one. */
    resolutionHash: string
    setCounts: Record<string, number>
  }
  metrics: Record<string, BaselineMetric>
  /** Recorded for review, not asserted as a set of permitted failures. */
  failingCases: Array<{ id: number; input: string }>
}

/** Four places separates a single case in any group. */
const ROUNDING = 4

function round(n: number): number {
  return Number(n.toFixed(ROUNDING))
}

// --- Fixture provenance ---

function sha256(value: unknown): string {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

/**
 * Hash of what the parser should extract. Prose fields are excluded.
 *
 * The tuple is positional and frozen: appending to it moves every committed
 * hash. Resolution annotations get their own hash instead. The two `null` slots
 * held `expectedSourceKind`/`expectedTargetKind`.
 */
export function hashExpectations(cases: TestCase[]): string {
  return sha256(
    [...cases]
      .sort((a, b) => a.id - b.id)
      .map((tc) => [
        tc.id,
        tc.input,
        tc.expectedSource,
        tc.expectedTarget,
        tc.expectedTime,
        tc.expectedDateModifier,
        tc.expectedTier,
        null,
        null,
        tc.set,
        tc.split ?? null,
      ])
  )
}

/** Hash the resolution annotations. Unannotated cases contribute nothing. */
export function hashResolutions(cases: TestCase[]): string {
  return sha256(
    [...cases]
      .filter((tc) =>
        tc.expectedSourceIana !== undefined ||
        tc.expectedTargetIana !== undefined ||
        tc.expectedAmbiguous !== undefined
      )
      .sort((a, b) => a.id - b.id)
      .map((tc) => [
        tc.id,
        tc.expectedSourceIana ?? null,
        tc.expectedTargetIana ?? null,
        tc.expectedAmbiguous ?? null,
      ])
  )
}

// --- Scorecard → gated metrics ---

/**
 * Flatten the reproducible parts of a scorecard into a dotted metric map.
 * Latency, complexity and the composite are excluded: latency varies by machine.
 */
export function toMetricMap(sc: EvalScorecard, cases: TestCase[]): Record<string, BaselineMetric> {
  const metrics: Record<string, BaselineMetric> = {}
  const total = cases.length

  metrics['accuracy.overall'] = { value: round(sc.accuracy.overall), n: total }

  for (const [set, acc] of Object.entries(sc.accuracy.bySet)) {
    metrics[`accuracy.set.${set}`] = {
      value: round(acc),
      n: filterBySet(cases, set as TestCase['set']).length,
    }
  }

  for (const [field, acc] of Object.entries(sc.accuracy.byField)) {
    metrics[`accuracy.field.${field}`] = { value: round(acc), n: total }
  }

  const tagGroups = groupByTag(cases)
  for (const [tag, acc] of Object.entries(sc.accuracy.byTag)) {
    metrics[`accuracy.tag.${tag}`] = { value: round(acc), n: tagGroups.get(tag)?.length ?? 0 }
  }

  metrics['tierSafety'] = {
    value: round(sc.tierSafety),
    n: cases.filter((tc) => tc.expectedTier === 1).length,
  }

  if (sc.tierAccuracy !== null) {
    metrics['tierAccuracy'] = { value: round(sc.tierAccuracy), n: total }
  }

  for (const [prov, acc] of Object.entries(sc.accuracy.byProvenance)) {
    metrics[`accuracy.provenance.${prov}`] = {
      value: round(acc),
      n: cases.filter((tc) => tc.provenance === prov).length,
    }
  }

  // --- Resolution ---
  const r = sc.resolution
  const answerable = cases.filter((tc) => tc.expectedTarget !== null).length

  metrics['resolution.answerRate'] = { value: round(r.answerRate), n: answerable }
  metrics['resolution.confidentAnswerable'] = {
    value: round(r.confidentAnswerable),
    n: answerable,
  }

  if (r.accuracy !== null) {
    metrics['resolution.accuracy'] = { value: round(r.accuracy), n: r.annotated }
  }
  if (r.byField.source !== null) {
    metrics['resolution.field.source'] = { value: round(r.byField.source), n: r.annotated }
  }
  if (r.byField.target !== null) {
    metrics['resolution.field.target'] = { value: round(r.byField.target), n: r.annotated }
  }
  for (const [set, acc] of Object.entries(r.bySet)) {
    metrics[`resolution.set.${set}`] = {
      value: round(acc),
      n: filterBySet(cases, set as TestCase['set']).filter(isAnnotated).length,
    }
  }
  if (r.confidentCorrect !== null) {
    metrics['resolution.confidentCorrect'] = {
      value: round(r.confidentCorrect),
      n: cases.filter(isAnnotated).length,
    }
  }
  if (r.ambiguityRecall !== null) {
    metrics['resolution.ambiguityRecall'] = {
      value: round(r.ambiguityRecall),
      n: cases.filter((tc) => tc.expectedAmbiguous === true).length,
    }
  }

  return metrics
}

function isAnnotated(tc: TestCase): boolean {
  return (
    tc.expectedSourceIana !== undefined ||
    tc.expectedTargetIana !== undefined ||
    tc.expectedAmbiguous !== undefined
  )
}

export function buildBaseline(sc: EvalScorecard, cases: TestCase[]): EvalBaseline {
  const byId = new Map(cases.map((tc) => [tc.id, tc]))
  const setCounts: Record<string, number> = {}
  for (const tc of cases) setCounts[tc.set] = (setCounts[tc.set] ?? 0) + 1

  return {
    adapter: sc.adapterName,
    fixture: {
      caseCount: cases.length,
      expectationsHash: hashExpectations(cases),
      resolutionHash: hashResolutions(cases),
      setCounts,
    },
    metrics: toMetricMap(sc, cases),
    failingCases: sc.failingCaseIds.map((id) => ({ id, input: byId.get(id)?.input ?? '' })),
  }
}

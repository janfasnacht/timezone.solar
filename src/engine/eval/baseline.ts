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
    /** sha256 over the ground-truth fields of every case, id-sorted. */
    expectationsHash: string
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

/**
 * Hash the fields that define the right answer. Prose fields (`notes`,
 * `persona`, `difficultyTags`) are excluded: they describe a case, they are not
 * the case, and churning them should not read as a ground-truth change.
 */
export function hashExpectations(cases: TestCase[]): string {
  const canonical = [...cases]
    .sort((a, b) => a.id - b.id)
    .map((tc) => [
      tc.id,
      tc.input,
      tc.expectedSource,
      tc.expectedTarget,
      tc.expectedTime,
      tc.expectedDateModifier,
      tc.expectedTier,
      tc.expectedSourceKind ?? null,
      tc.expectedTargetKind ?? null,
      tc.set,
      tc.split ?? null,
    ])
  return 'sha256:' + createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
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

  const tagGroups = groupByTag(filterBySet(cases, 'edge'))
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

  return metrics
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
      setCounts,
    },
    metrics: toMetricMap(sc, cases),
    failingCases: sc.failingCaseIds.map((id) => ({ id, input: byId.get(id)?.input ?? '' })),
  }
}

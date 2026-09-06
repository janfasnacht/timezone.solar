/**
 * Parser evaluation. Cases report into the scorecard; the scorecard is the only
 * assertion, so a failing case is not a failing run. What fails the run is a
 * difference from `__fixtures__/parser-eval.baseline.json`.
 *
 * Run: `npm run eval`. Rebaseline: `npm run eval:baseline`.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { parserAdapter } from './adapter'
import type { EvalBaseline } from '@/engine/eval'
import {
  loadFixture,
  runEvaluation,
  printScorecard,
  printFailures,
  buildBaseline,
  compareToBaseline,
  formatComparison,
  pinEvalEnvironment,
} from '@/engine/eval'

const BASELINE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '__fixtures__/parser-eval.baseline.json'
)

pinEvalEnvironment()

const cases = loadFixture()
const scorecard = runEvaluation(parserAdapter, cases)
const current = buildBaseline(scorecard, cases)

printScorecard(scorecard)
printFailures(parserAdapter, cases, scorecard)

describe('eval baseline', () => {
  it('matches the committed baseline', () => {
    let baseline: EvalBaseline
    try {
      baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    } catch {
      throw new Error(`No baseline at ${BASELINE_PATH}. Run \`npm run eval:baseline\`.`)
    }
    const comparison = compareToBaseline(baseline, current)
    expect(comparison.clean, formatComparison(comparison)).toBe(true)
  })
})

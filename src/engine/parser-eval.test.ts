/**
 * Parser evaluation test harness.
 *
 * Loads test cases from __fixtures__/parser-eval.json and evaluates
 * the parser against ground truth. Reports per-suite accuracy and
 * aggregate metrics via the eval/ scorecard module.
 *
 * Run: npm run eval
 * Filter: npx vitest run src/engine/parser-eval.test.ts --grep "edge:typo"
 */

import { describe, it, expect } from 'vitest'
import { v2 } from './v2/adapter'
import type { TestCase } from '@/engine/eval'
import {
  loadFixture,
  filterBySet,
  filterBySplit,
  groupByTag,
  assertParseResult,
  runEvaluation,
  printScorecard,
} from '@/engine/eval'

// --- Load fixture ---

const cases = loadFixture()
const realisticCases = filterBySet(cases, 'realistic')
const realisticDev = filterBySplit(realisticCases, 'dev')
const realisticEval = filterBySplit(realisticCases, 'eval')
const edgeCases = filterBySet(cases, 'edge')
const regressionCases = filterBySet(cases, 'regression')
const edgeByTag = groupByTag(edgeCases)

// --- Per-case test helper ---

function runCaseTest(tc: TestCase) {
  const r = assertParseResult(v2, tc)
  if (!r.passed) {
    const { parsed } = v2.parse(tc.input)
    expect.soft(r.sourceMatch, `source: got "${parsed?.sourceLocation}" expected "${tc.expectedSource}"`).toBe(true)
    expect.soft(r.targetMatch, `target: got "${parsed?.targetLocation}" expected "${tc.expectedTarget}"`).toBe(true)
    expect.soft(r.timeMatch, `time: got ${JSON.stringify(parsed?.time)} expected ${JSON.stringify(tc.expectedTime)}`).toBe(true)
    expect.soft(r.dateModifierMatch, `dateModifier: got "${parsed?.dateModifier}" expected "${tc.expectedDateModifier}"`).toBe(true)
  }
  expect(r.passed).toBe(true)
}

// --- Test suites ---

if (realisticDev.length > 0) {
  describe('realistic (dev split)', () => {
    it.each(realisticDev.map((tc) => [tc.id, tc.input, tc]))(
      'case #%i: %s',
      (_id, _input, tc) => runCaseTest(tc as TestCase)
    )
  })
}

if (realisticEval.length > 0) {
  describe('realistic (eval split)', () => {
    it.each(realisticEval.map((tc) => [tc.id, tc.input, tc]))(
      'case #%i: %s',
      (_id, _input, tc) => runCaseTest(tc as TestCase)
    )
  })
}

describe('edge cases', () => {
  for (const [tag, tagCases] of edgeByTag) {
    describe(`edge:${tag}`, () => {
      it.each(tagCases.map((tc) => [tc.id, tc.input, tc]))(
        'case #%i: %s',
        (_id, _input, tc) => runCaseTest(tc as TestCase)
      )
    })
  }
})

if (regressionCases.length > 0) {
  describe('regression', () => {
    it.each(regressionCases.map((tc) => [tc.id, tc.input, tc]))(
      'case #%i: %s',
      (_id, _input, tc) => runCaseTest(tc as TestCase)
    )
  })
}

// --- Scorecard ---

describe('scorecard', () => {
  it('reports full eval scorecard', () => {
    const scorecard = runEvaluation(v2, cases)
    printScorecard(scorecard)
    expect(scorecard.totalCases).toBe(cases.length)
  })
})

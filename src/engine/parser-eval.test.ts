/**
 * Parser evaluation test harness.
 *
 * Loads test cases from __fixtures__/parser-eval.json and evaluates
 * the parser against ground truth. Reports per-suite accuracy and
 * aggregate metrics.
 *
 * Run: npm run eval
 * Filter: npx vitest run src/engine/parser-eval.test.ts --grep "edge:typo"
 */

import { describe, it, expect } from 'vitest'
import { parse } from './parser'
import type { TimeRef, DateModifier, LocationKind } from './types'
import fixture from './__fixtures__/parser-eval.json'

// --- TestCase type (mirrors scripts/eval-types.ts but standalone for test file) ---

interface TestCase {
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

const cases = fixture as TestCase[]

// --- Helpers ---

function timeRefEqual(a: TimeRef, b: TimeRef): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'now') return true
  if (a.type === 'absolute' && b.type === 'absolute') {
    return a.hour === b.hour && a.minute === b.minute
  }
  if (a.type === 'relative' && b.type === 'relative') {
    return a.minutes === b.minutes
  }
  return false
}

interface ParseAssertionResult {
  passed: boolean
  sourceMatch: boolean
  targetMatch: boolean
  timeMatch: boolean
  dateModifierMatch: boolean
  parseReturned: boolean
}

function assertParseResult(tc: TestCase): ParseAssertionResult {
  const result = parse(tc.input)

  // If expected target is null, we expect parse to return null
  if (tc.expectedTarget === null) {
    const parseReturned = result !== null
    return {
      passed: result === null,
      sourceMatch: true,
      targetMatch: result === null,
      timeMatch: true,
      dateModifierMatch: true,
      parseReturned,
    }
  }

  if (!result) {
    return {
      passed: false,
      sourceMatch: false,
      targetMatch: false,
      timeMatch: false,
      dateModifierMatch: false,
      parseReturned: false,
    }
  }

  const sourceMatch = result.sourceLocation === tc.expectedSource
  const targetMatch = result.targetLocation === tc.expectedTarget
  const timeMatch = timeRefEqual(result.time, tc.expectedTime)
  const dateModifierMatch = result.dateModifier === tc.expectedDateModifier

  return {
    passed: sourceMatch && targetMatch && timeMatch && dateModifierMatch,
    sourceMatch,
    targetMatch,
    timeMatch,
    dateModifierMatch,
    parseReturned: true,
  }
}

// --- Split cases by set ---

const realisticCases = cases.filter((tc) => tc.set === 'realistic')
const realisticDev = realisticCases.filter((tc) => tc.split === 'dev')
const realisticEval = realisticCases.filter((tc) => tc.split === 'eval')
const edgeCases = cases.filter((tc) => tc.set === 'edge')
const regressionCases = cases.filter((tc) => tc.set === 'regression')

// Group edge cases by primary difficulty tag
const edgeByTag = new Map<string, TestCase[]>()
for (const tc of edgeCases) {
  for (const tag of tc.difficultyTags) {
    if (!edgeByTag.has(tag)) edgeByTag.set(tag, [])
    edgeByTag.get(tag)!.push(tc)
  }
}

// --- Test suites ---

if (realisticDev.length > 0) {
  describe('realistic (dev split)', () => {
    it.each(realisticDev.map((tc) => [tc.id, tc.input, tc]))(
      'case #%i: %s',
      (_id, _input, tc) => {
        const r = assertParseResult(tc as TestCase)
        if (!r.passed) {
          const result = parse((tc as TestCase).input)
          expect.soft(r.sourceMatch, `source: got "${result?.sourceLocation}" expected "${(tc as TestCase).expectedSource}"`).toBe(true)
          expect.soft(r.targetMatch, `target: got "${result?.targetLocation}" expected "${(tc as TestCase).expectedTarget}"`).toBe(true)
          expect.soft(r.timeMatch, `time: got ${JSON.stringify(result?.time)} expected ${JSON.stringify((tc as TestCase).expectedTime)}`).toBe(true)
          expect.soft(r.dateModifierMatch, `dateModifier: got "${result?.dateModifier}" expected "${(tc as TestCase).expectedDateModifier}"`).toBe(true)
        }
        expect(r.passed).toBe(true)
      }
    )
  })
}

if (realisticEval.length > 0) {
  describe('realistic (eval split)', () => {
    it.each(realisticEval.map((tc) => [tc.id, tc.input, tc]))(
      'case #%i: %s',
      (_id, _input, tc) => {
        const r = assertParseResult(tc as TestCase)
        if (!r.passed) {
          const result = parse((tc as TestCase).input)
          expect.soft(r.sourceMatch, `source: got "${result?.sourceLocation}" expected "${(tc as TestCase).expectedSource}"`).toBe(true)
          expect.soft(r.targetMatch, `target: got "${result?.targetLocation}" expected "${(tc as TestCase).expectedTarget}"`).toBe(true)
          expect.soft(r.timeMatch, `time: got ${JSON.stringify(result?.time)} expected ${JSON.stringify((tc as TestCase).expectedTime)}`).toBe(true)
          expect.soft(r.dateModifierMatch, `dateModifier: got "${result?.dateModifier}" expected "${(tc as TestCase).expectedDateModifier}"`).toBe(true)
        }
        expect(r.passed).toBe(true)
      }
    )
  })
}

describe('edge cases', () => {
  for (const [tag, tagCases] of edgeByTag) {
    describe(`edge:${tag}`, () => {
      it.each(tagCases.map((tc) => [tc.id, tc.input, tc]))(
        'case #%i: %s',
        (_id, _input, tc) => {
          const r = assertParseResult(tc as TestCase)
          if (!r.passed) {
            const result = parse((tc as TestCase).input)
            expect.soft(r.sourceMatch, `source: got "${result?.sourceLocation}" expected "${(tc as TestCase).expectedSource}"`).toBe(true)
            expect.soft(r.targetMatch, `target: got "${result?.targetLocation}" expected "${(tc as TestCase).expectedTarget}"`).toBe(true)
            expect.soft(r.timeMatch, `time: got ${JSON.stringify(result?.time)} expected ${JSON.stringify((tc as TestCase).expectedTime)}`).toBe(true)
            expect.soft(r.dateModifierMatch, `dateModifier: got "${result?.dateModifier}" expected "${(tc as TestCase).expectedDateModifier}"`).toBe(true)
          }
          expect(r.passed).toBe(true)
        }
      )
    })
  }
})

if (regressionCases.length > 0) {
  describe('regression', () => {
    it.each(regressionCases.map((tc) => [tc.id, tc.input, tc]))(
      'case #%i: %s',
      (_id, _input, tc) => {
        const r = assertParseResult(tc as TestCase)
        if (!r.passed) {
          const result = parse((tc as TestCase).input)
          expect.soft(r.sourceMatch, `source: got "${result?.sourceLocation}" expected "${(tc as TestCase).expectedSource}"`).toBe(true)
          expect.soft(r.targetMatch, `target: got "${result?.targetLocation}" expected "${(tc as TestCase).expectedTarget}"`).toBe(true)
          expect.soft(r.timeMatch, `time: got ${JSON.stringify(result?.time)} expected ${JSON.stringify((tc as TestCase).expectedTime)}`).toBe(true)
          expect.soft(r.dateModifierMatch, `dateModifier: got "${result?.dateModifier}" expected "${(tc as TestCase).expectedDateModifier}"`).toBe(true)
        }
        expect(r.passed).toBe(true)
      }
    )
  })
}

// --- Metrics suite ---

describe('metrics', () => {
  it('reports parse accuracy across all sets', () => {
    const setNames = ['realistic', 'edge', 'regression'] as const
    const sets = { realistic: realisticCases, edge: edgeCases, regression: regressionCases }

    console.log('\n=== Parser Evaluation Metrics ===\n')

    let totalPassed = 0
    let totalCases = 0

    for (const setName of setNames) {
      const setCases = sets[setName]
      if (setCases.length === 0) continue

      let passed = 0
      let sourcePassed = 0
      let targetPassed = 0
      let timePassed = 0
      let dateModPassed = 0

      for (const tc of setCases) {
        const r = assertParseResult(tc)
        if (r.passed) passed++
        if (r.sourceMatch) sourcePassed++
        if (r.targetMatch) targetPassed++
        if (r.timeMatch) timePassed++
        if (r.dateModifierMatch) dateModPassed++
      }

      totalPassed += passed
      totalCases += setCases.length

      const pct = (n: number) => ((n / setCases.length) * 100).toFixed(1)
      console.log(`[${setName}] (${setCases.length} cases)`)
      console.log(`  Overall:       ${passed}/${setCases.length} (${pct(passed)}%)`)
      console.log(`  Source match:  ${sourcePassed}/${setCases.length} (${pct(sourcePassed)}%)`)
      console.log(`  Target match:  ${targetPassed}/${setCases.length} (${pct(targetPassed)}%)`)
      console.log(`  Time match:    ${timePassed}/${setCases.length} (${pct(timePassed)}%)`)
      console.log(`  DateMod match: ${dateModPassed}/${setCases.length} (${pct(dateModPassed)}%)`)
      console.log()
    }

    // Per-dimension breakdown for edge cases
    if (edgeCases.length > 0) {
      console.log('Edge case breakdown by dimension:')
      for (const [tag, tagCases] of [...edgeByTag.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        let passed = 0
        for (const tc of tagCases) {
          if (assertParseResult(tc).passed) passed++
        }
        console.log(`  ${tag}: ${passed}/${tagCases.length} (${((passed / tagCases.length) * 100).toFixed(1)}%)`)
      }
      console.log()
    }

    // Tier safety: among Tier 1 expected cases, how many does the parser actually get right?
    const tier1Cases = cases.filter((tc) => tc.expectedTier === 1)
    if (tier1Cases.length > 0) {
      let tier1Correct = 0
      for (const tc of tier1Cases) {
        if (assertParseResult(tc).passed) tier1Correct++
      }
      console.log(`Tier safety (Tier 1 accuracy): ${tier1Correct}/${tier1Cases.length} (${((tier1Correct / tier1Cases.length) * 100).toFixed(1)}%)`)
    }

    console.log(`\nTotal: ${totalPassed}/${totalCases} (${((totalPassed / totalCases) * 100).toFixed(1)}%)`)

    // This test always passes — it's for reporting, not gating
    expect(true).toBe(true)
  })
})

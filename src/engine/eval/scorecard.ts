import type { TimeRef, DateModifier } from '../types'
import type {
  TestCase,
  ParserAdapter,
  ParseAssertionResult,
  EvalScorecard,
} from './types'
import { groupByTag, filterBySet } from './fixture'
import { computeComposite, calibrationCurve, complexityMetric, percentile } from './metrics'

// --- Assertion logic ---

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

function dateModifierEqual(a: DateModifier, b: DateModifier): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a === 'string' || typeof b === 'string') return a === b
  return a.type === b.type && a.day === b.day && a.anchor === b.anchor
}

export function assertParseResult(adapter: ParserAdapter, tc: TestCase): ParseAssertionResult {
  const { parsed } = adapter.parse(tc.input)

  if (tc.expectedTarget === null) {
    const parseReturned = parsed !== null
    return {
      passed: parsed === null,
      sourceMatch: true,
      targetMatch: parsed === null,
      timeMatch: true,
      dateModifierMatch: true,
      parseReturned,
    }
  }

  if (!parsed) {
    return {
      passed: false,
      sourceMatch: false,
      targetMatch: false,
      timeMatch: false,
      dateModifierMatch: false,
      parseReturned: false,
    }
  }

  const sourceMatch = parsed.sourceLocation === tc.expectedSource
  const targetMatch = parsed.targetLocation === tc.expectedTarget
  const timeMatch = timeRefEqual(parsed.time, tc.expectedTime)
  const dateModifierMatch = dateModifierEqual(parsed.dateModifier, tc.expectedDateModifier)

  return {
    passed: sourceMatch && targetMatch && timeMatch && dateModifierMatch,
    sourceMatch,
    targetMatch,
    timeMatch,
    dateModifierMatch,
    parseReturned: true,
  }
}

// --- Main orchestrator ---

const WARMUP_RUNS = 2
const TIMED_RUNS = 10

export function runEvaluation(adapter: ParserAdapter, cases: TestCase[]): EvalScorecard {
  // --- Per-case results + latency ---
  const results: Array<{ tc: TestCase; assertion: ParseAssertionResult; medianMs: number }> = []

  for (const tc of cases) {
    // Warmup
    for (let i = 0; i < WARMUP_RUNS; i++) adapter.parse(tc.input)

    // Timed runs
    const timings: number[] = []
    let assertion!: ParseAssertionResult
    for (let i = 0; i < TIMED_RUNS; i++) {
      const start = performance.now()
      const { parsed } = adapter.parse(tc.input)
      const end = performance.now()
      timings.push(end - start)
      // Use last run for assertion (all should be identical)
      if (i === TIMED_RUNS - 1) {
        // Re-run through assertParseResult for consistent assertion logic
        assertion = assertParseResult(adapter, tc)
        // Suppress unused variable — parsed is consumed by timing
        void parsed
      }
    }
    timings.sort((a, b) => a - b)
    const medianMs = percentile(timings, 50)
    results.push({ tc, assertion, medianMs })
  }

  // --- Accuracy ---
  const total = cases.length
  let overallPassed = 0
  let sourcePassed = 0
  let targetPassed = 0
  let timePassed = 0
  let dateModPassed = 0

  for (const { assertion: r } of results) {
    if (r.passed) overallPassed++
    if (r.sourceMatch) sourcePassed++
    if (r.targetMatch) targetPassed++
    if (r.timeMatch) timePassed++
    if (r.dateModifierMatch) dateModPassed++
  }

  // By set
  const bySet: Record<string, number> = {}
  for (const set of ['realistic', 'edge', 'regression'] as const) {
    const setCases = filterBySet(cases, set)
    if (setCases.length === 0) continue
    const setIds = new Set(setCases.map((tc) => tc.id))
    const setResults = results.filter((r) => setIds.has(r.tc.id))
    bySet[set] = setResults.filter((r) => r.assertion.passed).length / setCases.length
  }

  // By tag
  const byTag: Record<string, number> = {}
  const tagGroups = groupByTag(filterBySet(cases, 'edge'))
  for (const [tag, tagCases] of tagGroups) {
    const tagIds = new Set(tagCases.map((tc) => tc.id))
    const tagResults = results.filter((r) => tagIds.has(r.tc.id))
    byTag[tag] = tagResults.filter((r) => r.assertion.passed).length / tagCases.length
  }

  // --- Tier safety (Tier 1 expected accuracy) ---
  const tier1Cases = results.filter((r) => r.tc.expectedTier === 1)
  const tierSafety = tier1Cases.length > 0
    ? tier1Cases.filter((r) => r.assertion.passed).length / tier1Cases.length
    : 1.0

  // --- Tier accuracy (only when adapter produces tiers) ---
  const adapterResults = cases.map((tc) => adapter.parse(tc.input))
  const hasTiers = adapterResults.some((r) => r.tier !== undefined)
  let tierAccuracy: number | null = null
  if (hasTiers) {
    let tierMatches = 0
    for (let i = 0; i < cases.length; i++) {
      if (adapterResults[i].tier === cases[i].expectedTier) tierMatches++
    }
    tierAccuracy = tierMatches / cases.length
  }

  // --- Latency ---
  const allTimings = results.map((r) => r.medianMs).sort((a, b) => a - b)
  const latency = {
    p50: percentile(allTimings, 50),
    p95: percentile(allTimings, 95),
    mean: allTimings.reduce((s, v) => s + v, 0) / allTimings.length,
  }

  // --- Complexity ---
  const complexity = adapter.sourceFiles ? complexityMetric(adapter.sourceFiles) : null

  // --- Calibration ---
  const hasConfidence = adapterResults.some((r) => r.confidence !== undefined)
  let calibration = null
  if (hasConfidence) {
    const calData = results.map((r, i) => ({
      confidence: adapterResults[i].confidence!,
      correct: r.assertion.passed,
    })).filter((d) => d.confidence !== undefined)
    calibration = calibrationCurve(calData)
  }

  // --- Assemble scorecard (without composite, then compute it) ---
  const partial = {
    adapterName: adapter.name,
    totalCases: total,
    accuracy: {
      overall: overallPassed / total,
      bySet,
      byField: {
        source: sourcePassed / total,
        target: targetPassed / total,
        time: timePassed / total,
        dateMod: dateModPassed / total,
      },
      byTag,
    },
    tierSafety,
    tierAccuracy,
    latency,
    complexity,
    calibration,
  }

  return { ...partial, composite: computeComposite(partial) }
}

// --- Console output ---

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

function ms(n: number): string {
  return n.toFixed(2) + 'ms'
}

export function printScorecard(sc: EvalScorecard): void {
  console.log(`\n=== Eval Scorecard: ${sc.adapterName} ===\n`)
  console.log(`Total cases: ${sc.totalCases}`)
  console.log(`\nAccuracy (overall): ${pct(sc.accuracy.overall)}`)

  for (const [set, acc] of Object.entries(sc.accuracy.bySet)) {
    console.log(`  ${set}: ${pct(acc)}`)
  }

  console.log(`\nPer-field accuracy:`)
  console.log(`  Source:   ${pct(sc.accuracy.byField.source)}`)
  console.log(`  Target:   ${pct(sc.accuracy.byField.target)}`)
  console.log(`  Time:     ${pct(sc.accuracy.byField.time)}`)
  console.log(`  DateMod:  ${pct(sc.accuracy.byField.dateMod)}`)

  if (Object.keys(sc.accuracy.byTag).length > 0) {
    console.log(`\nEdge case breakdown by tag:`)
    for (const [tag, acc] of Object.entries(sc.accuracy.byTag).sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${tag}: ${pct(acc)}`)
    }
  }

  console.log(`\nTier safety (Tier 1): ${pct(sc.tierSafety)}`)
  console.log(`Tier accuracy:        ${sc.tierAccuracy !== null ? pct(sc.tierAccuracy) : 'N/A'}`)

  console.log(`\nLatency:`)
  console.log(`  p50:  ${ms(sc.latency.p50)}`)
  console.log(`  p95:  ${ms(sc.latency.p95)}`)
  console.log(`  mean: ${ms(sc.latency.mean)}`)

  if (sc.complexity) {
    console.log(`\nComplexity:`)
    console.log(`  LOC:         ${sc.complexity.loc}`)
    console.log(`  Regex count: ${sc.complexity.regexCount}`)
  }

  if (sc.calibration) {
    console.log(`\nCalibration:`)
    for (const b of sc.calibration) {
      console.log(`  [${b.range[0].toFixed(1)}-${b.range[1].toFixed(1)}] predicted=${b.predictedConfidence.toFixed(2)} actual=${b.actualAccuracy.toFixed(2)} (n=${b.count})`)
    }
  } else {
    console.log(`\nCalibration: N/A`)
  }

  console.log(`\nComposite score: ${sc.composite.toFixed(3)}`)
}

export function printComparisonTable(scorecards: EvalScorecard[]): void {
  if (scorecards.length === 0) return

  const nameWidth = 22
  const colWidth = 16

  const header = 'Metric'.padEnd(nameWidth) + scorecards.map((sc) => sc.adapterName.padStart(colWidth)).join('')
  const sep = '='.repeat(header.length)

  console.log(`\n${sep}`)
  console.log(`=== Parser Comparison ===`)
  console.log(sep)
  console.log(header)
  console.log('-'.repeat(header.length))

  const row = (label: string, fn: (sc: EvalScorecard) => string) => {
    console.log(label.padEnd(nameWidth) + scorecards.map((sc) => fn(sc).padStart(colWidth)).join(''))
  }

  row('Accuracy (overall)', (sc) => pct(sc.accuracy.overall))
  row('Tier safety', (sc) => pct(sc.tierSafety))
  row('Tier accuracy', (sc) => sc.tierAccuracy !== null ? pct(sc.tierAccuracy) : 'N/A')
  row('Latency p50', (sc) => ms(sc.latency.p50))
  row('Latency p95', (sc) => ms(sc.latency.p95))
  row('Complexity (LOC)', (sc) => sc.complexity ? String(sc.complexity.loc) : 'N/A')
  row('Calibration', (sc) => sc.calibration ? 'yes' : 'N/A')
  row('Composite', (sc) => sc.composite.toFixed(3))

  console.log(sep)
}

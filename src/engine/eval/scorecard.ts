import type { TimeRef, DateModifier } from '../types'
import type {
  TestCase,
  ParserAdapter,
  ParserResult,
  ParseAssertionResult,
  ResolveAssertionResult,
  ResolutionMetrics,
  EvalScorecard,
} from './types'
import { groupByTag, filterBySet, SETS } from './fixture'
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
  if (a.type !== b.type) return false
  if (a.type === 'date' && b.type === 'date') {
    return a.year === b.year && a.month === b.month && a.day === b.day
  }
  if (a.type === 'day-of-week' && b.type === 'day-of-week') {
    return a.day === b.day && a.anchor === b.anchor
  }
  return false
}

export function assertParseResult(adapter: ParserAdapter, tc: TestCase): ParseAssertionResult {
  return assertParsed(adapter.parse(tc.input), tc)
}

export function assertParsed(result: ParserResult, tc: TestCase): ParseAssertionResult {
  const { parsed } = result

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

// --- Resolution assertion ---

/** An unannotated case is kept out of every denominator, not counted as a pass. */
export function assertResolution(result: ParserResult, tc: TestCase): ResolveAssertionResult {
  const wantsSource = tc.expectedSourceIana !== undefined
  const wantsTarget = tc.expectedTargetIana !== undefined
  const wantsAmbiguity = tc.expectedAmbiguous !== undefined

  if (!wantsSource && !wantsTarget && !wantsAmbiguity) {
    return { annotated: false, passed: false, sourceMatch: false, targetMatch: false, ambiguityMatch: false }
  }

  const got = result.resolution ?? { sourceIana: null, targetIana: null, ambiguous: false }
  const sourceMatch = !wantsSource || got.sourceIana === tc.expectedSourceIana
  const targetMatch = !wantsTarget || got.targetIana === tc.expectedTargetIana
  const ambiguityMatch = !wantsAmbiguity || got.ambiguous === tc.expectedAmbiguous

  return {
    annotated: true,
    passed: sourceMatch && targetMatch && ambiguityMatch,
    sourceMatch,
    targetMatch,
    ambiguityMatch,
  }
}

/** Null for cases whose expected answer is "no answer". */
function answered(result: ParserResult, tc: TestCase): boolean | null {
  if (tc.expectedTarget === null) return null
  const { parsed, resolution } = result
  if (!parsed || !resolution) return false
  if (resolution.targetIana === null) return false
  if (parsed.sourceLocation !== null && resolution.sourceIana === null) return false
  return true
}

// --- Main orchestrator ---

const WARMUP_RUNS = 2
const TIMED_RUNS = 10

export function runEvaluation(adapter: ParserAdapter, cases: TestCase[]): EvalScorecard {
  // One adapter call per case feeds every assertion below.
  type CaseResult = {
    tc: TestCase
    result: ParserResult
    assertion: ParseAssertionResult
    resolution: ResolveAssertionResult
    answered: boolean | null
    medianMs: number
  }
  const results: CaseResult[] = []

  for (const tc of cases) {
    for (let i = 0; i < WARMUP_RUNS; i++) adapter.parse(tc.input)

    const timings: number[] = []
    let result!: ParserResult
    for (let i = 0; i < TIMED_RUNS; i++) {
      const start = performance.now()
      result = adapter.parse(tc.input)
      timings.push(performance.now() - start)
    }
    timings.sort((a, b) => a - b)

    results.push({
      tc,
      result,
      assertion: assertParsed(result, tc),
      resolution: assertResolution(result, tc),
      answered: answered(result, tc),
      medianMs: percentile(timings, 50),
    })
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

  const rate = (matching: number, of: number): number => (of > 0 ? matching / of : 0)
  const groupRate = (
    subset: CaseResult[],
    passed: (r: CaseResult) => boolean
  ): number => rate(subset.filter(passed).length, subset.length)

  // By set
  const bySet: Record<string, number> = {}
  for (const set of SETS) {
    const setResults = results.filter((r) => r.tc.set === set)
    if (setResults.length === 0) continue
    bySet[set] = groupRate(setResults, (r) => r.assertion.passed)
  }

  const byProvenance: Record<string, number> = {}
  for (const p of new Set(cases.map((tc) => tc.provenance).filter(Boolean))) {
    const group = results.filter((r) => r.tc.provenance === p)
    byProvenance[p as string] = groupRate(group, (r) => r.assertion.passed)
  }

  // By tag
  const byTag: Record<string, number> = {}
  const tagGroups = groupByTag(filterBySet(cases, 'edge'))
  for (const [tag, tagCases] of tagGroups) {
    const tagIds = new Set(tagCases.map((tc) => tc.id))
    byTag[tag] = groupRate(results.filter((r) => tagIds.has(r.tc.id)), (r) => r.assertion.passed)
  }

  // --- Tier safety (Tier 1 expected accuracy) ---
  const tier1Cases = results.filter((r) => r.tc.expectedTier === 1)
  const tierSafety = tier1Cases.length > 0
    ? groupRate(tier1Cases, (r) => r.assertion.passed)
    : 1.0

  // --- Tier accuracy (only when adapter produces tiers) ---
  const hasTiers = results.some((r) => r.result.tier !== undefined)
  const tierAccuracy = hasTiers
    ? groupRate(results, (r) => r.result.tier === r.tc.expectedTier)
    : null

  // --- Resolution ---
  const annotated = results.filter((r) => r.resolution.annotated)
  const answerable = results.filter((r) => r.answered !== null)
  const confident = results.filter((r) => r.result.tier === 1 && r.answered !== null)
  const confidentAnnotated = confident.filter((r) => r.resolution.annotated)
  const ambiguous = results.filter((r) => r.tc.expectedAmbiguous === true)

  const resolutionBySet: Record<string, number> = {}
  for (const set of SETS) {
    const group = annotated.filter((r) => r.tc.set === set)
    if (group.length === 0) continue
    resolutionBySet[set] = groupRate(group, (r) => r.resolution.passed)
  }

  const resolution: ResolutionMetrics = {
    annotated: annotated.length,
    accuracy: annotated.length > 0 ? groupRate(annotated, (r) => r.resolution.passed) : null,
    byField: {
      source: annotated.length > 0 ? groupRate(annotated, (r) => r.resolution.sourceMatch) : null,
      target: annotated.length > 0 ? groupRate(annotated, (r) => r.resolution.targetMatch) : null,
    },
    bySet: resolutionBySet,
    answerRate: groupRate(answerable, (r) => r.answered === true),
    // Complements: see ResolutionMetrics.
    confidentAnswerable: groupRate(confident, (r) => r.answered === true),
    confidentCorrect: confidentAnnotated.length > 0
      ? groupRate(confidentAnnotated, (r) => r.resolution.passed)
      : null,
    ambiguityRecall: ambiguous.length > 0
      ? groupRate(ambiguous, (r) => r.resolution.ambiguityMatch)
      : null,
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
  const hasConfidence = results.some((r) => r.result.confidence !== undefined)
  const calibration = hasConfidence
    ? calibrationCurve(results.map((r) => ({
        confidence: r.result.confidence!,
        correct: r.assertion.passed,
      })))
    : null

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
      byProvenance,
    },
    resolution,
    setCounts: Object.fromEntries(SETS.map((set) => [set, results.filter((r) => r.tc.set === set).length]).filter(([, n]) => (n as number) > 0)),
    provenanceCounts: Object.fromEntries(
      Object.keys(byProvenance).map((p) => [p, results.filter((r) => r.tc.provenance === p).length])
    ),
    tierSafety,
    tierAccuracy,
    latency,
    complexity,
    calibration,
    failingCaseIds: results.filter((r) => !r.assertion.passed).map((r) => r.tc.id).sort((a, b) => a - b),
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

/** Flags a gated metric that has nothing left to measure. */
function saturation(value: number, n: number): string {
  return value === 1 && n > 50 ? '  (saturated — nothing left to measure)' : ''
}

export function printScorecard(sc: EvalScorecard): void {
  const r = sc.resolution
  console.log(`\n=== Eval Scorecard: ${sc.adapterName} ===\n`)
  console.log(`Total cases: ${sc.totalCases}`)

  console.log(`\nAnswer rate (parse and resolve): ${pct(r.answerRate)}`)
  console.log(`  of results served at tier 1:   ${pct(r.confidentAnswerable)}`)

  console.log(
    `\nExtraction accuracy (overall): ${pct(sc.accuracy.overall)}` +
    saturation(sc.accuracy.overall, sc.totalCases)
  )

  for (const [set, acc] of Object.entries(sc.accuracy.bySet)) {
    console.log(`  ${set}: ${pct(acc)}${saturation(acc, sc.setCounts[set] ?? 0)}`)
  }

  if (Object.keys(sc.accuracy.byProvenance).length > 0) {
    console.log(`\nBy provenance:`)
    for (const [prov, acc] of Object.entries(sc.accuracy.byProvenance).sort()) {
      console.log(`  ${prov}: ${pct(acc)}${saturation(acc, sc.provenanceCounts[prov] ?? 0)}`)
    }
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

  console.log(`\nResolution:`)
  console.log(`  Annotated cases: ${r.annotated}`)
  if (r.accuracy !== null) {
    console.log(`  Accuracy:        ${pct(r.accuracy)}`)
    console.log(`    source: ${r.byField.source !== null ? pct(r.byField.source) : 'N/A'}`)
    console.log(`    target: ${r.byField.target !== null ? pct(r.byField.target) : 'N/A'}`)
  } else {
    console.log(`  Accuracy:        N/A — no case says where a name should land yet`)
  }
  if (r.confidentCorrect !== null) console.log(`  Confident+correct: ${pct(r.confidentCorrect)}`)
  if (r.ambiguityRecall !== null) console.log(`  Ambiguity recall:  ${pct(r.ambiguityRecall)}`)

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

/** The run asserts only the scorecard, so this is where per-case detail surfaces. */
export function printFailures(adapter: ParserAdapter, cases: TestCase[], sc: EvalScorecard): void {
  if (sc.failingCaseIds.length === 0) {
    console.log(`\nNo failing cases.`)
    return
  }

  const byId = new Map(cases.map((tc) => [tc.id, tc]))
  console.log(`\n=== Failing cases (${sc.failingCaseIds.length}) ===\n`)

  for (const id of sc.failingCaseIds) {
    const tc = byId.get(id)
    if (!tc) continue
    const r = assertParseResult(adapter, tc)
    const { parsed } = adapter.parse(tc.input)
    const tags = tc.difficultyTags.length > 0 ? ` [${tc.difficultyTags.join(', ')}]` : ''
    console.log(`#${id} ${tc.set}${tags}: "${tc.input}"`)
    if (!r.sourceMatch) console.log(`  source:  got ${JSON.stringify(parsed?.sourceLocation ?? null)} want ${JSON.stringify(tc.expectedSource)}`)
    if (!r.targetMatch) console.log(`  target:  got ${JSON.stringify(parsed?.targetLocation ?? null)} want ${JSON.stringify(tc.expectedTarget)}`)
    if (!r.timeMatch) console.log(`  time:    got ${JSON.stringify(parsed?.time)} want ${JSON.stringify(tc.expectedTime)}`)
    if (!r.dateModifierMatch) console.log(`  dateMod: got ${JSON.stringify(parsed?.dateModifier)} want ${JSON.stringify(tc.expectedDateModifier)}`)
    if (tc.notes) console.log(`  notes:   ${tc.notes}`)
  }
}

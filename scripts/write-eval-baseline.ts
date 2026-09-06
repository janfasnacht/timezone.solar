/**
 * Regenerate the committed eval baseline: `npm run eval:baseline`.
 * Only when the run legitimately differs — never to silence a regression.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parserAdapter } from '../src/engine/adapter'
import {
  loadFixture,
  runEvaluation,
  buildBaseline,
  compareToBaseline,
  pinEvalEnvironment,
} from '../src/engine/eval'
import type { EvalBaseline } from '../src/engine/eval'

const OUT = resolve(import.meta.dirname, '../src/engine/__fixtures__/parser-eval.baseline.json')

pinEvalEnvironment()

const cases = loadFixture()
const scorecard = runEvaluation(parserAdapter, cases)
const next = buildBaseline(scorecard, cases)

let previous: EvalBaseline | null = null
try {
  previous = JSON.parse(readFileSync(OUT, 'utf-8'))
} catch {
  // No baseline yet.
}

const serialized = JSON.stringify(next, null, 2) + '\n'
const unchanged = previous !== null && JSON.stringify(previous, null, 2) + '\n' === serialized
if (!unchanged) writeFileSync(OUT, serialized)

console.log(`${unchanged ? 'Unchanged' : 'Wrote'} ${OUT}`)
console.log(`  ${next.fixture.caseCount} cases, ${next.fixture.expectationsHash}`)
console.log(`  accuracy ${(next.metrics['accuracy.overall'].value * 100).toFixed(2)}%, ${next.failingCases.length} failing`)

if (previous) {
  const { diffs } = compareToBaseline(previous, next)
  if (diffs.length === 0) {
    console.log('\nNo change from the previous baseline.')
  } else {
    console.log('\nChanged:')
    for (const d of diffs) console.log(`  [${d.kind}] ${d.detail}`)
    if (diffs.some((d) => d.kind === 'regression')) {
      console.log('\nThis baseline records a regression. That is almost never what you want.')
    }
  }
}

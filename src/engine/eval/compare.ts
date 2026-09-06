/**
 * Compare a fresh scorecard against the committed baseline.
 *
 *   fixture     — the ground truth moved; scores are no longer comparable
 *   shape       — a metric appeared or disappeared
 *   regression  — a number went down
 *   improvement — a number went up, or which cases fail changed
 *
 * Only a regression means something is broken. All four fail the run: a stale
 * baseline has stopped being a measurement.
 */

import type { EvalBaseline, BaselineMetric } from './baseline'

export type DiffKind = 'fixture' | 'shape' | 'regression' | 'improvement'

export interface BaselineDiff {
  kind: DiffKind
  detail: string
}

export interface BaselineComparison {
  diffs: BaselineDiff[]
  regressions: BaselineDiff[]
  /** True when the run matches the baseline exactly. */
  clean: boolean
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + '%'
}

function compareMetrics(
  baseline: Record<string, BaselineMetric>,
  current: Record<string, BaselineMetric>
): BaselineDiff[] {
  const diffs: BaselineDiff[] = []
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].sort()

  for (const key of keys) {
    const before = baseline[key]
    const after = current[key]

    if (!before) {
      diffs.push({ kind: 'shape', detail: `${key}: new metric, now ${pct(after.value)} (n=${after.n})` })
      continue
    }
    if (!after) {
      diffs.push({ kind: 'shape', detail: `${key}: metric gone, was ${pct(before.value)} (n=${before.n})` })
      continue
    }
    if (before.n !== after.n) {
      diffs.push({ kind: 'fixture', detail: `${key}: measured over ${after.n} cases, baseline says ${before.n}` })
    }
    if (after.value < before.value) {
      diffs.push({
        kind: 'regression',
        detail: `${key}: ${pct(before.value)} → ${pct(after.value)} (${pct(after.value - before.value)})`,
      })
    } else if (after.value > before.value) {
      diffs.push({
        kind: 'improvement',
        detail: `${key}: ${pct(before.value)} → ${pct(after.value)} (+${pct(after.value - before.value)})`,
      })
    }
  }

  return diffs
}

export function compareToBaseline(baseline: EvalBaseline, current: EvalBaseline): BaselineComparison {
  const diffs: BaselineDiff[] = []

  if (baseline.fixture.caseCount !== current.fixture.caseCount) {
    diffs.push({
      kind: 'fixture',
      detail: `case count ${baseline.fixture.caseCount} → ${current.fixture.caseCount}`,
    })
  }
  if (baseline.fixture.expectationsHash !== current.fixture.expectationsHash) {
    diffs.push({
      kind: 'fixture',
      detail: `expectations hash changed — ground truth was edited, so the scores below are measured against a different exam`,
    })
  }
  if (baseline.adapter !== current.adapter) {
    diffs.push({ kind: 'shape', detail: `adapter ${baseline.adapter} → ${current.adapter}` })
  }

  diffs.push(...compareMetrics(baseline.metrics, current.metrics))

  // Catches a trade that nets to zero.
  const was = new Set(baseline.failingCases.map((c) => c.id))
  const now = new Set(current.failingCases.map((c) => c.id))
  const fixed = [...was].filter((id) => !now.has(id))
  const broken = [...now].filter((id) => !was.has(id))

  if (broken.length > 0) {
    const inputs = current.failingCases.filter((c) => broken.includes(c.id))
    diffs.push({
      kind: 'regression',
      detail: `cases newly failing: ${inputs.map((c) => `#${c.id} "${c.input}"`).join(', ')}`,
    })
  }
  if (fixed.length > 0) {
    const inputs = baseline.failingCases.filter((c) => fixed.includes(c.id))
    diffs.push({
      kind: 'improvement',
      detail: `cases now passing: ${inputs.map((c) => `#${c.id} "${c.input}"`).join(', ')}`,
    })
  }

  const regressions = diffs.filter((d) => d.kind === 'regression')
  return { diffs, regressions, clean: diffs.length === 0 }
}

export function formatComparison(c: BaselineComparison): string {
  if (c.clean) return 'Eval matches baseline.'

  const lines: string[] = []
  const order: DiffKind[] = ['fixture', 'regression', 'shape', 'improvement']
  const headings: Record<DiffKind, string> = {
    regression: 'REGRESSION — a number went down:',
    fixture: 'FIXTURE CHANGED — the ground truth moved:',
    shape: 'SHAPE CHANGED — the set of metrics moved:',
    improvement: 'IMPROVEMENT — not a failure, but the baseline no longer describes the run:',
  }

  for (const kind of order) {
    const group = c.diffs.filter((d) => d.kind === kind)
    if (group.length === 0) continue
    lines.push('', headings[kind])
    for (const d of group) lines.push(`  ${d.detail}`)
  }

  const fixtureMoved = c.diffs.some((d) => d.kind === 'fixture')

  lines.push('')
  if (fixtureMoved) {
    lines.push(
      'The fixture changed, so any score difference above may be an artefact of the new',
      'ground truth rather than a parser change. Review the fixture diff on its own terms',
      'first, then run `npm run eval:baseline` and commit both diffs together.'
    )
  } else if (c.regressions.length > 0) {
    lines.push('Fix the regression. Do not regenerate the baseline to make it go away.')
  } else {
    lines.push('Nothing got worse. Run `npm run eval:baseline` and commit the diff in this change.')
  }

  return lines.join('\n')
}

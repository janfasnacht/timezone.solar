import { describe, it, expect } from 'vitest'
import { compareToBaseline, formatComparison } from './compare'
import { hashExpectations } from './baseline'
import type { EvalBaseline } from './baseline'
import type { TestCase } from './types'

function baseline(over: Partial<EvalBaseline> = {}): EvalBaseline {
  return {
    adapter: 'v2',
    fixture: { caseCount: 100, expectationsHash: 'sha256:abc', setCounts: { edge: 100 } },
    metrics: {
      'accuracy.overall': { value: 0.9, n: 100 },
      'accuracy.tag.typo': { value: 1, n: 10 },
    },
    failingCases: [{ id: 7, input: 'nyc londn' }],
    ...over,
  }
}

function testCase(over: Partial<TestCase> = {}): TestCase {
  return {
    id: 1,
    input: 'NYC to London',
    expectedSource: 'NYC',
    expectedTarget: 'London',
    expectedTime: { type: 'now' },
    expectedDateModifier: null,
    expectedTier: 1,
    difficultyTags: [],
    notes: '',
    set: 'realistic',
    ...over,
  }
}

describe('compareToBaseline', () => {
  it('is clean when nothing moved', () => {
    const c = compareToBaseline(baseline(), baseline())
    expect(c.clean).toBe(true)
    expect(formatComparison(c)).toBe('Eval matches baseline.')
  })

  it('reports a drop as a regression', () => {
    const after = baseline({
      metrics: { 'accuracy.overall': { value: 0.85, n: 100 }, 'accuracy.tag.typo': { value: 1, n: 10 } },
    })
    const c = compareToBaseline(baseline(), after)
    expect(c.regressions).toHaveLength(1)
    expect(c.regressions[0].detail).toContain('90.00% → 85.00%')
  })

  it('reports a rise as an improvement, not a regression', () => {
    const after = baseline({
      metrics: { 'accuracy.overall': { value: 0.95, n: 100 }, 'accuracy.tag.typo': { value: 1, n: 10 } },
    })
    const c = compareToBaseline(baseline(), after)
    expect(c.regressions).toHaveLength(0)
    expect(c.clean).toBe(false)
    expect(formatComparison(c)).toContain('npm run eval:baseline')
  })

  it('catches a trade that nets to zero', () => {
    const before = baseline({
      metrics: {
        'accuracy.overall': { value: 0.9, n: 100 },
        'accuracy.tag.typo': { value: 0.8, n: 10 },
        'accuracy.tag.noise': { value: 1, n: 10 },
      },
    })
    const after = baseline({
      metrics: {
        'accuracy.overall': { value: 0.9, n: 100 },
        'accuracy.tag.typo': { value: 1, n: 10 },
        'accuracy.tag.noise': { value: 0.8, n: 10 },
      },
    })
    const c = compareToBaseline(before, after)
    expect(c.regressions.map((d) => d.detail)).toEqual([
      expect.stringContaining('accuracy.tag.noise'),
    ])
  })

  it('catches a swap of which cases fail when the score is flat', () => {
    const after = baseline({ failingCases: [{ id: 9, input: 'berlin toyko' }] })
    const c = compareToBaseline(baseline(), after)
    expect(c.clean).toBe(false)
    expect(c.regressions[0].detail).toContain('#9')
    expect(c.diffs.some((d) => d.kind === 'improvement' && d.detail.includes('#7'))).toBe(true)
  })

  it('separates a ground-truth change from a score change', () => {
    const after = baseline({
      fixture: { caseCount: 100, expectationsHash: 'sha256:def', setCounts: { edge: 100 } },
    })
    const c = compareToBaseline(baseline(), after)
    expect(c.diffs.map((d) => d.kind)).toEqual(['fixture'])
    expect(formatComparison(c)).toContain('Review the fixture diff on its own terms')
  })

  it('reports a new metric as a shape change rather than an improvement', () => {
    const after = baseline({
      metrics: { ...baseline().metrics, 'accuracy.tag.endonym': { value: 0.5, n: 12 } },
    })
    const c = compareToBaseline(baseline(), after)
    expect(c.diffs).toEqual([{ kind: 'shape', detail: expect.stringContaining('new metric') }])
  })

  it('reports a changed denominator as a fixture change', () => {
    const after = baseline({
      metrics: { ...baseline().metrics, 'accuracy.tag.typo': { value: 1, n: 14 } },
    })
    const c = compareToBaseline(baseline(), after)
    expect(c.diffs).toEqual([{ kind: 'fixture', detail: expect.stringContaining('measured over 14 cases') }])
  })
})

describe('hashExpectations', () => {
  it('ignores prose fields', () => {
    const a = [testCase()]
    const b = [testCase({ notes: 'rewritten', persona: 'chaos', difficultyTags: ['typo'] })]
    expect(hashExpectations(a)).toBe(hashExpectations(b))
  })

  it('moves when an expectation moves', () => {
    expect(hashExpectations([testCase()])).not.toBe(
      hashExpectations([testCase({ expectedTarget: 'Londres' })])
    )
  })

  it('moves when the input moves', () => {
    expect(hashExpectations([testCase()])).not.toBe(
      hashExpectations([testCase({ input: 'NYC to Londn' })])
    )
  })

  it('does not depend on case order', () => {
    const a = [testCase({ id: 1 }), testCase({ id: 2, input: 'Tokyo' })]
    expect(hashExpectations(a)).toBe(hashExpectations([...a].reverse()))
  })
})

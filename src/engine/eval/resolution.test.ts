import { describe, it, expect } from 'vitest'
import { assertResolution } from './scorecard'
import { hashExpectations, hashResolutions } from './baseline'
import type { TestCase, ParserResult } from './types'

function testCase(over: Partial<TestCase> = {}): TestCase {
  return {
    id: 1,
    input: 'portland maine',
    expectedSource: null,
    expectedTarget: 'portland maine',
    expectedTime: { type: 'now' },
    expectedDateModifier: null,
    expectedTier: 1,
    difficultyTags: [],
    notes: '',
    set: 'edge',
    ...over,
  }
}

function result(over: Partial<NonNullable<ParserResult['resolution']>> = {}): ParserResult {
  return {
    parsed: { sourceLocation: null, targetLocation: 'portland maine', time: { type: 'now' }, dateModifier: null },
    tier: 1,
    confidence: 0.9,
    resolution: { sourceIana: null, targetIana: 'America/New_York', ambiguous: false, ...over },
  }
}

describe('assertResolution', () => {
  it('does not score a case that carries no annotation', () => {
    const r = assertResolution(result(), testCase())
    expect(r.annotated).toBe(false)
    expect(r.passed).toBe(false)
  })

  it('passes when the target lands where the case says', () => {
    const r = assertResolution(result(), testCase({ expectedTargetIana: 'America/New_York' }))
    expect(r).toMatchObject({ annotated: true, passed: true, targetMatch: true })
  })

  it('fails when it lands somewhere else', () => {
    const r = assertResolution(
      result({ targetIana: 'America/Los_Angeles' }),
      testCase({ expectedTargetIana: 'America/New_York' })
    )
    expect(r.passed).toBe(false)
    expect(r.targetMatch).toBe(false)
  })

  it('treats an explicit null as "must not resolve", distinct from unannotated', () => {
    const mustNotResolve = testCase({ expectedTargetIana: null })
    expect(assertResolution(result({ targetIana: null }), mustNotResolve).passed).toBe(true)
    expect(assertResolution(result(), mustNotResolve).passed).toBe(false)
  })

  it('scores ambiguity on its own', () => {
    const tc = testCase({ expectedAmbiguous: true })
    expect(assertResolution(result({ ambiguous: true }), tc).passed).toBe(true)
    expect(assertResolution(result({ ambiguous: false }), tc).passed).toBe(false)
  })

  it('fails an annotated case when the adapter reports no resolution at all', () => {
    const bare: ParserResult = { parsed: null, tier: 3, confidence: 0 }
    expect(assertResolution(bare, testCase({ expectedTargetIana: 'America/New_York' })).passed).toBe(false)
  })
})

describe('the two hashes are independent', () => {
  const plain = [testCase()]
  const annotated = [testCase({ expectedTargetIana: 'America/New_York', expectedAmbiguous: true })]

  it('annotating a resolution does not move the extraction hash', () => {
    expect(hashExpectations(annotated)).toBe(hashExpectations(plain))
  })

  it('annotating a resolution does move the resolution hash', () => {
    expect(hashResolutions(annotated)).not.toBe(hashResolutions(plain))
  })

  it('changing what the parser should extract does not move the resolution hash', () => {
    const retargeted = [testCase({ expectedTarget: 'portland', expectedTargetIana: 'America/New_York' })]
    const original = [testCase({ expectedTargetIana: 'America/New_York' })]
    expect(hashResolutions(retargeted)).toBe(hashResolutions(original))
    expect(hashExpectations(retargeted)).not.toBe(hashExpectations(original))
  })

  it('ignores unannotated cases entirely', () => {
    expect(hashResolutions([testCase({ id: 1 }), testCase({ id: 2 })])).toBe(hashResolutions([]))
  })

  it('does not depend on case order', () => {
    const a = [testCase({ id: 1, expectedTargetIana: 'A' }), testCase({ id: 2, expectedTargetIana: 'B' })]
    expect(hashResolutions(a)).toBe(hashResolutions([...a].reverse()))
  })
})

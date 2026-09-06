import type { TestCase } from './types'
import fixtureData from '../__fixtures__/parser-eval.json'

/** Every set a case can belong to, in report order. */
export const SETS = ['realistic', 'edge', 'regression', 'adversarial'] as const
export type CaseSet = (typeof SETS)[number]

const allCases: TestCase[] = fixtureData as TestCase[]

export function loadFixture(): TestCase[] {
  return allCases
}

export function filterBySet(cases: TestCase[], set: CaseSet): TestCase[] {
  return cases.filter((tc) => tc.set === set)
}

export function filterBySplit(cases: TestCase[], split: 'dev' | 'eval'): TestCase[] {
  return cases.filter((tc) => tc.split === split)
}

export function groupByTag(cases: TestCase[]): Map<string, TestCase[]> {
  const map = new Map<string, TestCase[]>()
  for (const tc of cases) {
    for (const tag of tc.difficultyTags) {
      if (!map.has(tag)) map.set(tag, [])
      map.get(tag)!.push(tc)
    }
  }
  return map
}

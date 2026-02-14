import type { TimeRef, DateModifier, LocationKind } from '../src/engine/types.ts'

export interface TestCase {
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

/**
 * Compile the evaluation fixture from reviewed annotated queries + edge cases.
 *
 * Usage: npm run eval:compile
 *
 * Reads:
 *   - scripts/_generated/annotated-queries.json (Set 1, after human review)
 *   - scripts/edge-cases.ts (Set 2)
 *
 * Writes:
 *   - src/engine/__fixtures__/parser-eval.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { edgeCases } from './edge-cases.ts'
import type { TestCase } from './eval-types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- Seeded PRNG (mulberry32) for deterministic splits ---

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- Validation ---

const VALID_SETS = new Set(['realistic', 'edge', 'regression'])
const VALID_TIERS = new Set([1, 2, 3])
const VALID_TIME_TYPES = new Set(['now', 'absolute', 'relative'])

function validateCase(tc: TestCase, index: number): string[] {
  const errors: string[] = []
  const prefix = `Case #${tc.id} (index ${index}, "${tc.input.slice(0, 40)}")`

  if (typeof tc.input !== 'string') {
    errors.push(`${prefix}: input must be a string`)
  }
  if (!VALID_SETS.has(tc.set)) {
    errors.push(`${prefix}: invalid set "${tc.set}"`)
  }
  if (!VALID_TIERS.has(tc.expectedTier)) {
    errors.push(`${prefix}: invalid tier ${tc.expectedTier}`)
  }
  if (!tc.expectedTime || !VALID_TIME_TYPES.has(tc.expectedTime.type)) {
    errors.push(`${prefix}: invalid time type`)
  }
  if (tc.expectedTime?.type === 'absolute') {
    const t = tc.expectedTime
    if (t.hour < 0 || t.hour > 23 || t.minute < 0 || t.minute > 59) {
      errors.push(`${prefix}: invalid absolute time ${t.hour}:${t.minute}`)
    }
  }
  if (tc.expectedTime?.type === 'relative') {
    if (typeof tc.expectedTime.minutes !== 'number') {
      errors.push(`${prefix}: relative time missing minutes`)
    }
  }
  if (!Array.isArray(tc.difficultyTags)) {
    errors.push(`${prefix}: difficultyTags must be an array`)
  }
  if (typeof tc.notes !== 'string') {
    errors.push(`${prefix}: notes must be a string`)
  }

  return errors
}

// --- Main ---

function main(): void {
  console.log('=== Eval Fixture Compiler ===\n')

  const allCases: TestCase[] = []
  let nextId = 1

  // --- Load Set 1: Realistic (from generated + reviewed file) ---
  const annotatedPath = resolve(__dirname, '_generated/annotated-queries.json')
  if (existsSync(annotatedPath)) {
    const raw = readFileSync(annotatedPath, 'utf-8')
    const realisticCases: TestCase[] = JSON.parse(raw)
    console.log(`Loaded ${realisticCases.length} realistic cases from annotated-queries.json`)

    // Assign dev/eval split (70/30, seeded)
    const rng = mulberry32(42)
    for (const tc of realisticCases) {
      tc.id = nextId++
      tc.set = 'realistic'
      tc.split = rng() < 0.7 ? 'dev' : 'eval'
      allCases.push(tc)
    }

    const devCount = realisticCases.filter((tc) => tc.split === 'dev').length
    const evalCount = realisticCases.filter((tc) => tc.split === 'eval').length
    console.log(`  Split: ${devCount} dev / ${evalCount} eval`)
  } else {
    console.log('No annotated-queries.json found — skipping Set 1 (realistic)')
    console.log('  Run "npm run eval:generate" first, review the output, then re-run this.')
  }

  // --- Load Set 2: Edge cases ---
  console.log(`\nLoaded ${edgeCases.length} edge cases`)
  for (const ec of edgeCases) {
    allCases.push({ ...ec, id: nextId++ } as TestCase)
  }

  // --- Set 3: Regression (starts empty) ---
  console.log('Regression set: empty (append cases as bugs are found)')

  // --- Validate all cases ---
  console.log(`\nValidating ${allCases.length} total cases...`)
  const allErrors: string[] = []
  for (let i = 0; i < allCases.length; i++) {
    const errors = validateCase(allCases[i], i)
    allErrors.push(...errors)
  }

  if (allErrors.length > 0) {
    console.error(`\nValidation failed with ${allErrors.length} errors:`)
    for (const err of allErrors) {
      console.error(`  - ${err}`)
    }
    process.exit(1)
  }
  console.log('All cases valid.')

  // --- Check for duplicate inputs ---
  const inputSet = new Set<string>()
  const duplicates: string[] = []
  for (const tc of allCases) {
    if (inputSet.has(tc.input)) {
      duplicates.push(tc.input)
    }
    inputSet.add(tc.input)
  }
  if (duplicates.length > 0) {
    console.warn(`\nWarning: ${duplicates.length} duplicate inputs found:`)
    for (const d of duplicates.slice(0, 10)) {
      console.warn(`  - "${d}"`)
    }
  }

  // --- Write fixture ---
  const fixtureDir = resolve(__dirname, '../src/engine/__fixtures__')
  mkdirSync(fixtureDir, { recursive: true })

  const fixturePath = resolve(fixtureDir, 'parser-eval.json')
  writeFileSync(fixturePath, JSON.stringify(allCases, null, 2))

  // --- Summary ---
  const setBreakdown = new Map<string, number>()
  const tagBreakdown = new Map<string, number>()
  const tierBreakdown = new Map<number, number>()

  for (const tc of allCases) {
    setBreakdown.set(tc.set, (setBreakdown.get(tc.set) ?? 0) + 1)
    tierBreakdown.set(tc.expectedTier, (tierBreakdown.get(tc.expectedTier) ?? 0) + 1)
    for (const tag of tc.difficultyTags) {
      tagBreakdown.set(tag, (tagBreakdown.get(tag) ?? 0) + 1)
    }
  }

  console.log(`\nWrote ${allCases.length} cases to ${fixturePath}`)
  console.log('\nSet breakdown:')
  for (const [set, count] of setBreakdown) {
    console.log(`  ${set}: ${count}`)
  }
  console.log('\nTier breakdown:')
  for (const [tier, count] of [...tierBreakdown.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Tier ${tier}: ${count}`)
  }
  console.log('\nDifficulty tag breakdown:')
  for (const [tag, count] of [...tagBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag}: ${count}`)
  }
}

main()

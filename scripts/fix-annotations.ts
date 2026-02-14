/**
 * One-time script to auto-fix obvious ground truth issues in annotated-queries.json.
 * Run after generate, before compile.
 *
 * Usage: npx tsx scripts/fix-annotations.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestCase } from './eval-types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const filePath = resolve(__dirname, '_generated/annotated-queries.json')

const cases: TestCase[] = JSON.parse(readFileSync(filePath, 'utf-8'))

// --- Tracking ---

interface Fix {
  id: number
  input: string
  field: string
  from: unknown
  to: unknown
}

const fixes: Fix[] = []
const removed: Array<{ id: number; input: string; reason: string }> = []

function recordFix(tc: TestCase, field: string, from: unknown, to: unknown) {
  fixes.push({ id: tc.id, input: tc.input, field, from, to })
}

// --- Noise patterns ---

// Prefixes to strip from expectedSource (noise words before location)
const SOURCE_NOISE_PREFIXES = [
  'please tell me the time',
  'what time is it',
  'current time',
  'what time',
  'time difference',
  'time zone difference',
  'time zone',
  'convert',
  'check time for',
  'check time',
  'show me',
  'tell me the',
  'tell me',
  'time',
]

// Suffixes to strip from expectedTarget (noise words after location)
const TARGET_NOISE_SUFFIXES = [
  'current time',
  'time zone',
  'time right',  // from "right now" after "now" was stripped
  'time now',
  'time please',
  'time',
  'right',       // from "right now" after "now" was stripped
  'please',
  'pls',
  'now',
]

// Prefixes to strip from expectedTarget (noise words before location in single-location patterns)
const TARGET_NOISE_PREFIXES = [
  'please tell me the time',
  'what time is it',
  'current time',
  'what time',
  'time difference',
  'time zone',
  'convert',
  'check time for',
  'check time',
  'show me',
  'tell me the',
  'tell me',
  'time time',
  'time',
]

// Inputs that are garbage / not timezone queries → should be tier 3 with target null
const GARBAGE_INPUTS = new Set([
  'hi there',
  'hello',
  'help',
  'whats the time',
  'timezone converter',
  'random search query',
  'time now',
  'p',
  't',
])

function stripPrefix(value: string, prefixes: string[]): string {
  const lower = value.toLowerCase()
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix + ' ')) {
      return value.slice(prefix.length).trim()
    }
    if (lower === prefix) {
      return ''
    }
  }
  return value
}

function stripSuffix(value: string, suffixes: string[]): string {
  const lower = value.toLowerCase()
  for (const suffix of suffixes) {
    if (lower.endsWith(' ' + suffix)) {
      return value.slice(0, -(suffix.length + 1)).trim()
    }
    if (lower === suffix) {
      return ''
    }
  }
  return value
}

// --- Fix each case ---

for (const tc of cases) {
  // Fix garbage inputs
  if (GARBAGE_INPUTS.has(tc.input.toLowerCase())) {
    if (tc.expectedTier !== 3) {
      recordFix(tc, 'expectedTier', tc.expectedTier, 3)
      tc.expectedTier = 3
    }
    if (tc.expectedTarget !== null) {
      recordFix(tc, 'expectedTarget', tc.expectedTarget, null)
      tc.expectedTarget = null
    }
    if (tc.expectedSource !== null) {
      recordFix(tc, 'expectedSource', tc.expectedSource, null)
      tc.expectedSource = null
    }
    tc.notes = tc.notes || 'garbage input — not a timezone query'
    tc.difficultyTags = [...new Set([...tc.difficultyTags, 'garbage'])]
    continue
  }

  // Fix emoji / non-ASCII garbage inputs
  if (/^[^\w\s:.'?-]+$/.test(tc.input.trim())) {
    if (tc.expectedTier !== 3) {
      recordFix(tc, 'expectedTier', tc.expectedTier, 3)
      tc.expectedTier = 3
    }
    if (tc.expectedTarget !== null) {
      recordFix(tc, 'expectedTarget', tc.expectedTarget, null)
      tc.expectedTarget = null
    }
    tc.expectedSource = null
    tc.notes = 'emoji/non-ASCII garbage — not a timezone query'
    tc.difficultyTags = [...new Set([...tc.difficultyTags, 'garbage'])]
    continue
  }

  // Fix expectedSource: strip noise prefixes
  if (tc.expectedSource !== null) {
    const cleaned = stripPrefix(tc.expectedSource, SOURCE_NOISE_PREFIXES)
    if (cleaned !== tc.expectedSource) {
      recordFix(tc, 'expectedSource', tc.expectedSource, cleaned || null)
      tc.expectedSource = cleaned || null
    }
  }

  // Fix expectedTarget: strip noise suffixes then prefixes
  if (tc.expectedTarget !== null) {
    let cleaned = tc.expectedTarget
    cleaned = stripSuffix(cleaned, TARGET_NOISE_SUFFIXES)
    cleaned = stripPrefix(cleaned, TARGET_NOISE_PREFIXES)
    if (cleaned !== tc.expectedTarget) {
      if (cleaned === '') {
        // Stripping noise left nothing — mark as parse failure
        recordFix(tc, 'expectedTarget', tc.expectedTarget, null)
        tc.expectedTarget = null
        tc.expectedTier = 3
        tc.notes = (tc.notes ? tc.notes + '; ' : '') + 'no location after noise stripping'
      } else {
        recordFix(tc, 'expectedTarget', tc.expectedTarget, cleaned)
        tc.expectedTarget = cleaned
      }
    }
  }

  // Fix single-char inputs that aren't common abbreviations
  if (tc.input.trim().length === 1 && tc.expectedTier === 1) {
    recordFix(tc, 'expectedTier', 1, 3)
    tc.expectedTier = 3
    tc.notes = (tc.notes ? tc.notes + '; ' : '') + 'single character — not a valid query'
  }

  // Fix "convert 3pm" type cases (noise word + time, no location)
  if (tc.expectedTarget !== null && /^(convert|show|check)$/i.test(tc.expectedTarget.trim())) {
    recordFix(tc, 'expectedTarget', tc.expectedTarget, null)
    tc.expectedTarget = null
    tc.expectedTier = 3
    tc.notes = (tc.notes ? tc.notes + '; ' : '') + 'noise word, not a location'
  }
}

// --- Remove duplicates (keep first occurrence) ---

const seen = new Map<string, number>()
const deduped: TestCase[] = []

for (const tc of cases) {
  const key = tc.input.toLowerCase().trim()
  if (seen.has(key)) {
    removed.push({ id: tc.id, input: tc.input, reason: `duplicate of case #${seen.get(key)}` })
  } else {
    seen.set(key, tc.id)
    deduped.push(tc)
  }
}

// Re-assign sequential IDs
for (let i = 0; i < deduped.length; i++) {
  deduped[i].id = i + 1
}

// --- Report ---

console.log(`=== Annotation Fixes ===\n`)
console.log(`Total cases: ${cases.length}`)
console.log(`Fixes applied: ${fixes.length}`)
console.log(`Duplicates removed: ${removed.length}`)
console.log(`Final case count: ${deduped.length}`)

if (fixes.length > 0) {
  console.log(`\nFixes by field:`)
  const byField = new Map<string, number>()
  for (const f of fixes) {
    byField.set(f.field, (byField.get(f.field) ?? 0) + 1)
  }
  for (const [field, count] of [...byField.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count}`)
  }

  console.log(`\nAll fixes:`)
  for (const f of fixes) {
    const from = typeof f.from === 'string' ? `"${f.from}"` : JSON.stringify(f.from)
    const to = typeof f.to === 'string' ? `"${f.to}"` : JSON.stringify(f.to)
    console.log(`  #${f.id} "${f.input.slice(0, 50)}": ${f.field} ${from} → ${to}`)
  }
}

if (removed.length > 0) {
  console.log(`\nRemoved duplicates:`)
  for (const r of removed) {
    console.log(`  #${r.id} "${r.input}" — ${r.reason}`)
  }
}

// --- Write fixed file ---

writeFileSync(filePath, JSON.stringify(deduped, null, 2))
console.log(`\nWrote ${deduped.length} cases to ${filePath}`)

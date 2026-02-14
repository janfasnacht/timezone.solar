/**
 * Generate evaluation queries via Claude API, parse them, and output annotated JSON.
 *
 * Usage: npm run eval:generate
 * Requires ANTHROPIC_API_KEY in .env.local
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { parse } from '../src/engine/parser.ts'
import type { TestCase } from './eval-types.ts'

const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not set. Add it to .env.local')
  process.exit(1)
}

const MODEL = 'claude-sonnet-4-5-20250929'
const API_URL = 'https://api.anthropic.com/v1/messages'

// --- Persona prompts ---

interface Persona {
  name: string
  count: number
  prompt: string
}

const personas: Persona[] = [
  {
    name: 'business-traveler',
    count: 60,
    prompt: `You are a busy business traveler who frequently schedules meetings across time zones. You work with teams in New York, London, Tokyo, Singapore, Dubai, Frankfurt, Chicago, Hong Kong, São Paulo, and Mumbai.

Generate exactly {COUNT} things you might type into a timezone website search box. These should be natural, hurried, realistic — the kind of thing you'd quickly type when scheduling a meeting. Mix up the cities, times, and formats. Include:
- Quick abbreviations (NYC, LDN, SG, HK)
- Various time formats (3pm, 15:00, 3:30pm, noon)
- Different query styles (some with "to", some without, some just a city)
- Occasional relative times (in 2 hours, in 30 min)
- A few with "tomorrow" or "tmrw"
- Some bare city lookups (just checking what time it is there)

Output exactly one query per line. No numbering, no quotes, no explanations.`,
  },
  {
    name: 'remote-worker',
    count: 60,
    prompt: `You are a remote worker on a distributed team with colleagues in Berlin, San Francisco, São Paulo, Sydney, Toronto, Amsterdam, Seoul, and Bangalore. You coordinate standups, pair programming, and social events across time zones.

Generate exactly {COUNT} things you might type into a timezone website search box. These should be casual, everyday queries — the kind you'd type between Slack messages. Mix up the phrasing. Include:
- Casual city names (SF, Bangalore vs Bengaluru, Sydney)
- Relative times (in 1 hour, in 30 mins, in 2h)
- Questions about current time (just city names)
- Scheduling-style queries (Berlin 9am in SF, 3pm Toronto to Amsterdam)
- Some with date modifiers (tomorrow, today)
- Various connector words (to, in, at)
- Some all-lowercase, some properly capitalized
- Multi-word cities (San Francisco, São Paulo, New York)

Output exactly one query per line. No numbering, no quotes, no explanations.`,
  },
  {
    name: 'family-caller',
    count: 50,
    prompt: `You are someone who regularly calls family members abroad. Your family is spread across India (Delhi, Mumbai, Chennai), the Philippines (Manila), UK (London, Manchester), and Nigeria (Lagos). You're not very technical and use full city names. Sometimes you're vague.

Generate exactly {COUNT} things you might type into a timezone website search box. These should be natural, non-technical queries. Include:
- Full city and country names (Delhi India, Manila Philippines)
- Simple, direct queries (London time, what time Mumbai)
- Some vague inputs (India, Philippines, UK)
- Casual phrasing (time in Lagos, Delhi right now)
- Scheduling calls (8pm here in Delhi, evening in Manila)
- Named times (morning, noon, midnight when relevant)
- Some questions that aren't quite timezone queries but close
- A few typos or informal spellings

Output exactly one query per line. No numbering, no quotes, no explanations.`,
  },
  {
    name: 'tourist',
    count: 40,
    prompt: `You are a traveler planning trips to diverse destinations. You're looking up times in cities across the globe including lesser-known ones: Reykjavik, Accra, Kathmandu, Montevideo, Tbilisi, Marrakech, Hanoi, Auckland, Cape Town, Lisbon, Prague, Athens, Lima, Almaty, Nairobi, and Casablanca.

Generate exactly {COUNT} things you might type into a timezone website search box. Include:
- Lesser-known cities mixed with popular ones
- Various phrasings and formats
- Some country names instead of cities (Iceland, Ghana, Nepal)
- Curiosity-driven queries (just checking the time)
- A few with times for planning activities
- Mix of capitalization styles
- Some multi-word cities (Ho Chi Minh City, Buenos Aires, Kuala Lumpur, Salt Lake City)

Output exactly one query per line. No numbering, no quotes, no explanations.`,
  },
  {
    name: 'chaos',
    count: 40,
    prompt: `Generate exactly {COUNT} unusual, messy, or edge-case inputs that someone might type into a timezone website search box. These should include:
- Garbage that isn't a timezone query at all (random words, emojis concepts, greetings)
- Near-misses (almost valid but broken: "3pm to to London", "time time NYC")
- Natural language questions ("what time is it in Tokyo?", "how many hours ahead is London?")
- Unusual formatting (extra spaces, mixed caps, dots instead of colons for time)
- Very short inputs (single letters, 2-letter codes, just numbers)
- Inputs with extra filler words ("please tell me the time in Berlin")
- Time-only inputs with no city ("3pm", "noon", "midnight")
- Reversed or unusual orderings
- Inputs mixing timezone abbreviations with cities ("EST London", "3pm PST to Tokyo")

These should be realistic things humans might actually type, not deliberately adversarial. Output exactly one query per line. No numbering, no quotes, no explanations.`,
  },
]

// --- Claude API call ---

async function callClaude(prompt: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>
  }
  const textBlock = data.content.find((b) => b.type === 'text')
  return textBlock?.text ?? ''
}

// --- Stage 1: Generate raw queries ---

async function generateQueries(): Promise<
  Array<{ query: string; persona: string }>
> {
  const all: Array<{ query: string; persona: string }> = []

  for (const persona of personas) {
    console.log(
      `Generating ${persona.count} queries for persona: ${persona.name}...`
    )
    const prompt = persona.prompt.replace('{COUNT}', String(persona.count))
    const text = await callClaude(prompt)
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    console.log(`  Got ${lines.length} queries`)

    for (const line of lines) {
      all.push({ query: line, persona: persona.name })
    }
  }

  console.log(`\nTotal raw queries: ${all.length}`)
  return all
}

// --- Stage 2: Parse and annotate ---

function annotateQueries(
  raw: Array<{ query: string; persona: string }>
): TestCase[] {
  return raw.map((item, i) => {
    const result = parse(item.query)

    const tc: TestCase = {
      id: i + 1,
      input: item.query,
      expectedSource: result?.sourceLocation ?? null,
      expectedTarget: result?.targetLocation ?? null,
      expectedTime: result?.time ?? { type: 'now' },
      expectedDateModifier: result?.dateModifier ?? null,
      expectedTier: 1,
      difficultyTags: [],
      notes: result ? '' : 'parser returned null — needs review',
      set: 'realistic',
      persona: item.persona,
    }

    if (!result) {
      tc.expectedTier = 3
      tc.difficultyTags.push('parse-failure')
    }

    return tc
  })
}

// --- Stage 3: Distribution audit ---

function printAudit(cases: TestCase[]): void {
  console.log('\n=== Distribution Audit ===\n')

  // Persona mix
  const personaCounts = new Map<string, number>()
  for (const tc of cases) {
    const p = tc.persona ?? 'unknown'
    personaCounts.set(p, (personaCounts.get(p) ?? 0) + 1)
  }
  console.log('Persona distribution:')
  for (const [persona, count] of [...personaCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${persona}: ${count} (${((count / cases.length) * 100).toFixed(1)}%)`)
  }

  // Parser success rate
  const parsed = cases.filter((tc) => !tc.difficultyTags.includes('parse-failure'))
  console.log(
    `\nParser success rate: ${parsed.length}/${cases.length} (${((parsed.length / cases.length) * 100).toFixed(1)}%)`
  )

  // City frequency (from expectedSource and expectedTarget)
  const cityFreq = new Map<string, number>()
  for (const tc of cases) {
    for (const loc of [tc.expectedSource, tc.expectedTarget]) {
      if (loc) {
        const normalized = loc.toLowerCase()
        cityFreq.set(normalized, (cityFreq.get(normalized) ?? 0) + 1)
      }
    }
  }
  console.log('\nTop 20 cities:')
  const sorted = [...cityFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [city, count] of sorted) {
    console.log(`  ${city}: ${count}`)
  }

  // Pattern distribution (time type)
  const timeTypes = new Map<string, number>()
  for (const tc of cases) {
    timeTypes.set(tc.expectedTime.type, (timeTypes.get(tc.expectedTime.type) ?? 0) + 1)
  }
  console.log('\nTime type distribution:')
  for (const [type, count] of [...timeTypes.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count} (${((count / cases.length) * 100).toFixed(1)}%)`)
  }

  // Source presence
  const withSource = cases.filter((tc) => tc.expectedSource !== null).length
  console.log(
    `\nQueries with explicit source: ${withSource}/${cases.length} (${((withSource / cases.length) * 100).toFixed(1)}%)`
  )

  // Tier distribution
  const tierCounts = new Map<number, number>()
  for (const tc of cases) {
    tierCounts.set(tc.expectedTier, (tierCounts.get(tc.expectedTier) ?? 0) + 1)
  }
  console.log('\nTier distribution:')
  for (const [tier, count] of [...tierCounts.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    console.log(`  Tier ${tier}: ${count} (${((count / cases.length) * 100).toFixed(1)}%)`)
  }
}

// --- Stage 4: Write output ---

async function main(): Promise<void> {
  console.log('=== Eval Query Generator ===\n')

  const raw = await generateQueries()
  const annotated = annotateQueries(raw)
  printAudit(annotated)

  // Write output
  const outDir = new URL('./_generated/', import.meta.url)
  mkdirSync(outDir, { recursive: true })

  const outPath = new URL('./annotated-queries.json', outDir)
  writeFileSync(outPath, JSON.stringify(annotated, null, 2))

  console.log(`\nWrote ${annotated.length} annotated cases to scripts/_generated/annotated-queries.json`)
  console.log('Review the file and correct ground truth before running eval:compile')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

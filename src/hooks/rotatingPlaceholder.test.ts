import { describe, it, expect } from 'vitest'
import { generateExamples } from '@/hooks/useRotatingPlaceholder'
import { parse } from '@/engine/parser'
import { FAMILIAR_CITY_SLUGS } from '@/engine/familiar-cities'

/**
 * The placeholder is the only place the query language is taught, and clicking
 * the vibe line runs whatever it currently shows. So every example it can
 * produce has to be a query the parser actually accepts — otherwise a new
 * grammar here ships a landing page that demonstrates a failure.
 */
describe('generated examples', () => {
  const runs = Array.from({ length: 8 }, () => generateExamples())
  const all = runs.flat()

  it('produces a usable number of examples', () => {
    expect(all.length).toBeGreaterThan(200)
  })

  it('every example parses without error', () => {
    const failures = all
      .map((e) => ({ text: e.text, error: parse(e.text).error }))
      .filter((r) => r.error)
      .map((r) => `${r.text} → ${r.error!.type}`)
    expect(failures).toEqual([])
  })

  it('every example names at least one place', () => {
    const placeless = all.filter((e) => {
      const { parsed } = parse(e.text)
      return !parsed?.targetLocation && !parsed?.sourceLocation
    })
    expect(placeless).toEqual([])
  })

  it('opens with familiar places, holding the long tail back', () => {
    for (const run of runs) {
      expect(run[0].familiar, `first example: ${run[0].text}`).toBe(true)
      expect(run[1].familiar, `second example: ${run[1].text}`).toBe(true)
    }
  })

  it('still teaches every grammar it claims to', () => {
    const texts = all.map((e) => e.text)
    const shapes: Record<string, RegExp> = {
      'date': /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      'relative': /^in \d+ (hours|minutes)\b/,
      'abbreviation': /\b(EST|PST|CST|GMT|CET|JST|IST|AEST|BST) to /,
      'airport pair': /\b[A-Z]{3} to [A-Z]{3}\b/,
      'city to city': / to /,
      'two places with no time': /^[A-Z][^\d]* to [^\d]+$/,
      'time in city': /^\S+ in /,
    }
    for (const [name, re] of Object.entries(shapes)) {
      expect(texts.some((t) => re.test(t)), `no example of ${name}`).toBe(true)
    }
  })

  it('keeps the long tail present rather than eliminating it', () => {
    const tail = all.filter((e) => !e.familiar)
    expect(tail.length).toBeGreaterThan(0)
    expect(tail.length / all.length).toBeLessThan(0.35)
  })

  it('draws mostly on the familiar pool', () => {
    const familiarShare = all.filter((e) => e.familiar).length / all.length
    expect(familiarShare).toBeGreaterThan(0.6)
  })

  it('the familiar pool is what backs that', () => {
    expect(FAMILIAR_CITY_SLUGS.size).toBeGreaterThan(50)
  })
})

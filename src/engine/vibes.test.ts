import { describe, it, expect } from 'vitest'
import { getAllEntities, type CityEntity } from '@/engine/entities'

/**
 * Two rules for the vibe words, so "be less generic" is a failing test rather
 * than an opinion: no climate words, and every city carries at least one
 * adjective used by no other city. Sharing a word is fine — Tokyo and Zurich
 * both being `precise` is a rhyme — as long as it is never all a city has.
 */

/**
 * Geography (`coastal`, `alpine`, `volcanic`) is deliberately absent: it says
 * where somewhere is, which is the job. This is the forecast.
 */
const CLIMATE_WORDS = new Set([
  'balmy', 'breezy', 'crisp', 'foggy', 'frozen', 'hazy', 'hot', 'humid',
  'misty', 'polar', 'rainy', 'scorched', 'scorching', 'snowy', 'springlike',
  'subtropical', 'sultry', 'sun-baked', 'sun-beaten', 'sun-drenched',
  'sun-kissed', 'sun-soaked', 'sunlit', 'sunny', 'steamy', 'sweltering',
  'temperate', 'tropical', 'warm', 'windswept', 'windy', 'wintry',
])

const cities = getAllEntities().filter((e): e is CityEntity => e.kind === 'city')
const withVibes = cities.filter((c) => c.vibes && c.vibes.length > 0)

const usage = new Map<string, string[]>()
for (const city of withVibes) {
  for (const vibe of city.vibes!) {
    const seen = usage.get(vibe)
    if (seen) seen.push(city.slug)
    else usage.set(vibe, [city.slug])
  }
}

describe('vibe vocabulary', () => {
  it('has a vibe for every city, so no city falls back to a generic word', () => {
    expect(cities.filter((c) => !c.vibes?.length).map((c) => c.slug)).toEqual([])
  })

  it('describes character, not weather', () => {
    const weather = [...usage.keys()].filter((v) => CLIMATE_WORDS.has(v)).sort()
    expect(weather, 'climate words are not a character').toEqual([])
  })

  it('gives every city at least one adjective used nowhere else', () => {
    const generic = withVibes
      .filter((c) => !c.vibes!.some((v) => usage.get(v)!.length === 1))
      .map((c) => `${c.slug} (${c.vibes!.join(', ')})`)
    expect(generic, 'every one of these needs a word of its own').toEqual([])
  })

  it('writes them in one register — lowercase, no spaces', () => {
    const odd = [...usage.keys()].filter((v) => !/^[a-z]+(-[a-z]+)*$/.test(v)).sort()
    expect(odd).toEqual([])
  })

  it('keeps the shared half of the vocabulary from re-concentrating', () => {
    // A word carried by more than a dozen cities says nothing about any of them.
    const overused = [...usage.entries()]
      .filter(([, slugs]) => slugs.length > 12)
      .map(([word, slugs]) => `${word} (${slugs.length})`)
    expect(overused).toEqual([])
  })
})

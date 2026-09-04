import { describe, it, expect } from 'vitest'
import cityTimezones from 'city-timezones'
import { parse } from './parser'
import { NOISE_WORDS } from './noise-words'
import { normalize, resolveLocation } from './resolver'
import { resolveWithConfidence } from './resolver-wrapper'

/**
 * What the app must refuse to answer. Asserted against whatever city dataset
 * ships, since a bigger one is what would break these.
 */

/** Junk the parser can reject from a word list alone. */
const VOCABULARY_JUNK = [
  'timezone converter', 'time zone', 'timezone', 'converter', 'clock',
  'time now', 'current time', 'whats the time', 'what time is it',
  'help', 'about', 'search', 'random search query',
  'hi', 'hi there', 'hello', 'hey there', 'thanks', 'ok',
  'the', 'and', 'how many hours', 'what is the difference',
  '12345', 'p', 't', '🌍⏰', '...',
]

/** Junk only the resolver can reject. The parser has no dictionary, by design. */
const UNKNOWN_STRINGS = [
  'asdf', 'qwerty', 'zzz', 'xyzzy', 'foobar', 'settings', 'world clock',
]

const NOT_QUERIES = [...VOCABULARY_JUNK, ...UNKNOWN_STRINGS]

/** The same shapes, but with a real place in them. */
const REAL_QUERIES: [string, string][] = [
  ['what time is it in Tokyo', 'Tokyo'],
  ['current time tokyo pls', 'tokyo'],
  ['how many hours ahead is London?', 'London'],
  ['time in Berlin', 'Berlin'],
  ['whats the time in Paris', 'Paris'],
  ['evening time Manila', 'Manila'],
  ['Eastern Time', 'Eastern Time'],
  ['Mountain Time', 'Mountain Time'],
]

describe('query precision', () => {
  describe('the parser strips what a word list can know', () => {
    it.each(VOCABULARY_JUNK)('%s', (input) => {
      const { parsed } = parse(input)
      expect(parsed?.targetLocation ?? null).toBeNull()
    })
  })

  describe('the resolver refuses what it does not have', () => {
    it.each(UNKNOWN_STRINGS)('%s', (input) => {
      expect(resolveWithConfidence(input)).toBeNull()
    })
  })

  describe('either way the app answers nothing', () => {
    it.each(NOT_QUERIES)('%s', (input) => {
      const { parsed } = parse(input)
      const target = parsed?.targetLocation ?? null
      expect(target === null || resolveWithConfidence(target) === null).toBe(true)
    })
  })

  describe('the same shapes still find a real place', () => {
    it.each(REAL_QUERIES)('%s -> %s', (input, expected) => {
      const { parsed } = parse(input)
      expect(parsed?.targetLocation).toBe(expected)
      expect(resolveLocation(parsed!.targetLocation)).not.toBeNull()
    })
  })

  /** A stop-list is only safe while nothing on it is somewhere people go. */
  it('no noise word names a city of 100,000 or more', () => {
    const big = new Map<string, string>()
    for (const row of cityTimezones.cityMapping as unknown as { city: string; city_ascii: string; pop: number }[]) {
      if (row.pop < 100_000) continue
      for (const name of [row.city, row.city_ascii]) {
        const key = normalize(name)
        if (key) big.set(key, `${row.city} (pop ${row.pop})`)
      }
    }
    const shadowed = [...NOISE_WORDS].filter((word) => big.has(word)).map((word) => `${word} -> ${big.get(word)}`)
    expect(shadowed).toEqual([])
  })

  /** Words written side by side still merge; words separated by noise do not. */
  describe('noise does not glue two cities together', () => {
    it('keeps cities separated by noise apart', () => {
      const { parsed } = parse('Berlin colleague London')
      expect(parsed?.sourceLocation).toBe('Berlin')
      expect(parsed?.targetLocation).toBe('London')
    })

    it('still joins a genuine multi-word name', () => {
      const { parsed } = parse('New York to London')
      expect(parsed?.sourceLocation).toBe('New York')
      expect(parsed?.targetLocation).toBe('London')
    })
  })

  /** `Time` is a noise word alone, but half the name in `Eastern Time`. */
  describe('multi-word zone names survive tokenizing', () => {
    it.each([
      ['Eastern Time to London', 'Eastern Time', 'London'],
      ['Pacific Time to Tokyo', 'Pacific Time', 'Tokyo'],
      ['noon Pacific Time to Eastern Time', 'Pacific Time', 'Eastern Time'],
    ])('%s', (input, source, target) => {
      const { parsed } = parse(input)
      expect(parsed?.sourceLocation).toBe(source)
      expect(parsed?.targetLocation).toBe(target)
    })
  })
})

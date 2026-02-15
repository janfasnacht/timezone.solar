import { describe, bench } from 'vitest'
import { parseV2 } from './v2/parser-v2'
import { resolveLocation } from './resolver'
import { convert } from './converter'
import type { LocationRef, ConversionIntent } from './types'
import { loadFixture } from '@/engine/eval/fixture'

function loc(iana: string, displayName: string): LocationRef {
  return { iana, displayName, kind: 'city', resolveMethod: 'city-db' }
}

const NYC = loc('America/New_York', 'New York')
const LONDON = loc('Europe/London', 'London')

const fixtureCases = loadFixture()

describe('parser benchmarks', () => {
  bench('parse simple query', () => {
    parseV2('NYC to London')
  })

  bench('parse relative time', () => {
    parseV2('in 2 hours London')
  })

  bench('parse multi-word city', () => {
    parseV2('New York to San Francisco')
  })

  bench(`parse eval fixture (${fixtureCases.length} cases)`, () => {
    for (const tc of fixtureCases) parseV2(tc.input)
  })
})

describe('resolver benchmarks', () => {
  bench('resolve alias', () => {
    resolveLocation('nyc')
  })

  bench('resolve city-db', () => {
    resolveLocation('Tokyo')
  })

  bench('resolve fuzzy', () => {
    resolveLocation('Londno')
  })

  bench('resolve cache hit', () => {
    resolveLocation('London')
  })
})

describe('converter benchmarks', () => {
  bench('basic conversion', () => {
    convert({ source: NYC, target: LONDON, time: { type: 'absolute', hour: 10, minute: 0 }, dateModifier: null })
  })
})

describe('full pipeline benchmarks', () => {
  bench('full pipeline', () => {
    const { parsed } = parseV2('3pm NYC to London')
    if (!parsed) return
    const source = resolveLocation(parsed.sourceLocation!)
    const target = resolveLocation(parsed.targetLocation)
    if (!source || !target) return
    const intent: ConversionIntent = {
      source: source.primary,
      target: target.primary,
      time: parsed.time,
      dateModifier: parsed.dateModifier,
    }
    convert(intent)
  })

  bench('batch: 100 resolver inputs', () => {
    const inputs = [
      'nyc', 'la', 'sf', 'london', 'tokyo', 'paris', 'berlin', 'sydney',
      'mumbai', 'shanghai', 'dubai', 'singapore', 'hong kong', 'seoul',
      'toronto', 'chicago', 'boston', 'miami', 'denver', 'seattle',
      'amsterdam', 'zurich', 'vienna', 'rome', 'madrid', 'lisbon',
      'istanbul', 'cairo', 'nairobi', 'lagos', 'johannesburg', 'moscow',
      'bangkok', 'jakarta', 'manila', 'taipei', 'osaka', 'delhi',
      'karachi', 'dhaka', 'lima', 'bogota', 'santiago', 'buenos aires',
      'mexico city', 'portland', 'austin', 'dallas', 'houston', 'atlanta',
      'est', 'pst', 'gmt', 'utc', 'jst', 'ist', 'aest', 'cet',
      'california', 'texas', 'hawaii', 'arizona', 'florida', 'ohio',
      'uk', 'japan', 'india', 'china', 'korea', 'australia', 'brazil',
      'germany', 'france', 'italy', 'spain', 'switzerland', 'nz',
      'hk', 'sg', 'bkk', 'dc', 'philly', 'vegas', 'nola', 'chi',
      'atl', 'sea', 'pdx', 'den', 'dtw', 'msp', 'bos', 'dfw',
      'hou', 'aus', 'mia', 'new york', 'los angeles', 'san francisco',
      'ho chi minh city', 'kuala lumpur',
    ]
    for (const input of inputs) {
      resolveLocation(input)
    }
  })
})

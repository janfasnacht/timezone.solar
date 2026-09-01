import { useState, useEffect, useMemo, useCallback } from 'react'
import { getAllEntities, type AirportEntity, type CityEntity } from '@/engine/entities'
import { FAMILIAR_AIRPORT_IATA, FAMILIAR_CITY_SLUGS, FAMILIAR_SHARE } from '@/engine/familiar-cities'

// Abbreviations people read on sight. Always the source, so the target stays a
// city and can still supply a feeling word.
const ABBREVIATIONS = ['EST', 'PST', 'CST', 'GMT', 'CET', 'JST', 'IST', 'AEST', 'BST']

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

const RELATIVE_SPANS = ['in 2 hours', 'in 3 hours', 'in 90 minutes', 'in 6 hours']

/** Day 1–28 so no month/day pair is ever invalid. */
function datePhrase(): string {
  const day = 1 + Math.floor(Math.random() * 28)
  const month = pick(MONTHS)
  return Math.random() < 0.5 ? `${day} ${month}` : `${month} ${day}`
}

// Time format templates — mix of 12h and 24h, various times
const TIME_FORMATS = [
  '3pm', '6pm', '9am', '4pm', 'noon', '8am', '10pm', '7am',
  'midnight', '11am', '2pm', '5pm', '1pm', '6am',
  '15:00', '18:00', '09:00', '14:00', '20:00', '07:00',
  '5:30pm', '7:15am', '3:45pm',
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const isFamiliar = (c: { slug: string }) => FAMILIAR_CITY_SLUGS.has(c.slug)

/** Opening examples held to familiar places; the long tail starts after them. */
const FAMILIAR_HEAD = 2

type CityWithVibes = CityEntity & { vibes: string[] }

export interface GeneratedExample {
  text: string
  targetVibes: string[]
  /** Every place named is one a reader recognises. Gates the opening examples. */
  familiar: boolean
}

// The rotation is the only place the query language is taught, so the mix is a
// curriculum. Kept close to uniform: ranking shapes by how obvious they are is a
// claim about readers we cannot check.
//   "Chicago to New York"     — two places, no time         15%
//   "Tokyo"                   — current time somewhere      15%
//   "noon Tokyo to London"    — time city to city           15%
//   "6pm in Tokyo"            — time in city (user's tz)    12%
//   "14 march 3pm Berlin"     — absolute date               12%
//   "in 2 hours in Berlin"    — relative time               10%
//   "3pm JFK to LHR"          — time IATA to IATA            8%
//   "Boston 6pm in LA"        — city time in city            8%
//   "9am EST to Berlin"       — timezone abbreviation         5%
export function generateExamples(): GeneratedExample[] {
  const all = getAllEntities()
  const cities = all.filter((c): c is CityWithVibes =>
    c.kind === 'city' && c.vibes !== null && c.vibes.length > 0
  )
  // Airport pool: only those whose parent city has vibes — lets us reuse the
  // parent city's feeling-word vocabulary when an airport is the target.
  const cityVibesBySlug = new Map<string, string[]>()
  for (const c of cities) cityVibesBySlug.set(c.slug, c.vibes)
  // Airport examples are held to codes people read on sight.
  const airports = all.filter(
    (e): e is AirportEntity =>
      e.kind === 'airport' &&
      e.parentCitySlug !== null &&
      cityVibesBySlug.has(e.parentCitySlug) &&
      FAMILIAR_AIRPORT_IATA.has(e.iata),
  )
  const shuffledAirports = shuffle(airports)

  // Mostly cities the reader knows, so the pattern stands out rather than the
  // place names, with the long tail still present.
  const familiar = cities.filter((c) => FAMILIAR_CITY_SLUGS.has(c.slug))
  const tail = cities.filter((c) => !FAMILIAR_CITY_SLUGS.has(c.slug))
  const tailCount = Math.round(familiar.length / FAMILIAR_SHARE - familiar.length)
  const shuffled = shuffle([...familiar, ...shuffle(tail).slice(0, tailCount)])
  const examples: GeneratedExample[] = []

  let i = 0
  let airportIdx = 0
  while (i < shuffled.length) {
    const roll = Math.random()

    if (roll < 0.15 && i + 1 < shuffled.length) {
      // "Chicago to New York" — no time at all.
      const src = shuffled[i]
      const tgt = shuffled[i + 1]
      examples.push({
        text: `${src.displayName} to ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        familiar: isFamiliar(src) && isFamiliar(tgt),
      })
      i += 2
    } else if (roll < 0.27 && i + 1 < shuffled.length) {
      // "14 march 3pm Berlin" / "2 april 9am Tokyo to Berlin"
      const tgt = shuffled[i]
      const time = pick(TIME_FORMATS)
      const withSource = Math.random() < 0.5 && i + 1 < shuffled.length
      const src = withSource ? shuffled[i + 1] : null
      examples.push({
        text: src
          ? `${datePhrase()} ${time} ${src.displayName} to ${tgt.displayName}`
          : `${datePhrase()} ${time} ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        familiar: isFamiliar(tgt) && (!src || isFamiliar(src)),
      })
      i += withSource ? 2 : 1
    } else if (roll < 0.37) {
      // "in 2 hours in Berlin"
      const tgt = shuffled[i]
      examples.push({
        text: `${pick(RELATIVE_SPANS)} in ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        familiar: isFamiliar(tgt),
      })
      i += 1
    } else if (roll < 0.42) {
      // "9am EST to Berlin" — abbreviation as the source, so the target is a
      // city and can still supply a feeling word.
      const tgt = shuffled[i]
      const time = pick(TIME_FORMATS)
      examples.push({
        text: `${time} ${pick(ABBREVIATIONS)} to ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        familiar: isFamiliar(tgt),
      })
      i += 1
    } else if (roll < 0.50 && i + 1 < shuffled.length) {
      // "Boston 6pm in LA"
      const src = shuffled[i]
      const tgt = shuffled[i + 1]
      const time = pick(TIME_FORMATS)
      examples.push({
        text: `${src.displayName} ${time} in ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        familiar: isFamiliar(src) && isFamiliar(tgt),
      })
      i += 2
    } else if (roll < 0.65 && i + 1 < shuffled.length) {
      // "noon Tokyo to London"
      const src = shuffled[i]
      const tgt = shuffled[i + 1]
      const time = pick(TIME_FORMATS)
      examples.push({
        text: `${time} ${src.displayName} to ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        familiar: isFamiliar(src) && isFamiliar(tgt),
      })
      i += 2
    } else if (roll < 0.73 && airportIdx + 1 < shuffledAirports.length) {
      // "3pm JFK to LHR" — airport pair, target's parent city supplies the vibes
      const src = shuffledAirports[airportIdx]
      let tgt = shuffledAirports[airportIdx + 1]
      // Avoid same-city pairs (e.g. JFK → EWR are both New York). Walk forward
      // until the parent differs, falling back if we run off the end.
      let probe = airportIdx + 1
      while (probe < shuffledAirports.length && shuffledAirports[probe].parentCitySlug === src.parentCitySlug) {
        probe++
      }
      if (probe < shuffledAirports.length) tgt = shuffledAirports[probe]
      const time = pick(TIME_FORMATS)
      const tgtVibes = cityVibesBySlug.get(tgt.parentCitySlug!) ?? []
      examples.push({
        text: `${time} ${src.displayName} to ${tgt.displayName}`,
        targetVibes: tgtVibes,
        familiar: true, // airport codes are curated, with no long tail
      })
      airportIdx = probe + 1
    } else if (roll < 0.85) {
      // "6pm in Tokyo"
      const city = shuffled[i]
      const time = pick(TIME_FORMATS)
      examples.push({
        text: `${time} in ${city.displayName}`,
        targetVibes: city.vibes,
        familiar: isFamiliar(city),
      })
      i += 1
    } else {
      // "Tokyo"
      const city = shuffled[i]
      examples.push({
        text: city.displayName,
        targetVibes: city.vibes,
        familiar: isFamiliar(city),
      })
      i += 1
    }
  }

  const ordered = shuffle(examples)
  // Pull a familiar example forward into any opening slot that drew from the
  // tail, rather than filtering the tail out of those slots.
  for (let slot = 0; slot < FAMILIAR_HEAD && slot < ordered.length; slot++) {
    if (ordered[slot].familiar) continue
    const swap = ordered.findIndex((e, j) => j >= FAMILIAR_HEAD && e.familiar)
    if (swap === -1) break
    ;[ordered[slot], ordered[swap]] = [ordered[swap], ordered[slot]]
  }
  return ordered
}

interface RotatingPlaceholder {
  placeholder: string
  feelingWord: string
  /** Returns the plain-text query currently displayed in the placeholder */
  getCurrentExample: () => string
  /** Moves to the next example. Called when one is used, never on a timer. */
  advance: () => void
}

/** @param rotating whether examples cycle. Only true on the landing screen. */
export function useRotatingPlaceholder(rotating: boolean): RotatingPlaceholder {
  const [pool] = useState(generateExamples)
  const [index, setIndex] = useState(0)

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % pool.length)
  }, [pool])

  useEffect(() => {
    if (!rotating) return
    const id = setInterval(advance, 6000)
    return () => clearInterval(id)
  }, [rotating, advance])

  // Pick a random vibe from the current target city's vibes
  const feelingWord = useMemo(() => {
    const vibes = pool[index]?.targetVibes
    if (!vibes || vibes.length === 0) return 'global'
    return pick(vibes)
  }, [pool, index])

  const getCurrentExample = useCallback(() => {
    return pool[index].text
  }, [pool, index])

  return {
    placeholder: pool[index].text,
    feelingWord,
    getCurrentExample,
    advance,
  }
}

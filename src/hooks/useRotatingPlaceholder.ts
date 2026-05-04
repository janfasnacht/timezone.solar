import { useState, useEffect, useMemo, useCallback } from 'react'
import { getAllEntities, type AirportEntity, type CityEntity } from '@/engine/entities'

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

type CityWithVibes = CityEntity & { vibes: string[] }

export interface PreviewCities {
  source: string | null
  target: string | null
}

interface GeneratedExample {
  text: string
  targetVibes: string[]
  previewCities: PreviewCities
}

// Build examples from city entities that have vibes
// Patterns mirror the app's actual query modes:
//   "Boston 6pm in LA"     — city time in city
//   "noon Tokyo to London" — time city to city
//   "3pm JFK to LHR"       — time IATA to IATA (airport pair)
//   "6pm in Tokyo"         — time in city (from user's tz)
//   "Tokyo"                — current time somewhere
function generateExamples(): GeneratedExample[] {
  const all = getAllEntities()
  const cities = all.filter((c): c is CityWithVibes =>
    c.kind === 'city' && c.vibes !== null && c.vibes.length > 0
  )
  // Airport pool: only those whose parent city has vibes — lets us reuse the
  // parent city's feeling-word vocabulary when an airport is the target.
  const cityVibesBySlug = new Map<string, string[]>()
  for (const c of cities) cityVibesBySlug.set(c.slug, c.vibes)
  const airports = all.filter(
    (e): e is AirportEntity =>
      e.kind === 'airport' && e.parentCitySlug !== null && cityVibesBySlug.has(e.parentCitySlug),
  )
  const shuffledAirports = shuffle(airports)

  const shuffled = shuffle(cities)
  const examples: GeneratedExample[] = []

  let i = 0
  let airportIdx = 0
  while (i < shuffled.length) {
    const roll = Math.random()

    if (roll < 0.30 && i + 1 < shuffled.length) {
      // "Boston 6pm in LA"
      const src = shuffled[i]
      const tgt = shuffled[i + 1]
      const time = pick(TIME_FORMATS)
      examples.push({
        text: `${src.displayName} ${time} in ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        previewCities: { source: src.displayName, target: tgt.displayName },
      })
      i += 2
    } else if (roll < 0.55 && i + 1 < shuffled.length) {
      // "noon Tokyo to London"
      const src = shuffled[i]
      const tgt = shuffled[i + 1]
      const time = pick(TIME_FORMATS)
      examples.push({
        text: `${time} ${src.displayName} to ${tgt.displayName}`,
        targetVibes: tgt.vibes,
        previewCities: { source: src.displayName, target: tgt.displayName },
      })
      i += 2
    } else if (roll < 0.65 && airportIdx + 1 < shuffledAirports.length) {
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
        previewCities: { source: src.displayName, target: tgt.displayName },
      })
      airportIdx = probe + 1
    } else if (roll < 0.85) {
      // "6pm in Tokyo"
      const city = shuffled[i]
      const time = pick(TIME_FORMATS)
      examples.push({
        text: `${time} in ${city.displayName}`,
        targetVibes: city.vibes,
        previewCities: { source: null, target: city.displayName },
      })
      i += 1
    } else {
      // "Tokyo"
      const city = shuffled[i]
      examples.push({
        text: city.displayName,
        targetVibes: city.vibes,
        previewCities: { source: null, target: city.displayName },
      })
      i += 1
    }
  }

  return shuffle(examples)
}

interface RotatingPlaceholder {
  placeholder: string
  feelingWord: string
  previewCities: PreviewCities
  /** Returns the plain-text query currently displayed in the placeholder */
  getCurrentExample: () => string
}

export function useRotatingPlaceholder(hasUserInput: boolean): RotatingPlaceholder {
  const [pool] = useState(generateExamples)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (hasUserInput) return

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % pool.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [hasUserInput, pool])

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
    previewCities: pool[index].previewCities,
    getCurrentExample,
  }
}

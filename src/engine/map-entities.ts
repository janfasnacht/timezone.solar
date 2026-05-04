import cityTimezones from 'city-timezones'
import { getAllEntities, lookupEntity, type Entity } from './entities'

/**
 * Curated set of ~90 city slugs for the world map display.
 * Selected for geographic spread, timezone diversity, and global recognition.
 * No two dots should visually overlap at world-map scale.
 */
const MAP_CITY_SLUGS = new Set([
  // North America
  'new-york',
  'los-angeles',
  'chicago',
  'san-francisco',
  'miami',
  'seattle',
  'denver',
  'houston',
  'honolulu',
  'anchorage',
  'toronto',
  'vancouver',
  'mexico-city',

  // Central America & Caribbean
  'panama-city',
  'havana',

  // South America
  'sao-paulo',
  'buenos-aires',
  'bogota',
  'lima',
  'santiago',
  'rio-de-janeiro',
  'caracas',

  // Western Europe
  'london',
  'paris',
  'berlin',
  'amsterdam',
  'rome',
  'madrid',
  'lisbon',
  'dublin',
  'brussels',
  'zurich',

  // Northern Europe
  'stockholm',
  'oslo',
  'copenhagen',
  'helsinki',
  'reykjavik',

  // Eastern Europe
  'moscow',
  'warsaw',
  'prague',
  'vienna',
  'budapest',
  'bucharest',
  'kyiv',
  'athens',
  'istanbul',

  // Africa
  'cairo',
  'johannesburg',
  'cape-town',
  'lagos',
  'nairobi',
  'casablanca',
  'addis-ababa',
  'dar-es-salaam',
  'accra',
  'algiers',

  // Middle East
  'dubai',
  'riyadh',
  'tel-aviv',
  'tehran',
  'baghdad',
  'doha',

  // South Asia
  'mumbai',
  'delhi',
  'bangalore',
  'karachi',
  'dhaka',
  'kathmandu',
  'colombo',

  // East Asia
  'tokyo',
  'osaka',
  'seoul',
  'shanghai',
  'beijing',
  'hong-kong',
  'taipei',

  // Southeast Asia
  'singapore',
  'bangkok',
  'ho-chi-minh-city',
  'jakarta',
  'kuala-lumpur',
  'manila',

  // Central Asia
  'almaty',
  'tashkent',

  // Oceania
  'sydney',
  'melbourne',
  'auckland',
  'perth',
  'wellington',
])

let cached: Entity[] | null = null
let allCached: Entity[] | null = null

export function getMapEntities(): Entity[] {
  if (cached) return cached
  cached = getAllEntities().filter((e) => MAP_CITY_SLUGS.has(e.slug))
  return cached
}

/**
 * All cities from city-timezones DB (~7K), merged with curated entities.
 * Curated entities take priority for matching city names.
 */
export function getAllMapEntities(): Entity[] {
  if (allCached) return allCached
  const curated = getAllEntities()
  const curatedSlugs = new Set(curated.map((c) => c.slug))
  const extras: Entity[] = []
  const mapping = cityTimezones.cityMapping as Array<{
    city: string
    lat: number
    lng: number
    timezone: string
    iso2: string
    country: string
  }>
  const seenSlugs = new Set<string>()
  for (const entry of mapping) {
    const slug = entry.city.toLowerCase().replace(/\s+/g, '-')
    if (curatedSlugs.has(slug) || seenSlugs.has(slug)) continue
    seenSlugs.add(slug)
    extras.push({
      kind: 'city',
      slug,
      displayName: entry.city,
      country: entry.country,
      countryCode: entry.iso2,
      iana: entry.timezone,
      lat: entry.lat,
      lng: entry.lng,
      aliases: [],
      wikidataId: null,
      vibes: null,
      iconSlug: null,
    })
  }
  allCached = [...curated, ...extras]
  return allCached
}

/**
 * Look up an entity by name for map rendering, first from curated entities,
 * then from the city-timezones database as a fallback.
 */
export function findEntityForMap(name: string): Entity | null {
  const entity = lookupEntity(name)
  if (entity) return entity

  // Fallback: city-timezones database
  const results = cityTimezones.lookupViaCity(name) as Array<{
    city: string
    lat: number
    lng: number
    timezone: string
    iso2: string
    country: string
  }>
  if (results.length === 0) return null
  const best = results[0]
  return {
    kind: 'city',
    slug: best.city.toLowerCase().replace(/\s+/g, '-'),
    displayName: best.city,
    country: best.country,
    countryCode: best.iso2,
    iana: best.timezone,
    lat: best.lat,
    lng: best.lng,
    aliases: [],
    wikidataId: null,
    vibes: null,
    iconSlug: null,
  }
}

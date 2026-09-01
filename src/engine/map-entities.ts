import cityTimezones from 'city-timezones'
import { lookupEntity, type Entity } from './entities'

/**
 * Curated set of ~90 city slugs that carry the world map.
 * Selected for geographic spread, timezone diversity, and global recognition.
 *
 * No longer a set the map draws verbatim — it is one rank tier feeding the
 * density pass in `map-density.ts`, which decides what actually fits.
 */
export const MAP_CITY_SLUGS: ReadonlySet<string> = new Set([
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

/**
 * Look up an entity by name for map rendering, first from curated entities,
 * then from the city-timezones database as a fallback. Used for the source and
 * target of a conversion, which are drawn whatever the density pass decides.
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

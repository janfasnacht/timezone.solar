import { lookupCities } from './city-table'
import { lookupEntity, type Entity } from './entities'
import { normalize } from './normalize'

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
 * The places that should win their space when the whole world is on screen.
 *
 * Deliberately not the most populous — this is a timezone app, so the axis is
 * "a place you would coordinate a time across". That is why Lagos, Nairobi and
 * Johannesburg are here and Dhaka and Karachi are not, and why the set is
 * spread across regions rather than concentrated where the people are.
 */
export const ANCHOR_CITY_SLUGS: ReadonlySet<string> = new Set([
  // North America
  'new-york', 'los-angeles', 'chicago', 'san-francisco', 'toronto', 'vancouver',
  'mexico-city',
  // South America
  'sao-paulo', 'buenos-aires', 'lima', 'bogota', 'santiago',
  // Europe
  'london', 'paris', 'berlin', 'madrid', 'rome', 'amsterdam', 'zurich',
  'stockholm', 'warsaw', 'moscow', 'istanbul', 'lisbon', 'dublin',
  // Africa
  'cairo', 'lagos', 'nairobi', 'johannesburg', 'cape-town', 'casablanca',
  'accra', 'addis-ababa', 'dar-es-salaam', 'algiers',
  // Middle East
  'dubai', 'riyadh', 'tel-aviv', 'tehran',
  // South Asia
  'mumbai', 'delhi',
  // East and Southeast Asia
  'tokyo', 'seoul', 'beijing', 'shanghai', 'hong-kong', 'singapore', 'bangkok',
  'jakarta', 'manila', 'taipei',
  // Oceania
  'sydney', 'melbourne', 'auckland', 'perth',
])

/**
 * An entity by name for map rendering: curated entities first, then the same
 * population-ordered bucket the resolver answers from, so the dot on the map is
 * the city on the card. Used for a conversion's source and target, which are
 * drawn whatever the density pass decides.
 */
export function findEntityForMap(name: string): Entity | null {
  const entity = lookupEntity(name)
  if (entity) return entity

  const results = lookupCities(normalize(name))
  if (!results || results.length === 0) return null
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

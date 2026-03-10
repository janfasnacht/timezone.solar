import { getAllEntities, type CityEntity } from './city-entities'

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

let cached: CityEntity[] | null = null

export function getMapCities(): CityEntity[] {
  if (cached) return cached
  cached = getAllEntities().filter((e) => MAP_CITY_SLUGS.has(e.slug))
  return cached
}

/**
 * Cities recognisable enough that an example reads as a pattern rather than as
 * two place names to decode.
 *
 * Curated rather than derived. The axis is "somewhere you would plausibly
 * coordinate a time across" — business and travel hubs — which is neither
 * population nor fame, and short enough to maintain by hand.
 *
 * Every slug must exist in the entity registry; see familiar-cities.test.ts.
 */
export const FAMILIAR_CITY_SLUGS: ReadonlySet<string> = new Set([
  // North America
  'new-york', 'los-angeles', 'chicago', 'san-francisco', 'boston', 'miami',
  'seattle', 'denver', 'austin', 'atlanta', 'new-orleans', 'philadelphia',
  'washington-dc', 'san-diego', 'phoenix', 'dallas', 'houston', 'detroit',
  'minneapolis', 'las-vegas', 'portland', 'honolulu', 'toronto', 'vancouver',
  'montreal', 'mexico-city',
  // South America
  'sao-paulo', 'buenos-aires', 'bogota', 'lima', 'santiago', 'rio-de-janeiro',
  'havana', 'panama-city',
  // Europe
  'london', 'paris', 'berlin', 'amsterdam', 'rome', 'madrid', 'lisbon',
  'stockholm', 'oslo', 'copenhagen', 'helsinki', 'vienna', 'brussels', 'warsaw',
  'prague', 'athens', 'istanbul', 'moscow', 'dublin', 'edinburgh', 'zurich',
  'munich', 'frankfurt', 'milan', 'barcelona', 'budapest', 'reykjavik', 'kyiv',
  // Middle East and Africa
  'dubai', 'riyadh', 'jerusalem', 'tel-aviv', 'doha', 'abu-dhabi', 'cairo',
  'lagos', 'nairobi', 'johannesburg', 'cape-town', 'casablanca', 'accra',
  // Asia
  'tokyo', 'osaka', 'kyoto', 'seoul', 'shanghai', 'beijing', 'shenzhen',
  'guangzhou', 'hong-kong', 'taipei', 'singapore', 'bangkok', 'jakarta',
  'kuala-lumpur', 'manila', 'hanoi', 'ho-chi-minh-city', 'mumbai', 'delhi',
  'bangalore', 'chennai', 'kolkata', 'karachi', 'dhaka',
  // Oceania
  'sydney', 'melbourne', 'auckland',
])

/**
 * Airport codes recognisable on sight. Exhaustive rather than weighted: a
 * familiar city has dozens of minor fields, and an unknown three-letter code is
 * noise where an unknown city name is at least a word.
 *
 * Every code must exist in the airport registry; see familiar-cities.test.ts.
 */
export const FAMILIAR_AIRPORT_IATA: ReadonlySet<string> = new Set([
  // North America
  'JFK', 'EWR', 'LGA', 'LAX', 'SFO', 'ORD', 'SEA', 'DEN', 'ATL', 'BOS', 'MIA',
  'PHL', 'DCA', 'IAD', 'LAS', 'IAH', 'DFW', 'MSP', 'DTW', 'PDX', 'HNL', 'SAN',
  'PHX', 'AUS', 'MSY', 'YYZ', 'YVR', 'YUL', 'MEX',
  // South America
  'GRU', 'GIG', 'EZE', 'BOG', 'LIM', 'SCL',
  // Europe
  'LHR', 'LGW', 'CDG', 'ORY', 'FRA', 'MUC', 'AMS', 'MAD', 'BCN', 'FCO', 'MXP',
  'LIS', 'ZRH', 'CPH', 'ARN', 'OSL', 'HEL', 'VIE', 'BRU', 'WAW', 'PRG', 'ATH',
  'IST', 'SVO', 'DME', 'DUB', 'EDI', 'KEF', 'BUD', 'KBP',
  // Middle East and Africa
  'DXB', 'AUH', 'DOH', 'RUH', 'TLV', 'CAI', 'LOS', 'NBO', 'JNB', 'CPT', 'CMN', 'ACC',
  // Asia
  'HND', 'NRT', 'KIX', 'ICN', 'PVG', 'PEK', 'PKX', 'CAN', 'SZX', 'HKG', 'TPE',
  'SIN', 'BKK', 'CGK', 'KUL', 'MNL', 'HAN', 'SGN', 'BOM', 'DEL', 'BLR', 'MAA',
  'CCU', 'KHI', 'DAC',
  // Oceania
  'SYD', 'MEL', 'AKL',
])

/** Share of placeholder examples drawn from the familiar set; the rest is the long tail. */
export const FAMILIAR_SHARE = 0.85

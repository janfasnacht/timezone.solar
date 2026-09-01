/**
 * Cities recognisable enough that a reader sees the *grammar* of an example
 * rather than stopping to decode the place names.
 *
 * The rotating placeholder teaches five query shapes, but it drew uniformly
 * from all 325 curated cities, so it produced "8am Kuopio to Viana do Castelo"
 * — where the pattern is invisible behind the nouns.
 *
 * Three signals already in the registry were measured as candidates. Having an
 * airport (309/325) and having an icon (281/325) discriminate nothing. Hand-written
 * aliases do (70/325) — a city only earns a colloquial short form if people say
 * it often — but the alias list was maintained ad hoc and misses Singapore, Hong
 * Kong, Mumbai, Barcelona, Zurich and others you would notice.
 *
 * So this is curated rather than derived. Wikipedia pageviews were the obvious
 * alternative and rank Chernobyl and Pompeii near the top; fame is not the axis.
 * The axis is *somewhere you would plausibly coordinate a time across*, which
 * means business and travel hubs, and that list is short enough to read.
 *
 * Invariant: every slug here must exist in the entity registry — see the test.
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
 * Airport codes recognisable on sight.
 *
 * Restricting airports to *familiar parent cities* was not enough: a familiar
 * city has dozens of minor fields, which produced "1pm HIO to BXK" and
 * "6am HDH to VIY". An unrecognised city name is still a word you can read;
 * an unrecognised three-letter code is noise, so this list is exhaustive rather
 * than weighted — there is no charm in an obscure IATA code.
 *
 * Invariant: every code must exist in the airport registry — see the test.
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

/**
 * Share of placeholder examples drawn from the familiar set. The remainder is
 * the long tail, kept deliberately: an occasional Viana do Castelo is the point
 * of a 325-city catalogue, it just cannot be the whole diet.
 */
export const FAMILIAR_SHARE = 0.85

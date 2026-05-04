/**
 * Generate src/engine/airport-data.generated.ts from OpenFlights airports.dat.
 *
 * Filter rules:
 *   1. Must have IATA, IANA tz, and type === 'airport'
 *   2. Must have a curated city within NEAREST_CITY_RADIUS_KM (haversine)
 *   3. Aliases skip codes that collide with TZ_ABBREVIATIONS or city aliases
 *      to preserve runtime-resolution invariants (TZ wins for 'IST', city
 *      wins for 'BOS' / 'ATL' / etc.)
 *
 * Usage: npx tsx scripts/generate-airports.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAllEntities, type CityEntity } from '../src/engine/entities'
import { TZ_ABBREVIATIONS } from '../src/engine/constants'

const VENDOR_FILE = join(import.meta.dirname, '..', 'vendor', 'openflights-airports.dat')
const OUTPUT_FILE = join(import.meta.dirname, '..', 'src', 'engine', 'airport-data.generated.ts')

/** Airports without a curated city within this radius are excluded entirely.
 *  This is the primary filter for bundle size. At 75km we keep city-airports
 *  proper (which are usually 10-50km from the city center) plus a handful of
 *  satellite airports, while dropping the long tail of regional fields that
 *  are technically near a curated city but unlikely to be queried by IATA.
 *  Tune up if you want broader coverage; tune down to shrink the bundle. */
const NEAREST_CITY_RADIUS_KM = 75

/** Airports whose nearest curated city is in a different country than the
 *  airport itself still need a matching parent for the "JFK · New York" label.
 *  We only set parentCitySlug if the country matches OR distance < 100km
 *  (handles BSL: airport in France, parent Zurich is 70km away in Switzerland —
 *  the geographic adjacency makes the link meaningful even cross-border). */
const CROSS_COUNTRY_PARENT_MAX_KM = 100

// Map OpenFlights country names → our project's {country, countryCode} convention.
// Cities use 'USA'/'UK' (informal), so airports follow suit. ISO codes are stable.
const COUNTRY_OVERRIDES: Record<string, { country: string; countryCode: string }> = {
  'United States': { country: 'USA', countryCode: 'US' },
  'United Kingdom': { country: 'UK', countryCode: 'GB' },
  'United Arab Emirates': { country: 'UAE', countryCode: 'AE' },
  'South Korea': { country: 'South Korea', countryCode: 'KR' },
  'North Korea': { country: 'North Korea', countryCode: 'KP' },
  'Russia': { country: 'Russia', countryCode: 'RU' },
  'Czech Republic': { country: 'Czech Republic', countryCode: 'CZ' },
  'Burma': { country: 'Myanmar', countryCode: 'MM' },
  'Cape Verde': { country: 'Cabo Verde', countryCode: 'CV' },
  'Ivory Coast': { country: "Côte d'Ivoire", countryCode: 'CI' },
  'Congo (Kinshasa)': { country: 'DR Congo', countryCode: 'CD' },
  'Congo (Brazzaville)': { country: 'Congo', countryCode: 'CG' },
  'East Timor': { country: 'Timor-Leste', countryCode: 'TL' },
  'Macau': { country: 'Macau', countryCode: 'MO' },
  'Hong Kong': { country: 'Hong Kong', countryCode: 'HK' },
  'Palestine': { country: 'Palestine', countryCode: 'PS' },
}

interface CountryEntry {
  country: string
  countryCode: string
}

interface AirportRow {
  name: string
  city: string
  country: string
  iata: string
  icao: string
  lat: number
  lng: number
  iana: string
  type: string
}

interface GeneratedAirport {
  slug: string
  displayName: string
  country: string
  countryCode: string
  iana: string
  lat: number
  lng: number
  aliases: string[]
  wikidataId: null
  iata: string
  airportName: string
  parentCitySlug: string | null
}

// --- CSV parser ---
// OpenFlights airports.dat is RFC 4180-ish: comma-separated, double-quoted
// strings, `\N` for absent values. Numerics are unquoted.
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else {
      if (c === ',') { fields.push(field); field = '' }
      else if (c === '"') { inQuotes = true }
      else { field += c }
    }
  }
  fields.push(field)
  return fields
}

function readAirports(): AirportRow[] {
  const text = readFileSync(VENDOR_FILE, 'utf8')
  const rows: AirportRow[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const fields = parseCsvLine(line)
    if (fields.length < 14) continue
    const [, name, city, country, iata, icao, lat, lng, , , , iana, type] = fields
    rows.push({
      name,
      city,
      country,
      iata,
      icao,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      iana,
      type,
    })
  }
  return rows
}

// --- Haversine distance (km) ---
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

interface CityCoords {
  slug: string
  displayName: string
  country: string
  countryCode: string
  iana: string
  lat: number
  lng: number
}

function findNearestCity(
  lat: number,
  lng: number,
  cities: CityCoords[],
): { city: CityCoords; distanceKm: number } | null {
  let best: CityCoords | null = null
  let bestDist = Infinity
  for (const c of cities) {
    const d = haversine(lat, lng, c.lat, c.lng)
    if (d < bestDist) { bestDist = d; best = c }
  }
  if (!best) return null
  return { city: best, distanceKm: bestDist }
}

function normalizeCountry(openFlightsCountry: string): CountryEntry | null {
  if (COUNTRY_OVERRIDES[openFlightsCountry]) return COUNTRY_OVERRIDES[openFlightsCountry]
  // For untransformed countries, lowercase iso2 isn't derivable from name alone.
  // We borrow the parent city's countryCode in the caller for these cases.
  return null
}

function buildAirportFromRow(
  row: AirportRow,
  cities: CityCoords[],
  cityAliasSet: Set<string>,
  citySlugSet: Set<string>,
  countryToCode: Map<string, string>,
): GeneratedAirport | null {
  // Hard filters: must be a real commercial airport (IATA + ICAO, not a
  // heliport or balloon port).
  if (row.type !== 'airport') return null
  if (!row.iata || row.iata === '\\N') return null
  if (!/^[A-Z]{3}$/.test(row.iata)) return null
  if (!row.icao || row.icao === '\\N') return null
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return null

  // Nearest-curated-city geocoding
  const nearest = findNearestCity(row.lat, row.lng, cities)
  if (!nearest || nearest.distanceKm > NEAREST_CITY_RADIUS_KM) return null

  // IANA: prefer airport's own (more locally accurate, e.g. for US state
  // boundaries). Fall back to parent city's IANA when OpenFlights has `\N`
  // — this catches gaps like IST (Istanbul Airport) which is missing tz data.
  const iana = (row.iana && row.iana !== '\\N') ? row.iana : nearest.city.iana
  if (!iana) return null

  // Country resolution priority:
  //   1. Explicit override (handles 'United States' → 'USA' style differences)
  //   2. Lookup airport.country in countryToCode (built from CITY_DATA)
  //   3. Cross-border fallback: borrow from nearest city if ≤ 100km
  const override = normalizeCountry(row.country)
  let country = override?.country ?? row.country
  let countryCode: string | null = override?.countryCode ?? countryToCode.get(country) ?? null
  if (!countryCode && nearest.distanceKm <= CROSS_COUNTRY_PARENT_MAX_KM) {
    country = nearest.city.country
    countryCode = nearest.city.countryCode
  }
  if (!countryCode) {
    // Country isn't in CITY_DATA and no nearby curated city — extend overrides
    // or add a city in this country to include this airport's neighborhood.
    console.warn(`SKIP ${row.iata}: cannot resolve countryCode for "${row.country}"`)
    return null
  }

  // Parent-city link: same-country, OR within 100km (handles BSL→Zurich cross-border)
  const sameCountry = nearest.city.country === country
  const parentCitySlug =
    sameCountry || nearest.distanceKm <= CROSS_COUNTRY_PARENT_MAX_KM
      ? nearest.city.slug
      : null

  // Aliases: lowercase IATA, gated against TZ abbreviations and city aliases.
  const aliases: string[] = []
  const lowerIata = row.iata.toLowerCase()
  if (!TZ_ABBREVIATIONS[lowerIata] && !cityAliasSet.has(lowerIata)) {
    aliases.push(lowerIata)
  }

  // Slug: lowercase IATA, but disambiguate if it collides with a city slug
  // (e.g. FEZ airport vs. Fez city → 'fez-airport'). Cross-airport collisions
  // are handled by the seenSlug dedupe in main().
  const slug = citySlugSet.has(lowerIata) ? `${lowerIata}-airport` : lowerIata

  return {
    slug,
    displayName: row.iata,
    country,
    countryCode,
    iana,
    lat: round(row.lat, 4),
    lng: round(row.lng, 4),
    aliases,
    wikidataId: null,
    iata: row.iata,
    airportName: row.name.replace(/ Airport$/, ''),
    parentCitySlug,
  }
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

// --- Output formatter ---

function fmtAirport(a: GeneratedAirport): string {
  const aliases = JSON.stringify(a.aliases)
  return `  { slug: ${JSON.stringify(a.slug)}, displayName: ${JSON.stringify(a.displayName)}, country: ${JSON.stringify(a.country)}, countryCode: ${JSON.stringify(a.countryCode)}, iana: ${JSON.stringify(a.iana)}, lat: ${a.lat}, lng: ${a.lng}, aliases: ${aliases}, wikidataId: null, iata: ${JSON.stringify(a.iata)}, airportName: ${JSON.stringify(a.airportName)}, parentCitySlug: ${a.parentCitySlug === null ? 'null' : JSON.stringify(a.parentCitySlug)} },`
}

function emitFile(airports: GeneratedAirport[]): string {
  const sorted = [...airports].sort((a, b) => a.slug.localeCompare(b.slug))
  const lines = [
    '// AUTO-GENERATED by scripts/generate-airports.ts. Do not edit by hand.',
    '// Source: vendor/openflights-airports.dat (ODbL, © OpenFlights.org).',
    `// Filter: type='airport' + IATA + ICAO + nearest curated city within ${NEAREST_CITY_RADIUS_KM}km.`,
    '// IANA: airport row preferred; falls back to parent city for OpenFlights gaps (e.g. IST).',
    '// Aliases exclude codes that collide with TZ_ABBREVIATIONS or city aliases.',
    '// To regenerate: npm run airports:generate',
    "import type { AirportEntity } from './entities'",
    '',
    "export const AIRPORT_DATA: readonly Omit<AirportEntity, 'kind'>[] = [",
    ...sorted.map(fmtAirport),
    ']',
    '',
  ]
  return lines.join('\n')
}

// --- Main ---

function main() {
  const cityEntities = getAllEntities().filter((e): e is CityEntity => e.kind === 'city')
  const cities: CityCoords[] = cityEntities.map((c) => ({
    slug: c.slug,
    displayName: c.displayName,
    country: c.country,
    countryCode: c.countryCode,
    iana: c.iana,
    lat: c.lat,
    lng: c.lng,
  }))
  const cityAliasSet = new Set<string>()
  const citySlugSet = new Set<string>()
  for (const c of cityEntities) {
    citySlugSet.add(c.slug)
    cityAliasSet.add(c.slug)
    cityAliasSet.add(normalize(c.displayName))
    for (const a of c.aliases) cityAliasSet.add(a.toLowerCase())
  }

  // country-name → countryCode map seeded from CITY_DATA. Covers every country
  // we have a curated city in; airports in countries without curated cities
  // fall back to the cross-border-adjacent rule or get skipped.
  const countryToCode = new Map<string, string>()
  for (const c of cityEntities) {
    if (!countryToCode.has(c.country)) countryToCode.set(c.country, c.countryCode)
  }

  const rows = readAirports()
  console.log(`Loaded ${rows.length} airports from OpenFlights`)

  const airports: GeneratedAirport[] = []
  const seenSlug = new Set<string>()
  let droppedNoMatch = 0
  let droppedDupe = 0

  for (const row of rows) {
    const a = buildAirportFromRow(row, cities, cityAliasSet, citySlugSet, countryToCode)
    if (!a) { droppedNoMatch++; continue }
    if (seenSlug.has(a.slug)) {
      // Multiple OpenFlights rows can share an IATA (defunct + active). Keep first.
      droppedDupe++
      continue
    }
    seenSlug.add(a.slug)
    airports.push(a)
  }

  console.log(`Kept ${airports.length} airports (dropped ${droppedNoMatch} no-match, ${droppedDupe} dupes)`)

  writeFileSync(OUTPUT_FILE, emitFile(airports))
  console.log(`Wrote ${OUTPUT_FILE}`)
}

// Local copy of the resolver's normalize (avoids importing from a module
// that depends on the file we're about to write).
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

main()

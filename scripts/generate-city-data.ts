/**
 * Regenerates the city table from the pinned `city-timezones` package. Encoding
 * lives in `lib/city-table.ts` so the invariant test can run it without writing.
 *
 * Usage: npm run cities:generate
 */

import { writeFileSync } from 'node:fs'
import { generateCityData, OUTPUT_FILE, TAIL_OUTPUT_FILE } from './lib/city-table'

const result = generateCityData()
writeFileSync(OUTPUT_FILE, result.text)
writeFileSync(TAIL_OUTPUT_FILE, result.tailText)

console.log(`Head ${result.headRows} cities, tail ${result.tailRows}`)
console.log(`Wrote ${OUTPUT_FILE}`)
console.log(`Wrote ${TAIL_OUTPUT_FILE}`)

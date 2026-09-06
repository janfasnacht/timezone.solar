/**
 * Regenerates the airport table from the vendored OpenFlights snapshot.
 * Generation lives in `lib/airport-data.ts` so the invariant test can run it
 * without writing.
 *
 * Usage: npm run airports:generate
 */

import { writeFileSync } from 'node:fs'
import { generateAirportData, OUTPUT_FILE } from './lib/airport-data'

const result = generateAirportData()
writeFileSync(OUTPUT_FILE, result.text)

console.log(`Loaded ${result.loaded} airports from OpenFlights`)
console.log(
  `Kept ${result.kept} (dropped ${result.droppedNoMatch} no-match, ${result.droppedDupe} dupes)`,
)
for (const s of result.skipped) console.log(`  SKIP ${s}`)
console.log(`Wrote ${OUTPUT_FILE}`)

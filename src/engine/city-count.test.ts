import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import cityTimezones from 'city-timezones'

/**
 * README and AGENTS.md quoted 86,000+ from the first release; the package has
 * always shipped 7,329. Both numbers are user-facing, so they are asserted here
 * rather than trusted.
 */
describe('documented city count', () => {
  const actual = (cityTimezones.cityMapping as unknown[]).length

  it.each([
    ['README.md', /([\d,]+)\+? cities with fuzzy search/],
    ['AGENTS.md', /city-timezones \(([\d.]+)K cities\)/],
  ])('%s does not overstate coverage', (file, pattern) => {
    const match = readFileSync(file, 'utf8').match(pattern)
    expect(match, `no city count found in ${file}`).not.toBeNull()
    const claimed = match![1].includes('.')
      ? Number(match![1]) * 1000
      : Number(match![1].replace(/,/g, ''))
    // Rounded down for the prose, never up past what ships.
    expect(claimed).toBeLessThanOrEqual(actual)
    expect(claimed).toBeGreaterThan(actual * 0.9)
  })
})

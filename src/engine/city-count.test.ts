import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import cityTimezones from 'city-timezones'
import { AIRPORT_DATA } from './airport-data.generated'

/**
 * Coverage claims are user-facing prose. They may round down, never up — and
 * the page's own copy carries no count at all, so it cannot go stale.
 */
describe('documented coverage', () => {
  const cities = (cityTimezones.cityMapping as unknown[]).length

  function claimsIn(file: string, pattern: RegExp): number[] {
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(pattern)].map(([, n]) =>
      n.includes('.') ? Number(n) * 1000 : Number(n.replace(/,/g, ''))
    )
  }

  it.each([
    ['README.md', /([\d,]+)\+? cities with fuzzy search/g],
    ['AGENTS.md', /city-timezones \(([\d.]+)K cities\)/g],
  ])('%s does not overstate the city count', (file, pattern) => {
    const claims = claimsIn(file, pattern)
    expect(claims.length, `no city count found in ${file}`).toBeGreaterThan(0)
    for (const claimed of claims) {
      expect(claimed).toBeLessThanOrEqual(cities)
      expect(claimed).toBeGreaterThan(cities * 0.9)
    }
  })

  it.each([
    ['README.md', /([\d,]+)\+? airports by IATA/g],
  ])('%s does not overstate the airport count', (file, pattern) => {
    const claims = claimsIn(file, pattern)
    expect(claims.length, `no airport count found in ${file}`).toBeGreaterThan(0)
    for (const claimed of claims) {
      expect(claimed).toBeLessThanOrEqual(AIRPORT_DATA.length)
      expect(claimed).toBeGreaterThan(AIRPORT_DATA.length * 0.9)
    }
  })
})

describe('page copy claims no count', () => {
  it('index.html quotes no city or airport figure', () => {
    const text = readFileSync('index.html', 'utf8')
    const figures = [...text.matchAll(/\d[\d,.]*\s*[K+]*\s*(cities|airports)/gi)].map((m) => m[0])
    expect(figures).toEqual([])
  })
})

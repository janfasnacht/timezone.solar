/**
 * Generate sitemap.xml with landing page URLs for top city pairs.
 *
 * Usage: npx tsx scripts/generate-sitemap.ts
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = 'https://timezone.solar'

// Top ~20 global cities that drive the most timezone conversion searches
const TOP_CITIES = [
  'new-york',
  'london',
  'tokyo',
  'sydney',
  'paris',
  'berlin',
  'los-angeles',
  'chicago',
  'toronto',
  'dubai',
  'singapore',
  'hong-kong',
  'mumbai',
  'san-francisco',
  'seattle',
  'denver',
  'sao-paulo',
  'seoul',
  'shanghai',
  'bangkok',
]

function generateSitemap(): string {
  const urls: { loc: string; priority: string }[] = [
    { loc: `${BASE_URL}/`, priority: '1.0' },
    { loc: `${BASE_URL}/about`, priority: '0.5' },
  ]

  // Generate all directional pairs
  for (const from of TOP_CITIES) {
    for (const to of TOP_CITIES) {
      if (from === to) continue
      urls.push({
        loc: `${BASE_URL}/${from}-to-${to}`,
        priority: '0.7',
      })
    }
  }

  const entries = urls
    .map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

const sitemap = generateSitemap()
const outPath = join(import.meta.dirname, '..', 'public', 'sitemap.xml')
writeFileSync(outPath, sitemap, 'utf-8')

const landingCount = TOP_CITIES.length * (TOP_CITIES.length - 1)
console.log(`Generated sitemap with ${landingCount + 2} URLs (${landingCount} landing pages) → ${outPath}`)

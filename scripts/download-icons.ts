/**
 * Vendors the city skyline SVGs into `public/icons`, one per registry city that
 * declares an `iconSlug`. Source: https://github.com/anto1/city-icons
 *
 * The list is derived from the registry, and anything the registry asks for and
 * cannot get is reported rather than skipped.
 *
 * Usage:
 *   npx tsx scripts/download-icons.ts           # fetch what isn't vendored yet
 *   npx tsx scripts/download-icons.ts --force   # re-fetch everything
 *   npx tsx scripts/download-icons.ts --check   # report only, download nothing
 */

import { writeFile, mkdir, access, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getAllEntities, type CityEntity } from '../src/engine/entities'

const BASE_URL =
  'https://raw.githubusercontent.com/anto1/city-icons/main/public/icons'
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'icons')
const CONCURRENCY = 10

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

type Outcome = { slug: string; status: 'ok' | 'skip' | 'fail'; detail?: string }

async function download(slug: string, force: boolean): Promise<Outcome> {
  const outPath = join(OUT_DIR, `${slug}.svg`)
  if (!force && (await fileExists(outPath))) {
    return { slug, status: 'skip' }
  }

  const res = await fetch(`${BASE_URL}/${slug}.svg`)
  if (!res.ok) return { slug, status: 'fail', detail: String(res.status) }

  await writeFile(outPath, await res.text())
  return { slug, status: 'ok' }
}

async function main() {
  const force = process.argv.includes('--force')
  const checkOnly = process.argv.includes('--check')
  await mkdir(OUT_DIR, { recursive: true })

  const cities = getAllEntities().filter((e): e is CityEntity => e.kind === 'city')
  const wanted = [...new Set(cities.flatMap((c) => (c.iconSlug ? [c.iconSlug] : [])))].sort()
  // These have no icon to fetch under any slug, so a smarter list can't close
  // the gap. Sourcing or drawing them is separate work.
  const withoutIcon = cities.filter((c) => !c.iconSlug).map((c) => c.slug)

  const vendored = new Set(
    (await readdir(OUT_DIR)).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)),
  )
  const orphans = [...vendored].filter((f) => !wanted.includes(f)).sort()

  let results: Outcome[] = []
  if (checkOnly) {
    results = wanted.map((slug) => ({
      slug,
      status: vendored.has(slug) ? 'skip' : 'fail',
      detail: vendored.has(slug) ? undefined : 'not vendored',
    }))
  } else {
    console.log(
      `${wanted.length} icons wanted by the registry (force=${force}, concurrency=${CONCURRENCY})`,
    )
    for (let i = 0; i < wanted.length; i += CONCURRENCY) {
      const batch = wanted.slice(i, i + CONCURRENCY)
      results.push(...(await Promise.all(batch.map((slug) => download(slug, force)))))
      process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, wanted.length)}/${wanted.length}`)
    }
    console.log('\n')
  }

  const failed = results.filter((r) => r.status === 'fail')
  const downloaded = results.filter((r) => r.status === 'ok')
  const skipped = results.filter((r) => r.status === 'skip')

  console.log(
    `${cities.length} cities · ${wanted.length} with an icon · ${downloaded.length} downloaded, ${skipped.length} already vendored, ${failed.length} failed`,
  )

  if (orphans.length > 0) {
    // Not an error — costs a file, and deleting it only means re-fetching if
    // the city is ever added.
    console.log(`\nVendored but unclaimed (${orphans.length}): ${orphans.join(', ')}`)
  }

  if (failed.length > 0) {
    console.log(`\nDeclared in the registry but could not be vendored (${failed.length}):`)
    for (const f of failed) console.log(`  ${f.slug} (${f.detail})`)
  }

  if (withoutIcon.length > 0) {
    console.log(`\nNo icon at all (${withoutIcon.length} of ${cities.length} cities):`)
    console.log(`  ${withoutIcon.join(', ')}`)
    console.log('\n  These 404 upstream under every plausible slug.')
  }

  if (failed.length > 0 || withoutIcon.length > 0) process.exit(1)
}

main()

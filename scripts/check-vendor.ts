/**
 * Checks every third-party dataset against `vendor/manifest.json`.
 *
 *   npm run vendor:check            disk matches the recorded hashes
 *   npm run vendor:check -- --write rewrite those hashes from disk
 *   npm run vendor:upstream         has upstream moved, would output differ
 *
 * Only `--upstream` and `--write` touch the network.
 */

import {
  checkOffline,
  describeUpstreamChange,
  latestCommit,
  readManifest,
  writeRecordedHashes,
} from './lib/vendor'

async function main() {
  const manifest = readManifest()

  if (process.argv.includes('--write')) {
    writeRecordedHashes(manifest)
    console.log('Wrote vendor/manifest.json')
    return
  }

  if (process.argv.includes('--upstream')) {
    const stale: string[] = []
    for (const d of manifest.datasets) {
      if (d.source.kind !== 'github') {
        console.log(`${d.id}: npm ${d.source.version} — refresh with Dependabot or by hand`)
        continue
      }
      const head = await latestCommit(d.source.repo, d.source.path)
      if (head.sha === d.source.commit) {
        console.log(`${d.id}: up to date at ${d.source.commit.slice(0, 8)}`)
        continue
      }
      const change = await describeUpstreamChange(d, head.sha)
      const line =
        `${d.id}: pinned ${d.source.commit.slice(0, 8)} (${d.source.commitDate}), ` +
        `upstream ${head.sha.slice(0, 8)} (${head.date}) — ${change.summary}. ` +
        `Refresh: ${d.regenerate}`
      console.log(line)
      if (change.differs) stale.push(line)
    }
    if (stale.length > 0) process.exitCode = 1
    return
  }

  const problems = checkOffline(manifest)
  if (problems.length === 0) {
    console.log(`${manifest.datasets.length} datasets verified against vendor/manifest.json`)
    return
  }
  console.error(`${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exitCode = 1
}

main()

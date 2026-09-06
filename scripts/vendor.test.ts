import { describe, it, expect } from 'vitest'
import { checkGeneratedArtefacts, checkOffline, readManifest } from './lib/vendor'

/**
 * The offline half of `npm run vendor:check`, so a stale pin or an unrecorded
 * edit fails CI instead of drifting. Nothing here reaches the network.
 */
describe('vendored data matches vendor/manifest.json', () => {
  const manifest = readManifest()

  it('records source, license and attribution for every dataset', () => {
    expect(manifest.datasets.length).toBeGreaterThan(0)
    for (const d of manifest.datasets) {
      expect(d.license.url, `${d.id} has no license url`).toBeTruthy()
      expect(d.license.attribution, `${d.id} has no attribution`).toBeTruthy()
      if (d.source.kind === 'github') {
        expect(d.source.commit, `${d.id} is not pinned to a commit`).toMatch(/^[0-9a-f]{40}$/)
      }
    }
  })

  it('reports no drift', () => {
    expect(checkOffline(manifest)).toEqual([])
  })

  it('regenerates every artifact from the input it names', () => {
    expect(checkGeneratedArtefacts(manifest)).toEqual([])
  })
})


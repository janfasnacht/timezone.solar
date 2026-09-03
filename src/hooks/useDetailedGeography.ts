import { useState, useEffect } from 'react'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import land50mUrl from 'world-atlas/land-50m.json?url'
import countries50mUrl from 'world-atlas/countries-50m.json?url'

type GeoCollection = FeatureCollection<Geometry, GeoJsonProperties>

/**
 * The 50m coastlines and borders, fetched rather than bundled.
 *
 * The map draws 110m at first — 21 KB gzipped against 170 KB, and the
 * difference between them is invisible until you come in. `?url` keeps the
 * finer copy out of the map chunk entirely, so it costs nothing to anyone who
 * never zooms.
 */
export type DetailKind = 'land' | 'countries'

const SOURCE: Record<DetailKind, { url: string; object: string }> = {
  land: { url: land50mUrl, object: 'land' },
  countries: { url: countries50mUrl, object: 'countries' },
}

// Module-level, so a remount or a second consumer reuses the fetch.
const cache: Partial<Record<DetailKind, GeoCollection>> = {}
const inFlight: Partial<Record<DetailKind, Promise<GeoCollection>>> = {}

function load(kind: DetailKind): Promise<GeoCollection> {
  const existing = inFlight[kind]
  if (existing) return existing
  const { url, object } = SOURCE[kind]
  const promise = fetch(url)
    .then((r) => r.json())
    .then((topo: Topology<Record<string, GeometryCollection>>) =>
      feature(topo, topo.objects[object]) as GeoCollection
    )
    .catch((err) => {
      // A failed upgrade is not a failure: the coarse geometry is still drawn.
      delete inFlight[kind]
      throw err
    })
  inFlight[kind] = promise
  return promise
}

/**
 * Turning the topology into a path happens in the render that first draws it.
 * At idle, so it stays out of the gesture that asked for it — the coarse
 * coastline is already on screen.
 */
function whenIdle(run: () => void): () => void {
  if (typeof requestIdleCallback !== 'function') {
    const id = setTimeout(run, 0)
    return () => clearTimeout(id)
  }
  const id = requestIdleCallback(run, { timeout: 2000 })
  return () => cancelIdleCallback(id)
}

/** The finer geometry once it has arrived, or null to keep drawing the coarse one. */
export function useDetailedGeography(kind: DetailKind, enabled: boolean): GeoCollection | null {
  const [data, setData] = useState(cache[kind] ?? null)

  // Sync from the module cache without an effect, as the timezone layer does.
  // The cache is only filled at the handoff below, so this never pre-empts it.
  if (enabled && cache[kind] && data !== cache[kind]) {
    setData(cache[kind]!)
  }

  useEffect(() => {
    if (!enabled || cache[kind]) return
    let cancelled = false
    let cancelIdle: (() => void) | undefined
    load(kind)
      .then((geo) => {
        if (cancelled) return
        cancelIdle = whenIdle(() => {
          cache[kind] = geo
          setData(geo)
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      cancelIdle?.()
    }
  }, [kind, enabled])

  return enabled ? data : null
}

import { useState, useEffect, useCallback } from 'react'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'

type TzFeatureCollection = FeatureCollection<Geometry, GeoJsonProperties>

// Module-level cache — survives re-renders and re-mounts
let cachedData: TzFeatureCollection | null = null
let fetchPromise: Promise<TzFeatureCollection> | null = null

function fetchTzData(signal: AbortSignal): Promise<TzFeatureCollection> {
  if (!fetchPromise) {
    fetchPromise = fetch('/tz-boundaries.json', { signal })
      .then((r) => r.json())
      .then((topo: Topology<{ [key: string]: GeometryCollection }>) => {
        const objectKey = Object.keys(topo.objects)[0]
        const geo = feature(topo, topo.objects[objectKey]) as TzFeatureCollection
        cachedData = geo
        return geo
      })
      .catch((err) => {
        fetchPromise = null
        throw err
      })
  }
  return fetchPromise
}

export function useTimezoneData(enabled: boolean) {
  const [data, setData] = useState(cachedData)

  // Sync from module cache without effect
  if (enabled && cachedData && data !== cachedData) {
    setData(cachedData)
  }

  const doFetch = useCallback(() => {
    if (!enabled || cachedData) return
    const controller = new AbortController()
    fetchTzData(controller.signal).then(setData).catch(() => {})
    return () => controller.abort()
  }, [enabled])

  useEffect(doFetch, [doFetch])

  return { data: enabled ? data : null }
}

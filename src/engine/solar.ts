import type { Feature, Polygon } from 'geojson'

const DEG = Math.PI / 180
const CIRCLE_STEPS = 360

/**
 * Compute a GeoJSON feature representing the night side of Earth
 * for a given moment in time. Uses d3-geo's winding-order convention:
 * a polygon ring that traces < half the sphere is filled as-is;
 * a ring that traces > half is treated as the complement (hole).
 *
 * We build the night hemisphere as a GeoJSON Feature so d3-geo
 * correctly renders the hemisphere opposite the sun.
 */
export function getSolarTerminator(date: Date): Feature<Polygon> {
  const subsolar = getSubsolarPoint(date)

  // The terminator is the great circle 90° from the subsolar point.
  // Points on this circle are on the day/night boundary.
  // We trace it as a closed ring.
  const ring: [number, number][] = []

  for (let i = 0; i <= CIRCLE_STEPS; i++) {
    const azimuth = (i / CIRCLE_STEPS) * 2 * Math.PI
    const point = greatCirclePoint(subsolar.lat, subsolar.lng, 90, azimuth)
    ring.push([point.lng, point.lat])
  }

  // d3-geo uses winding order to determine which side of a ring is filled.
  // Clockwise = fills the smaller area. Counter-clockwise = fills the larger area.
  // We want to fill the NIGHT side (hemisphere away from the sun).
  // The ring as generated traces the terminator; we need to ensure
  // the winding order fills the side AWAY from the subsolar point.
  //
  // We check if the subsolar point is inside the polygon as currently wound.
  // If it is, we reverse the ring so the dark side gets filled instead.
  if (isPointInsideRing(ring, subsolar.lng, subsolar.lat)) {
    ring.reverse()
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  }
}

/**
 * Simple point-in-polygon test using ray casting.
 * Works for geographic coordinates on the terminator ring.
 */
function isPointInsideRing(
  ring: [number, number][],
  testLng: number,
  testLat: number
): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > testLat !== yj > testLat) {
      const intersectX = ((xj - xi) * (testLat - yi)) / (yj - yi) + xi
      if (testLng < intersectX) {
        inside = !inside
      }
    }
  }
  return inside
}

/**
 * Compute the subsolar point — the location on Earth where the sun
 * is directly overhead at the given time.
 */
function getSubsolarPoint(date: Date): { lat: number; lng: number } {
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600

  // Day of year
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayOfYear =
    Math.floor((date.getTime() - start) / (1000 * 60 * 60 * 24)) + 1

  // Solar declination (simplified astronomical formula)
  const declination =
    -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.25)

  // The subsolar longitude: where it's solar noon right now
  const lng = -(utcHours / 24) * 360 + 180

  return { lat: declination, lng }
}

/**
 * Given a center point on the sphere, compute the point at a given
 * angular distance and azimuth from it.
 */
function greatCirclePoint(
  centerLat: number,
  centerLng: number,
  distanceDeg: number,
  azimuth: number
): { lat: number; lng: number } {
  const cLat = centerLat * DEG
  const cLng = centerLng * DEG
  const dist = distanceDeg * DEG

  const lat = Math.asin(
    Math.sin(cLat) * Math.cos(dist) +
      Math.cos(cLat) * Math.sin(dist) * Math.cos(azimuth)
  )

  const lng =
    cLng +
    Math.atan2(
      Math.sin(azimuth) * Math.sin(dist) * Math.cos(cLat),
      Math.cos(dist) - Math.sin(cLat) * Math.sin(lat)
    )

  return {
    lat: lat / DEG,
    lng: lng / DEG,
  }
}

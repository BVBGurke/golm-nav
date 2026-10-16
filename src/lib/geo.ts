import type { LatLng } from '@/types'

export const M_PER_DEG_LAT = 111320
const RAD = Math.PI / 180

export function metresPerDegLon(lat: number): number {
  return M_PER_DEG_LAT * Math.cos(lat * RAD)
}

/** Planare Distanz in Metern; auf 3 km Campus gut auf 0,1 %. */
export function distance(a: LatLng, b: LatLng): number {
  const dy = (a[0] - b[0]) * M_PER_DEG_LAT
  const dx = (a[1] - b[1]) * metresPerDegLon((a[0] + b[0]) / 2)
  return Math.hypot(dx, dy)
}

/** Anfangspeilung auf dem Großkreis, in Grad. */
export function bearing(a: LatLng, b: LatLng): number {
  const lat1 = a[0] * RAD
  const lat2 = b[0] * RAD
  const dLon = (b[1] - a[1]) * RAD
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

/** Kürzeste vorzeichenbehaftete Differenz zweier Peilungen, in (-180, 180]. */
export function bearingDelta(from: number, to: number): number {
  let d = (to - from + 540) % 360 - 180
  if (d === -180) d = 180
  return d
}

const COMPASS = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten']

export function compass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

/** Aufsummierte Meter entlang eines Streckenzugs. */
export function cumulative(path: LatLng[]): number[] {
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + distance(path[i - 1], path[i]))
  return cum
}

export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return '–'
  if (m < 950) return `${Math.round(m / 5) * 5} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

export function formatDuration(s: number): string {
  const total = Math.max(1, Math.round(s / 60))
  if (total < 60) return `${total} Min`
  const h = Math.floor(total / 60)
  return `${h} Std ${total % 60} Min`
}


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
const COMPASS_SHORT = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']

export function compass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

export function compassShort(deg: number): string {
  return COMPASS_SHORT[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

/** Abstand von Punkt p zur Strecke a-b, in Metern. */
export function distanceToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const k = metresPerDegLon((p[0] + a[0] + b[0]) / 3) / M_PER_DEG_LAT
  const px = p[1] * k
  const py = p[0]
  const ax = a[1] * k
  const ay = a[0]
  const bx = b[1] * k
  const by = b[0]
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function distanceToPath(p: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity
  if (path.length === 1) return distance(p, path[0])
  let best = Infinity
  for (let i = 0; i + 1 < path.length; i++) {
    const d = distanceToSegment(p, path[i], path[i + 1])
    if (d < best) best = d
  }
  return best
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

/**
 * Punkt `m` Meter entlang des Wegs, von hinten gezählt wenn `fromEnd` gesetzt
 * ist. Damit bleibt die Marke der nächsten Abbiegung an der Route kleben.
 */
export function pointAtDistance(path: LatLng[], cum: number[], m: number): { point: LatLng; index: number } {
  if (path.length === 0) return { point: [0, 0], index: 0 }
  if (m <= 0) return { point: path[0], index: 0 }
  const total = cum[cum.length - 1]
  if (m >= total) return { point: path[path.length - 1], index: path.length - 1 }
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= m) lo = mid
    else hi = mid
  }
  const span = cum[hi] - cum[lo] || 1
  const t = (m - cum[lo]) / span
  return { point: interpolate(path[lo], path[hi], t), index: lo }
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

export function formatClock(secondsFromNow: number, now = Date.now()): string {
  const d = new Date(now + secondsFromNow * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

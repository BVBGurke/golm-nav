/**
 * Grundkarte: CARTO „dark matter“ als Rasterkacheln über OpenStreetMap-Daten.
 * Kein Schlüssel, kein Konto. Die Namensnennung bleibt auf der Karte stehen.
 */
export const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export const SOURCE = {
  buildings: 'campus-buildings',
  rail: 'campus-rail',
  route: 'campus-route',
  walked: 'campus-walked',
  highlight: 'campus-highlight',
  markers: 'campus-markers',
  user: 'campus-user',
  accuracy: 'campus-accuracy',
} as const

export const LAYER = {
  buildings: 'campus-buildings-fill',
  buildingOutline: 'campus-buildings-line',
  rail: 'campus-rail-line',
  routeCasing: 'campus-route-casing',
  routeLine: 'campus-route-line',
  walked: 'campus-walked-line',
  highlight: 'campus-highlight-line',
  markers: 'campus-markers-dot',
  markerLabels: 'campus-markers-label',
  userAccuracy: 'campus-user-accuracy',
  userDot: 'campus-user-dot',
} as const

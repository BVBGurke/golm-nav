import type { Map as MapLibreMap } from 'maplibre-gl'
import type { CampusData, Poi } from '@/types'
import { LAYER, SOURCE } from './mapStyle'
import { buildingsToFeatureCollection, emptyCollection, poisToFeatureCollection, railToFeatureCollection } from './geojson'

export const BUILDING_COLORS = [
  'match',
  ['get', 't'],
  'university',
  '#1c4a7d',
  'dormitory',
  '#1c6350',
  'science',
  '#463a7d',
  'train_station',
  '#7d5c17',
  'school',
  '#6d2c37',
  'kindergarten',
  '#6d512c',
  'hotel',
  '#2c5170',
  'fire_station',
  '#6d2f2f',
  'church',
  '#3a4660',
  'commercial',
  '#26364c',
  'retail',
  '#26364c',
  'industrial',
  '#2f303c',
  '#1f2f45',
]

const OUTLINE_COLORS = [
  'match',
  ['get', 't'],
  'university',
  '#63b0e8',
  'dormitory',
  '#57cfa9',
  'science',
  '#ab93f5',
  '#93a9c6',
]

export const ROUTE_GRADIENT = [
  'interpolate',
  ['linear'],
  ['line-progress'],
  0,
  '#9dd3f7',
  0.45,
  '#2b86d9',
  0.85,
  '#f2b230',
  1,
  '#ffdd94',
]

/** Adds every static campus layer plus the empty dynamic sources. */
export function addCampusLayers(instance: MapLibreMap, data: CampusData, pois: Poi[]) {
  instance.addSource(SOURCE.buildings, {
    type: 'geojson',
    data: buildingsToFeatureCollection(data),
    promoteId: 'id',
  })
  instance.addSource(SOURCE.rail, { type: 'geojson', data: railToFeatureCollection(data) })

  instance.addLayer({
    id: LAYER.rail,
    type: 'line',
    source: SOURCE.rail,
    paint: { 'line-color': '#7f93b3', 'line-width': 1.1, 'line-opacity': 0.3, 'line-dasharray': [3, 3] },
  })

  instance.addLayer({
    id: LAYER.buildings,
    type: 'fill',
    source: SOURCE.buildings,
    minzoom: 12.8,
    paint: {
      'fill-color': BUILDING_COLORS as never,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12.8, 0, 14.2, 0.9],
    },
  })

  instance.addLayer({
    id: LAYER.buildingOutline,
    type: 'line',
    source: SOURCE.buildings,
    minzoom: 14.2,
    paint: {
      'line-color': OUTLINE_COLORS as never,
      'line-width': ['interpolate', ['linear'], ['zoom'], 14.2, 0.3, 18, 1.2],
      'line-opacity': 0.7,
    },
  })

  instance.addSource(SOURCE.route, { type: 'geojson', data: emptyCollection(), lineMetrics: true })

  instance.addLayer({
    id: LAYER.routeCasing,
    type: 'line',
    source: SOURCE.route,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#04101f', 'line-width': 12, 'line-opacity': 0.8, 'line-blur': 1 },
  })

  instance.addLayer({
    id: LAYER.routeLine,
    type: 'line',
    source: SOURCE.route,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3.5, 17, 6.5],
      'line-gradient': ROUTE_GRADIENT as never,
    },
  })

  instance.addSource(SOURCE.walked, { type: 'geojson', data: emptyCollection() })
  instance.addLayer({
    id: LAYER.walked,
    type: 'line',
    source: SOURCE.walked,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#f4f8ff', 'line-width': 2.2, 'line-opacity': 0.5, 'line-dasharray': [1.5, 2.6] },
  })

  instance.addSource(SOURCE.highlight, { type: 'geojson', data: emptyCollection() })
  instance.addLayer({
    id: LAYER.highlight,
    type: 'line',
    source: SOURCE.highlight,
    paint: {
      'line-color': ['match', ['get', 'kind'], 'selected', '#ffd97a', '#8ecbf7'] as never,
      'line-width': ['match', ['get', 'kind'], 'selected', 2.4, 1.8] as never,
      'line-blur': 2.5,
      'line-opacity': 0.95,
    },
  })

  /* destination markers + labels, visible from mid zoom on */
  instance.addSource(SOURCE.markers, { type: 'geojson', data: poisToFeatureCollection(pois), promoteId: 'id' })
  instance.addLayer({
    id: LAYER.markers,
    type: 'circle',
    source: SOURCE.markers,
    minzoom: 15,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 3, 17, 5.5],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#04101f',
      'circle-stroke-width': 1.6,
      'circle-opacity': 0.95,
    },
  })
  instance.addLayer({
    id: LAYER.markerLabels,
    type: 'symbol',
    source: SOURCE.markers,
    minzoom: 15.4,
    layout: {
      'text-field': ['get', 'short'],
      'text-font': ['Open Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 15.4, 10.5, 18, 13],
      'text-offset': [0, 1.05],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-padding': 4,
      'text-optional': true,
    },
    paint: {
      'text-color': '#dbe8f8',
      'text-halo-color': '#04101f',
      'text-halo-width': 1.6,
    },
  })

  instance.addSource(SOURCE.user, { type: 'geojson', data: emptyCollection() })
  instance.addLayer({
    id: LAYER.userAccuracy,
    type: 'circle',
    source: SOURCE.user,
    paint: { 'circle-radius': 0, 'circle-color': '#ffd97a', 'circle-opacity': 0.08 },
  })
  instance.addLayer({
    id: LAYER.userDot,
    type: 'circle',
    source: SOURCE.user,
    paint: {
      'circle-radius': 7,
      'circle-color': '#ffd97a',
      'circle-stroke-color': '#06203c',
      'circle-stroke-width': 3,
    },
  })
}

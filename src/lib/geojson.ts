import type { CampusData, LatLng, Poi } from '@/types'
import { KINDS } from './kinds'

/** GeoJSON-ish shapes, kept local so we do not depend on @types/geojson. */
export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export interface Feature {
  type: 'Feature'
  id?: string | number
  properties: Record<string, unknown>
  geometry: {
    type: 'Polygon' | 'LineString' | 'Point'
    coordinates: number[] | number[][] | number[][][]
  }
}

function ringToGeoJSON(ring: LatLng[]): number[][] {
  const out = ring.map(([lat, lon]) => [lon, lat])
  const first = out[0]
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]])
  return out
}

export function buildingsToFeatureCollection(data: CampusData): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.buildings.map((b) => ({
      type: 'Feature',
      id: b.id,
      properties: { id: b.id, t: b.t, n: b.n, h: b.h, a: b.a },
      geometry: { type: 'Polygon', coordinates: [ringToGeoJSON(b.r)] },
    })),
  }
}

export function railToFeatureCollection(data: CampusData): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.rail.map((line, i) => ({
      type: 'Feature',
      id: i,
      properties: {},
      geometry: { type: 'LineString', coordinates: line.map(([lat, lon]) => [lon, lat]) },
    })),
  }
}

export function poisToFeatureCollection(pois: Poi[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pois.map((p) => ({
      type: 'Feature',
      id: p.id,
      properties: { id: p.id, short: p.short, kind: p.kind, color: KINDS[p.kind].color, house: p.house },
      geometry: { type: 'Point', coordinates: [p.c[1], p.c[0]] },
    })),
  }
}

export function polylineToFeature(coords: LatLng[], properties: Record<string, unknown> = {}): Feature {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'LineString', coordinates: coords.map(([lat, lon]) => [lon, lat]) },
  }
}

export function pointToFeature(point: LatLng, properties: Record<string, unknown> = {}): Feature {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates: [point[1], point[0]] },
  }
}

export const emptyCollection = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })

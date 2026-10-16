export type LatLng = [number, number]

export interface Building {
  id: number
  /** name, empty when OSM has none */
  n: string
  /** house number */
  h: string
  s: string
  /** OSM building value */
  t: string
  lv: string
  /** footprint area in m² */
  a: number
  /** index into walk.coords, -1 when nothing close enough */
  g: number
  c: LatLng
  /** simplified footprint ring */
  r: LatLng[]
}

export interface CampusData {
  meta: {
    source: string
    generated: string
    bbox: { s: number; w: number; n: number; e: number }
    note: string
  }
  center: LatLng
  walk: { coords: LatLng[]; edges: [number, number, number][]; roads: [number, number, string][] }
  buildings: Building[]
  rail: LatLng[][]
}

export type PoiKind =
  | 'uni'
  | 'wohnen'
  | 'forschen'
  | 'essen'
  | 'lernen'
  | 'sport'
  | 'service'
  | 'verkehr'
  | 'sonstiges'

export interface Poi {
  id: string
  name: string
  short: string
  kind: PoiKind
  /** official house number, e.g. "27" */
  house: string
  /** "Haus 27" is spoken as a name too */
  alias: string
  c: LatLng
  /** walking graph node closest to the entrance */
  node: number
  /** source building id, 0 for standalone OSM POIs */
  building: number
  street: string
  hours?: string
  note?: string
  /** m² of the footprint */
  area: number
  search: string
}

export type Turn = 'start' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'straight' | 'arrive'

export interface RouteStep {
  index: number
  turn: Turn
  text: string
  distance: number
  at: LatLng
  /** travelled distance of the route at this step */
  atDistance: number
}

export interface Route {
  coords: LatLng[]
  /** cumulative metres at each coord */
  cum: number[]
  distance: number
  duration: number
  steps: RouteStep[]
  from: LatLng
  to: Poi
  computedAt: number
}


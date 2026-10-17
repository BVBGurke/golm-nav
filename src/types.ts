export type LatLng = [number, number]

export interface Building {
  id: number
  /** Name, leer wenn OSM keinen kennt */
  n: string
  /** Hausnummer */
  h: string
  s: string
  /** Gebäudewert aus OSM */
  t: string
  lv: string
  /** Grundfläche in m² */
  a: number
  /** Index in walk.coords, -1 wenn nichts nah genug liegt */
  g: number
  c: LatLng
  /** vereinfachter Umriss */
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
  /** Hausnummer, etwa „27“ */
  house: string
  /** „Haus 27“ ist auch ein Name */
  alias: string
  c: LatLng
  /** Wegeknoten am nächsten zum Eingang */
  node: number
  /** Gebäude-ID, 0 bei eigenständigen OSM-Punkten */
  building: number
  street: string
  hours?: string
  note?: string
  /** Grundfläche in m² */
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
  /** zurückgelegte Strecke an diesem Schritt */
  atDistance: number
}

export interface Route {
  coords: LatLng[]
  /** aufsummierte Meter an jeder Koordinate */
  cum: number[]
  distance: number
  duration: number
  steps: RouteStep[]
  from: LatLng
  to: Poi
  computedAt: number
}


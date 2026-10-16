import type { LatLng, Poi, Route, RouteStep, Turn } from '@/types'
import { bearing, bearingDelta, compass, cumulative, distance, formatDistance } from './geo'
import { WalkGraph } from './graph'

export interface Campus {
  graph: WalkGraph
  /** path segment name, keyed by node pair */
  roads: Map<number, string>
}

export const pairKey = (a: number, b: number) => (a < b ? a * 1_000_000 + b : b * 1_000_000 + a)

export function createCampus(coords: LatLng[], edges: [number, number, number][], roads: [number, number, string][]): Campus {
  const graph = new WalkGraph(coords, edges)
  const roadMap = new Map<number, string>()
  for (const [a, b, name] of roads) roadMap.set(pairKey(a, b), name)
  return { graph, roads: roadMap }
}

const TURN_SHORT: Record<Turn, string> = {
  start: 'Start',
  left: 'Links',
  right: 'Rechts',
  'slight-left': 'Links halten',
  'slight-right': 'Rechts halten',
  straight: 'Geradeaus',
  arrive: 'Ziel',
}

export const turnShort = (turn: Turn) => TURN_SHORT[turn]

function instruction(turn: Turn, road?: string, outBearing?: number): string {
  switch (turn) {
    case 'start':
      if (road) return `Los Richtung ${road}`
      return outBearing === undefined ? 'Los' : `Los nach ${compass(outBearing)}`
    case 'left':
      return road ? `Links abbiegen in die ${road}` : 'Links abbiegen'
    case 'right':
      return road ? `Rechts abbiegen in die ${road}` : 'Rechts abbiegen'
    case 'slight-left':
      return road ? `Leicht links halten Richtung ${road}` : 'Leicht links halten'
    case 'slight-right':
      return road ? `Leicht rechts halten Richtung ${road}` : 'Leicht rechts halten'
    case 'straight':
      return road ? `Geradeaus weiter auf ${road}` : 'Geradeaus weiter'
    case 'arrive':
      return 'Ziel erreicht'
  }
}

/** Distance in metres over which a bend counts as a turn. */
const STRAIGHT_TOLERANCE = 26
const SHARP_TOLERANCE = 150
const HARD_TOLERANCE = 55
/** Decisions closer together than this are treated as one junction. */
const JUNCTION_MERGE = 22

function turnKind(delta: number): Turn {
  const abs = Math.abs(delta)
  if (abs > HARD_TOLERANCE) return delta > 0 ? 'right' : 'left'
  return delta > 0 ? 'slight-right' : 'slight-left'
}

/**
 * Aus einer Koordinatenfolge werden die Navigationsschritte.
 *
 * Echte Fußwegdaten sind unscharf: eine einzelne Kreuzung erscheint oft als
 * mehrere Peilungswechsel hintereinander. Entscheidungen, die weniger als
 * JUNCTION_MERGE Meter auseinanderliegen, fallen zur stärksten zusammen. Die
 * Hinweisliste bleibt lesbar, ohne die eigentliche Abbiegung zu verlieren.
 */
function buildSteps(path: LatLng[], roadAt: (index: number) => string | undefined): RouteStep[] {
  const cum = cumulative(path)
  const total = cum[cum.length - 1]

  /* 1. collect every candidate manoeuvre */
  type Candidate = { index: number; delta: number; at: number }
  const candidates: Candidate[] = []
  for (let i = 1; i < path.length - 1; i++) {
    const delta = bearingDelta(bearing(path[i - 1], path[i]), bearing(path[i], path[i + 1]))
    if (Math.abs(delta) < STRAIGHT_TOLERANCE || Math.abs(delta) > SHARP_TOLERANCE) continue
    if (cum[i] - (candidates[candidates.length - 1]?.at ?? 0) < 5) continue
    candidates.push({ index: i, delta, at: cum[i] })
  }

  /* 2. a single junction often shows up as several bends — keep the strongest */
  const decisions: Candidate[] = []
  for (const candidate of candidates) {
    const previous = decisions[decisions.length - 1]
    if (previous && candidate.at - previous.at < JUNCTION_MERGE) {
      if (Math.abs(candidate.delta) > Math.abs(previous.delta)) decisions[decisions.length - 1] = candidate
      continue
    }
    decisions.push(candidate)
  }

  /* 3. turn them into sentences */
  const steps: RouteStep[] = [
    {
      index: 0,
      turn: 'start',
      text: instruction('start', roadAt(0), bearing(path[0], path[Math.min(1, path.length - 1)])),
      distance: 0,
      at: path[0],
      atDistance: 0,
    },
  ]

  for (const decision of decisions) {
    const turn = turnKind(decision.delta)
    steps.push({
      index: decision.index,
      turn,
      text: instruction(turn, roadAt(decision.index), bearing(path[decision.index], path[decision.index + 1])),
      distance: 0,
      at: path[decision.index],
      atDistance: decision.at,
    })
  }

  steps.push({
    index: path.length - 1,
    turn: 'arrive',
    text: instruction('arrive'),
    distance: 0,
    at: path[path.length - 1],
    atDistance: total,
  })

  /* 4. the distance of a step describes the leg that follows it */
  for (let i = 0; i < steps.length - 1; i++) {
    steps[i].distance = Math.round(steps[i + 1].atDistance - steps[i].atDistance)
  }

  return steps
}

export interface Guidance {
  /** the manoeuvre to perform next */
  step: RouteStep
  /** metres until it is due, 0 while standing on it */
  toTurn: number
  /** ready-to-read sentence */
  text: string
  /** true when the manoeuvre is happening now */
  now: boolean
  /** index of `step` inside route.steps */
  index: number
}

/**
 * Was als Nächstes zu tun ist. Der Abstand zählt bis zur kommenden Abbiegung
 * herunter und springt danach auf die folgende um.
 */
export function guidance(route: Route, travelled: number): Guidance {
  const nextIndex = route.steps.findIndex((s) => s.atDistance > travelled + 4)
  if (nextIndex === -1) {
    const last = route.steps[route.steps.length - 1]
    const left = Math.max(0, route.distance - travelled)
    return {
      step: last,
      toTurn: left,
      text: left <= 15 ? 'Du bist am Ziel' : `Noch ${formatDistance(left)} bis zum Ziel`,
      now: left <= 15,
      index: route.steps.length - 1,
    }
  }
  const step = route.steps[nextIndex]
  const toTurn = Math.max(0, step.atDistance - travelled)
  if (toTurn <= 12) {
    return { step, toTurn, text: `Jetzt ${step.text.replace(/^./, (c) => c.toLowerCase())}`, now: true, index: nextIndex }
  }
  return {
    step,
    toTurn,
    text: `In ${formatDistance(toTurn)} ${step.text.replace(/^./, (c) => c.toLowerCase())}`,
    now: false,
    index: nextIndex,
  }
}

/** Steps the walker still has ahead, starting with the pending manoeuvre. */
export function upcomingSteps(route: Route, travelled: number): RouteStep[] {
  return route.steps.filter((s) => s.atDistance > travelled + 4)
}

export function decisionCount(route: Route): number {
  return route.steps.filter((s) => s.turn !== 'start' && s.turn !== 'arrive').length
}

/** Compute a walking route from a live coordinate (or a fixed node) to a destination. */
export function routeTo(campus: Campus, from: LatLng, to: Poi, fromNode?: number): Route | null {
  const graph = campus.graph
  const start = fromNode ?? graph.nearest(from, 400)
  const goal = to.node >= 0 ? to.node : graph.nearest(to.c, 300)
  if (start < 0 || goal < 0) return null
  const nodePath = graph.routeNodes(start, goal)
  if (!nodePath) return null

  /* keep the raw GPS fix as a lead-in and the entrance as the final metres */
  const coords: LatLng[] = []
  const offset = distance(from, graph.coords[start]) > 5 ? (coords.push(from), 1) : 0
  for (const i of nodePath) coords.push(graph.coords[i])
  if (distance(graph.coords[goal], to.c) > 4) coords.push(to.c)

  const clamp = (n: number) => Math.max(0, Math.min(nodePath.length - 1, n))
  const roadAt = (index: number) => {
    const a = nodePath[clamp(index - offset)]
    const b = nodePath[clamp(index - offset + 1)]
    return campus.roads.get(pairKey(a, b))
  }

  const cum = cumulative(coords)
  const steps = buildSteps(coords, roadAt)
  const total = cum[cum.length - 1]

  return {
    coords,
    cum,
    distance: total,
    duration: total / graph.speed,
    steps,
    from: fromNode !== undefined ? graph.coords[fromNode] : from,
    to,
    computedAt: Date.now(),
  }
}

/**
 * Seitlicher Abstand eines Punkts von der Route, in Metern. Negativ ist links
 * der Gehrichtung. Dazu kommt, wie weit entlang der Route die Projektion liegt.
 */
export function lateralOffset(point: LatLng, path: LatLng[]): { offset: number; distanceAlong: number } {
  let best = Infinity
  let offset = 0
  let distanceAlong = 0
  let travelled = 0
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]
    const b = path[i + 1]
    const segLen = distance(a, b)
    const k = Math.cos((point[0] * Math.PI) / 180)
    const px = point[1] * k
    const py = point[0]
    const ax = a[1] * k
    const ay = a[0]
    const dx = b[1] * k - ax
    const dy = b[0] - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    const d = Math.hypot((px - (ax + t * dx)) * 111320, (py - (ay + t * dy)) * 111320)
    if (d < best) {
      best = d
      offset = dx * (py - ay) - dy * (px - ax) >= 0 ? d : -d
      distanceAlong = travelled + t * segLen
    }
    travelled += segLen
  }
  return { offset, distanceAlong }
}

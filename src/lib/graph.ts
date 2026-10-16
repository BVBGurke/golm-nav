import type { LatLng } from '@/types'
import { M_PER_DEG_LAT, distance } from './geo'

/**
 * Routing graph over the OSM footpath network.
 *
 * The data set carries ~3.4 k nodes and ~3.8 k edges, so a binary heap A* with
 * a straight-line heuristic answers a campus query in well under a millisecond.
 * Everything runs in the browser; no routing service, no API key.
 */
export class WalkGraph {
  readonly coords: LatLng[]
  private readonly offsets: Int32Array
  private readonly targets: Int32Array
  private readonly weights: Float64Array
  private readonly cell = 0.0022 // ≈ 245 m index buckets
  private readonly grid = new Map<number, number[]>()
  private readonly maxSpeed = 1.42 // m/s, average walking pace

  constructor(coords: LatLng[], edges: [number, number, number][]) {
    this.coords = coords
    const degree = new Int32Array(coords.length)
    for (const [a, b] of edges) {
      degree[a]++
      degree[b]++
    }
    this.offsets = new Int32Array(coords.length + 1)
    for (let i = 0; i < coords.length; i++) this.offsets[i + 1] = this.offsets[i] + degree[i]
    this.targets = new Int32Array(edges.length * 2)
    this.weights = new Float64Array(edges.length * 2)
    const cursor = this.offsets.slice(0, coords.length) as Int32Array
    for (const [a, b, w] of edges) {
      this.targets[cursor[a]] = b
      this.weights[cursor[a]++] = w
      this.targets[cursor[b]] = a
      this.weights[cursor[b]++] = w
    }
    for (let i = 0; i < coords.length; i++) {
      const key = this.cellKey(coords[i])
      const bucket = this.grid.get(key)
      if (bucket) bucket.push(i)
      else this.grid.set(key, [i])
    }
  }

  private cellKey([lat, lon]: LatLng): number {
    const i = Math.floor(lat / this.cell) + 4096
    const j = Math.floor(lon / this.cell) + 8192
    return i * 65536 + j
  }

  /** Nearest graph node to a coordinate, or -1 when nothing is within maxM. */
  nearest(point: LatLng, maxM = 250): number {
    const i = Math.floor(point[0] / this.cell) + 4096
    const j = Math.floor(point[1] / this.cell) + 8192
    let best = -1
    let bestD = maxM
    for (let ring = 0; ring <= 3; ring++) {
      for (let di = -ring; di <= ring; di++) {
        for (let dj = -ring; dj <= ring; dj++) {
          if (ring > 0 && Math.abs(di) !== ring && Math.abs(dj) !== ring) continue
          const bucket = this.grid.get((i + di) * 65536 + (j + dj))
          if (!bucket) continue
          for (const idx of bucket) {
            const d = distance(point, this.coords[idx])
            if (d < bestD) {
              bestD = d
              best = idx
            }
          }
        }
      }
      if (best >= 0 && ring >= 1) break
    }
    return best
  }

  /** Shortest path between two coordinates. Returns null if either end is off-graph. */
  route(from: LatLng, to: LatLng, maxSnap = 300): number[] | null {
    const start = this.nearest(from, maxSnap)
    const goal = this.nearest(to, maxSnap)
    if (start < 0 || goal < 0) return null
    return this.routeNodes(start, goal)
  }

  routeNodes(start: number, goal: number): number[] | null {
    if (start === goal) return [start]
    const n = this.coords.length
    const g = this.gScores.length === n ? this.gScores : (this.gScores = new Float64Array(n))
    const prev = this.prevNodes.length === n ? this.prevNodes : (this.prevNodes = new Int32Array(n))
    const closed = this.closed.length === n ? this.closed : (this.closed = new Uint8Array(n))
    g.fill(Infinity)
    prev.fill(-1)
    closed.fill(0)

    const goalCoord = this.coords[goal]
    const scaleLat = 1 / M_PER_DEG_LAT
    const scaleLon = 1 / (M_PER_DEG_LAT * Math.cos((goalCoord[0] * Math.PI) / 180))
    const heuristic = (i: number) => {
      const c = this.coords[i]
      const dy = (c[0] - goalCoord[0]) * scaleLat
      const dx = (c[1] - goalCoord[1]) * scaleLon
      return Math.hypot(dx, dy) * M_PER_DEG_LAT * 1.42 * 0.98
    }

    const heap = new MinHeap(1024)
    g[start] = 0
    heap.push(heuristic(start), start)

    while (heap.size > 0) {
      const current = heap.pop()
      if (current === goal) break
      if (closed[current]) continue
      closed[current] = 1
      const gc = g[current]
      for (let e = this.offsets[current]; e < this.offsets[current + 1]; e++) {
        const next = this.targets[e]
        if (closed[next]) continue
        const tentative = gc + this.weights[e]
        if (tentative < g[next]) {
          g[next] = tentative
          prev[next] = current
          heap.push(tentative + heuristic(next), next)
        }
      }
    }

    if (g[goal] === Infinity) return null
    const path: number[] = []
    for (let at = goal; at !== -1; at = prev[at]) path.push(at)
    return path.reverse()
  }

  /** Walking distance along a node path, in metres. */
  pathLength(path: number[]): number {
    let total = 0
    for (let i = 1; i < path.length; i++) total += distance(this.coords[path[i - 1]], this.coords[path[i]])
    return total
  }

  get speed(): number {
    return this.maxSpeed
  }

  private gScores = new Float64Array(0)
  private prevNodes = new Int32Array(0)
  private closed = new Uint8Array(0)
}

class MinHeap {
  private items: number[] = []
  private priorities: number[] = []

  constructor(capacity: number) {
    this.items = new Array(capacity)
    this.priorities = new Array(capacity)
  }

  get size(): number {
    return this.items.length
  }

  push(priority: number, value: number): void {
    this.items.push(value)
    this.priorities.push(priority)
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.priorities[parent] <= this.priorities[i]) break
      this.swap(parent, i)
      i = parent
    }
  }

  pop(): number {
    const top = this.items[0]
    const lastValue = this.items.pop()!
    const lastPriority = this.priorities.pop()!
    if (this.items.length > 0) {
      this.items[0] = lastValue
      this.priorities[0] = lastPriority
      let i = 0
      for (;;) {
        const left = i * 2 + 1
        const right = left + 1
        let smallest = i
        if (left < this.items.length && this.priorities[left] < this.priorities[smallest]) smallest = left
        if (right < this.items.length && this.priorities[right] < this.priorities[smallest]) smallest = right
        if (smallest === i) break
        this.swap(i, smallest)
        i = smallest
      }
    }
    return top
  }

  private swap(a: number, b: number): void {
    const ti = this.items[a]
    ;[this.items[a], this.items[b]] = [this.items[b], ti]
    const tp = this.priorities[a]
    ;[this.priorities[a], this.priorities[b]] = [this.priorities[b], tp]
  }
}

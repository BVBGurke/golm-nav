// Prüft den Routing-Graphen ohne Browser.
//
//   node docs/check-routes.mjs
//
// Vergleicht A* gegen Dijkstra. Beide müssen für jedes Ziel dieselbe Distanz
// liefern – tut A* das nicht, ist die Heuristik zulässig oder der Heap kaputt,
// und die App zeigt Umwege an. Zusätzlich wird pro Ziel das Verhältnis von
// Wegstrecke zu Luftlinie ausgegeben, damit grobe Datenfehler auffallen.
import { readFileSync } from 'node:fs'

const campus = JSON.parse(readFileSync(new URL('../src/data/campus.json', import.meta.url), 'utf8'))
const { pois } = JSON.parse(readFileSync(new URL('../src/data/pois.json', import.meta.url), 'utf8'))
const { coords, edges } = campus.walk

const M_PER_DEG_LAT = 111320
const metresPerDegLon = (lat) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)

const air = (i, j) =>
  Math.hypot(
    (coords[i][0] - coords[j][0]) * M_PER_DEG_LAT,
    (coords[i][1] - coords[j][1]) * metresPerDegLon(coords[j][0]),
  )

/* adjacency in compressed form, same layout as WalkGraph */
const offsets = new Int32Array(coords.length + 1)
for (const [a, b] of edges) {
  offsets[a + 1]++
  offsets[b + 1]++
}
for (let i = 0; i < coords.length; i++) offsets[i + 1] += offsets[i]
const targets = new Int32Array(edges.length * 2)
const weights = new Float64Array(edges.length * 2)
const cursor = offsets.slice(0, coords.length)
for (const [a, b, w] of edges) {
  targets[cursor[a]] = b
  weights[cursor[a]++] = w
  targets[cursor[b]] = a
  weights[cursor[b]++] = w
}

function search(start, goal, useHeuristic) {
  const g = new Float64Array(coords.length).fill(Infinity)
  const closed = new Uint8Array(coords.length)
  const key = (v) => (useHeuristic ? g[v] + air(v, goal) : g[v])

  const heap = [[key(start), start]]
  const push = (value) => {
    heap.push(value)
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (heap[parent][0] <= heap[i][0]) break
      ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
      i = parent
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      for (let i = 0; ; ) {
        const left = i * 2 + 1
        const right = left + 1
        let best = i
        if (left < heap.length && heap[left][0] < heap[best][0]) best = left
        if (right < heap.length && heap[right][0] < heap[best][0]) best = right
        if (best === i) break
        ;[heap[best], heap[i]] = [heap[i], heap[best]]
        i = best
      }
    }
    return top[1]
  }

  g[start] = 0
  while (heap.length) {
    const u = pop()
    if (u === goal) break
    if (closed[u]) continue
    closed[u] = 1
    for (let e = offsets[u]; e < offsets[u + 1]; e++) {
      const v = targets[e]
      if (closed[v]) continue
      const tentative = g[u] + weights[e]
      if (tentative < g[v]) {
        g[v] = tentative
        push([key(v), v])
      }
    }
  }
  return g[goal]
}

const station = pois.find((p) => p.name === 'Bahnhof Golm')
let mismatched = 0
let suspicious = 0

console.log(`${'Ziel'.padEnd(28)} ${'A*'.padStart(9)} ${'Dijkstra'.padStart(9)} ${'Luftlinie'.padStart(10)} Faktor`)
for (const poi of pois) {
  const astar = search(station.node, poi.node, true)
  const dijkstra = search(station.node, poi.node, false)
  const straight = air(station.node, poi.node)
  const factor = astar / Math.max(straight, 1)

  const distanceOff = Math.abs(astar - dijkstra) > 0.5
  const tooLong = factor > 2.4

  if (distanceOff) mismatched++
  if (distanceOff || tooLong) {
    suspicious++
    console.log(
      `${poi.short.padEnd(28)} ${astar.toFixed(0).padStart(9)} ${dijkstra.toFixed(0).padStart(9)} ` +
        `${straight.toFixed(0).padStart(10)} ${factor.toFixed(2)}${distanceOff ? '  <- A* weicht ab' : ''}`,
    )
  }
}

if (!suspicious) console.log('(nur Ausreißer würden hier auftauchen)')
console.log(
  mismatched === 0
    ? `\nA* stimmt mit Dijkstra überein: alle ${pois.length} Ziele.`
    : `\n${mismatched} von ${pois.length} Zielen weichen ab.`,
)

const started = performance.now()
for (let i = 0; i < 300; i++) search(station.node, pois[i % pois.length].node, true)
console.log(`300 Routen in ${(performance.now() - started).toFixed(0)} ms`)

process.exit(mismatched === 0 ? 0 : 1)

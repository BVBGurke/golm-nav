// Download the raw OSM data for Campus Golm.
//
//   node scripts/fetch_osm.mjs
//
// Writes scripts/data/tile-*.xml, which scripts/build_campus.mjs and
// scripts/dump_places.mjs consume. Overpass mirrors are tried first because they
// allow bigger bounding boxes; the main OSM API is the fallback and enforces a
// 0.25 deg² limit, hence the tiling.
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'

const OUT = 'scripts/data'

/* Campus Golm plus the walkable surroundings: Bahnhof, BaseCamp, Science Park. */
const BBOX = { s: 52.4028, w: 12.9618, n: 52.4172, e: 12.9905 }
const NX = 4
const NY = 4

const OVERPASS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const OSM_API = 'https://api.openstreetmap.org/api/0.6/map'

const isXml = (text) => text.trimStart().startsWith('<?xml')

function overpassQuery([s, w, n, e]) {
  const bb = `${s},${w},${n},${e}`
  return `[out:xml][timeout:90];(way["highway"](${bb});way["building"](${bb});way["railway"~"^(rail|light_rail|tram)$"](${bb});node["amenity"](${bb});node["shop"](${bb});node["leisure"](${bb});node["public_transport"](${bb}););out body;>;out skel qt;`
}

let mirror = 0

async function overpassTile(bb) {
  const url = OVERPASS[mirror++ % OVERPASS.length]
  const res = await fetch(`${url}?data=${encodeURIComponent(overpassQuery(bb))}`, {
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!isXml(text)) throw new Error('not XML')
  return text
}

async function osmApiTile([s, w, n, e]) {
  const res = await fetch(`${OSM_API}?bbox=${w},${s},${e},${n}`, { signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function tile(bb, index) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const xml = await overpassTile(bb)
      return { xml, source: 'overpass' }
    } catch (err) {
      if (attempt === 3) console.warn(`  overpass unavailable (${err.message}), falling back to the OSM API`)
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return { xml: await osmApiTile(bb), source: 'osm-api' }
    } catch (err) {
      if (attempt === 2) throw err
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
    }
  }
  throw new Error(`tile ${index} failed`)
}

mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT).filter((f) => f.endsWith('.xml'))) rmSync(`${OUT}/${f}`)

const lat = (BBOX.n - BBOX.s) / NY
const lon = (BBOX.e - BBOX.w) / NX
const jobs = []
for (let iy = 0; iy < NY; iy++) {
  for (let ix = 0; ix < NX; ix++) {
    jobs.push([
      +(BBOX.s + iy * lat).toFixed(5),
      +(BBOX.w + ix * lon).toFixed(5),
      +(BBOX.s + (iy + 1) * lat).toFixed(5),
      +(BBOX.w + (ix + 1) * lon).toFixed(5),
    ])
  }
}

let done = 0
let cursor = 0
const sources = new Set()

async function worker() {
  while (cursor < jobs.length) {
    const index = cursor++
    const bb = jobs[index]
    const { xml, source } = await tile(bb, index)
    sources.add(source)
    writeFileSync(`${OUT}/tile-${String(index).padStart(2, '0')}.xml`, xml)
    done++
    process.stdout.write(`\r${done}/${jobs.length} Kacheln (${(xml.length / 1024).toFixed(0)} KB)   `)
  }
}

await Promise.all([worker(), worker()])
console.log(`\nFertig. Quelle: ${[...sources].join(', ')} — Dateien in ${OUT}/`)

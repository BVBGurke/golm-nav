// Build the shipped campus dataset from the raw OSM XML dumps in osm/.
// Output: src/data/campus.json  (footpath graph + building footprints + rail lines)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";

const OUT = process.argv[2] || "src/data/campus.json";

const nodes = new Map();
const waysById = new Map();
for (const f of readdirSync("scripts/data").filter((f) => f.endsWith(".xml")).sort()) {
  const xml = readFileSync(`scripts/data/${f}`, "utf8");
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="(-?[\d.]+)"[^>]*?lon="(-?[\d.]+)"/g)) {
    nodes.set(m[1], [+m[2], +m[3]]);
  }
  for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    if (waysById.has(m[1])) continue; // the tiles overlap
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((x) => x[1]);
    const tags = {};
    for (const t of m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    waysById.set(m[1], { id: m[1], refs, tags });
  }
}
const ways = [...waysById.values()];

const M_PER_DEG_LAT = 111320;
const mPerDegLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
const dist = (a, b) =>
  Math.hypot((a[0] - b[0]) * M_PER_DEG_LAT, (a[1] - b[1]) * mPerDegLon(a[0]));

/* ---------------------------------------------------------------- walk graph */
const WALKABLE = /^(footway|path|pedestrian|steps|living_street|residential|unclassified|service|tertiary|secondary|primary|track|cycleway)$/;
const coordOf = new Map();
const byIndex = new Map();
let seq = 0;
const vid = (lat, lon) => {
  const k = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  let e = coordOf.get(k);
  if (!e) {
    e = { i: seq++, lat, lon };
    coordOf.set(k, e);
    byIndex.set(e.i, e);
  }
  return e.i;
};

const edges = [];
const adj = new Map();
const edgeSeen = new Set();
const link = (a, b) => {
  const A = byIndex.get(a);
  const B = byIndex.get(b);
  if (!A || !B || a === b) return;
  const w = dist([A.lat, A.lon], [B.lat, B.lon]);
  if (w < 0.05 || w > 400) return;
  const id = a < b ? `${a}:${b}` : `${b}:${a}`;
  if (edgeSeen.has(id)) return;
  edgeSeen.add(id);
  edges.push([a, b, +w.toFixed(1)]);
  (adj.get(a) ?? adj.set(a, []).get(a)).push([b, w]);
  (adj.get(b) ?? adj.set(b, []).get(b)).push([a, w]);
};

const walkWays = ways.filter(
  (w) => WALKABLE.test(w.tags.highway || "") && !w.tags.area && w.refs.length > 1,
);
const namedPairs = [];
for (const w of walkWays) {
  const ids = [];
  for (const r of w.refs) {
    const p = nodes.get(r);
    if (p) ids.push(vid(p[0], p[1]));
  }
  for (let i = 0; i + 1 < ids.length; i++) {
    link(ids[i], ids[i + 1]);
    if (w.tags.name) namedPairs.push([ids[i], ids[i + 1], w.tags.name]);
  }
}

/* keep only the big connected components — tiny fragments break routing UX */
const comp = new Map();
let compCount = 0;
for (const start of byIndex.keys()) {
  if (comp.has(start)) continue;
  const size = [];
  const stack = [start];
  comp.set(start, compCount);
  while (stack.length) {
    const cur = stack.pop();
    size.push(cur);
    for (const [nb] of adj.get(cur) ?? []) {
      if (!comp.has(nb)) {
        comp.set(nb, compCount);
        stack.push(nb);
      }
    }
  }
  compCount++;
}
const compSize = new Map();
for (const c of comp.values()) compSize.set(c, (compSize.get(c) || 0) + 1);
const keptComps = new Set([...compSize.entries()].filter(([, n]) => n >= 25).map(([c]) => c));

const keptEdges = edges.filter(([a]) => keptComps.has(comp.get(a)));
const usedNodes = new Set();
for (const [a, b] of keptEdges) {
  usedNodes.add(a);
  usedNodes.add(b);
}
const remap = new Map();
const coords = [];
for (const i of [...usedNodes].sort((a, b) => a - b)) {
  const n = byIndex.get(i);
  remap.set(i, coords.length);
  coords.push([+n.lat.toFixed(5), +n.lon.toFixed(5)]);
}
const graphEdges = keptEdges.map(([a, b, w]) => [remap.get(a), remap.get(b), w]);

/* street names, re-indexed to match the shipped graph */
const roads = [];
for (const [a, b, name] of namedPairs) {
  const ra = remap.get(a);
  const rb = remap.get(b);
  if (ra === undefined || rb === undefined) continue;
  roads.push(ra < rb ? [ra, rb, name] : [rb, ra, name]);
}

/* spatial index over graph nodes for snapping */
const CELL = 0.0025; // ~280 m
const grid = new Map();
const cellKey = (lat, lon) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;
coords.forEach(([lat, lon], i) => {
  const k = cellKey(lat, lon);
  (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
});
function nearestNode(lat, lon, maxM = 200) {
  const ci = Math.floor(lat / CELL);
  const cj = Math.floor(lon / CELL);
  let best = -1;
  let bestD = maxM;
  for (let r = 0; r <= 2; r++) {
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        for (const idx of grid.get(`${i}:${j}`) ?? []) {
          const d = dist([lat, lon], coords[idx]);
          if (d < bestD) {
            bestD = d;
            best = idx;
          }
        }
      }
    }
    if (best >= 0 && r >= 1) break;
  }
  return best;
}

/* ---------------------------------------------------------------- buildings */
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][1] + ring[i][1]) * (ring[j][0] - ring[i][0]);
  }
  const lat = ring[0][0];
  return Math.abs((a / 2) * M_PER_DEG_LAT * mPerDegLon(lat));
};

/* Douglas-Peucker, tolerance in degrees-ish via metre conversion */
function simplify(points, tolM) {
  if (points.length < 5) return points;
  const tol = tolM / M_PER_DEG_LAT;
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = -1;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDist(points[i], points[first], points[last]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol) {
      keep.add(idx);
      stack.push([first, idx], [idx, last]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}
function segDist(p, a, b) {
  const latScale = mPerDegLon(p[0]) / M_PER_DEG_LAT;
  const px = p[1] * latScale, py = p[0];
  const ax = a[1] * latScale, ay = a[0];
  const bx = b[1] * latScale, by = b[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const POI = /haus|hörsaal|hoersaal|institut|zentrum|center|labor|mensa|bibliothek|wohnheim|wohnanlage|student|stellwerk|golm|lab|biocyc|zelb|schule|kita|kirche|verwaltung|seminar|fakultät|fakultaet|campus|basecamp|innovationszentrum|bahnhof|apotheke|supermarkt|markt|hotel|restaurant|café|cafe|sporthalle|sport|turnhalle|museum|gästehaus|gaestehaus|kantine|verlag|technik|geoinformation|wissenschaft|kolleg|gymnasium|fraunhofer|max-planck|inno|h-lab|go:in/i;

const buildings = [];
for (const w of ways) {
  if (!w.tags.building || w.refs.length < 4) continue;
  const ring = w.refs.map((r) => nodes.get(r)).filter(Boolean);
  if (ring.length < 4 || ring.length > 90) continue;
  const area = ringArea(ring);
  const name = (w.tags.name || w.tags["addr:housename"] || "").trim();
  const nr = (w.tags["addr:housenumber"] || "").trim();
  const street = (w.tags["addr:street"] || "").trim();
  const isPoi = (name && POI.test(name)) || /^(university|dormitory|school|kindergarten|college|public|commercial|retail|hotel|industrial|office|civic|train_station|greenhouse|science)$/.test(w.tags.building);
  if (area < 45 && !isPoi) continue;
  if (!isPoi && !nr && area < 120) continue;
  const cLat = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cLon = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const snap = nearestNode(cLat, cLon, 220);
  const tol = isPoi ? 1.0 : 2.0;
  const r5 = (v) => +v.toFixed(5);
  const shape = simplify(ring, tol).map(([lat, lon]) => [r5(lat), r5(lon)]);
  buildings.push({
    id: +w.id,
    n: name,
    h: nr,
    s: street,
    t: w.tags.building,
    lv: w.tags["building:levels"] || "",
    a: Math.round(area),
    g: snap,
    c: [+cLat.toFixed(5), +cLon.toFixed(5)],
    r: shape,
  });
}

/* --------------------------------------------------------------------- rail */
const rail = ways
  .filter((w) => /^(rail|light_rail|tram)$/.test(w.tags.railway || "") && w.refs.length > 1)
  .map((w) => simplify(w.refs.map((r) => nodes.get(r)).filter(Boolean), 2.5).map(([lat, lon]) => [+lat.toFixed(5), +lon.toFixed(5)]))
  .filter((l) => l.length > 1);

const lats = coords.map((c) => c[0]);
const lons = coords.map((c) => c[1]);
const bbox = {
  s: +Math.min(...lats).toFixed(5),
  w: +Math.min(...lons).toFixed(5),
  n: +Math.max(...lats).toFixed(5),
  e: +Math.max(...lons).toFixed(5),
};

const out = {
  meta: {
    source: "OpenStreetMap contributors (ODbL)",
    generated: new Date().toISOString().slice(0, 10),
    bbox,
    note: "Footpath graph and building footprints extracted from OSM XML. Coordinates [lat, lon].",
  },
  center: [+((bbox.s + bbox.n) / 2).toFixed(5), +((bbox.w + bbox.e) / 2).toFixed(5)],
  walk: { coords, edges: graphEdges, roads },
  buildings,
  rail,
};

mkdirSync(OUT.replace(/\/[^/]+$/, ""), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));

const poi = buildings.filter((b) => b.n && POI.test(b.n));
console.log(`graph: ${coords.length} nodes, ${graphEdges.length} edges (${keptComps.size}/${compCount} components kept)`);
console.log(`buildings: ${buildings.length} total, ${poi.length} named POIs, ${buildings.filter((b) => b.g < 0).length} unsnapped`);
console.log(`rail lines: ${rail.length}, named path segments: ${roads.length}`);
console.log(`bbox: ${JSON.stringify(bbox)}`);
console.log(`size: ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
if (process.env.LIST_POI) {
  for (const b of poi.sort((a, b) => a.n.localeCompare(b.n, "de", { numeric: true }))) {
    console.log(`  ${b.n.padEnd(46)} ${(b.h || "").padEnd(5)} ${b.t.padEnd(12)} a=${b.a}m² g=${b.g}`);
  }
}

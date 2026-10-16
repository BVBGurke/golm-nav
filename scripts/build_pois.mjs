// Turn the OSM building dump into the curated destination list the UI shows.
// Output: <dest>/data/pois.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const campus = JSON.parse(readFileSync('src/data/campus.json', 'utf8'))
const DEST = process.argv[2] ?? 'src'

const KIND_LABEL = {
  uni: 'Universität',
  wohnen: 'Wohnen',
  forschen: 'Forschung',
  essen: 'Essen & Trinken',
  lernen: 'Lernen & Bibliothek',
  sport: 'Sport',
  service: 'Service',
  verkehr: 'Verkehr',
  sonstiges: 'Sonstiges',
}

/* Explicit kinds win over the keyword rules. */
const OVERRIDES = {
  'Cafeteria im IKMZ': 'essen',
  Lesecafé: 'lernen',
  'innoFSPEC Potsdam-Golm': 'forschen',
  'Biocyc GmbH': 'forschen',
  Biocyc: 'forschen',
  'GO:IN Golm Innovationszentrum': 'forschen',
  'GO:IN 2': 'forschen',
  'H-Lab': 'uni',
  'ZeLB I': 'lernen',
  Stellwerk: 'essen',
  'Bahnhof Golm': 'verkehr',
  KiTa: 'service',
  'goFIT studentischer Fitnessclub': 'sport',
  'Haus 30': 'forschen',
  'Haus 16': 'uni',
}

const RULES = [
  [/mensa|kantine|cafeteria|bistro|imbiss|backshop|döner|doner/i, 'essen'],
  [/wohnheim|wohnanlage|basecamp|apartment|studentenwohn/i, 'wohnen'],
  [/fraunhofer|max-planck|biocyc|inno|forschungs|labor|institut|observatorium|gewächshaus/i, 'forschen'],
  [/bibliothek|lesecaf|rechenzentrum|zelb|hörsaal|gedächtnis|archiv/i, 'lernen'],
  [/sport|turnhalle|schwimm|fitness|stadion|garten/i, 'sport'],
  [/kita|kindergarten|schule|gymnasium|hort/i, 'service'],
  [/klinik|arzt|apotheke|verwaltung|service|kasse|dhl|post|bank|kiosk|shop|markt|kauf/i, 'service'],
  [/bahnhof|stellwerk|haltestelle|bushof|bahnsteig/i, 'verkehr'],
  [/haus \d|go:in|h-lab|universität|hochschule|campus/i, 'uni'],
]

const HOURS = {
  'Mensa Golm': 'Mo–Fr 09:00–15:00',
  'Cafeteria im IKMZ': 'Mo–Fr ganztägig',
  Lesecafé: '24/7 offen',
  Stellwerk: 'Gastronomie · Theater im Bahnhof',
  'goFIT studentischer Fitnessclub': 'Mo–Fr 08:00–23:00',
  'Golm Dönerhaus': 'Mo–So 10:00–21:30',
}

const SHORT = {
  'Fraunhofer-Institut für Angewandte Polymerforschung': 'Fraunhofer IAP',
  'Fraunhofer Anwendungszentrum für Polymer-Nanotechnologien': 'Fraunhofer AZ',
  'Fraunhofer-Konferenzzentrum Potsdam-Golm': 'Fraunhofer Konferenzzentrum',
  'Max-Planck-Institut für Gravitationsphysik': 'MPI Gravitationsphysik',
  'Max-Planck-Campus Gästehaus': 'MPI Gästehaus',
  'GO:IN Golm Innovationszentrum': 'GO:IN',
  'goFIT studentischer Fitnessclub': 'goFIT',
  'KiTa': 'KiTa In der Feldmark',
  'ZeLB I': 'ZeLB I (im Bau)',
}

/* Building types that are never a destination on their own. */
const SKIP_TYPES = /^(garage|garages|carport|shed|hut|roof|silo|service|tree_house)$/

/* Generic OSM names that carry no navigational value once the specific
   building exists (e.g. two "Max-Planck-Campus" outlines). */
const DROP_NAMES = /^(Max-Planck-Campus|Fraunhofer-Campus|Landhotel Potsdam|Wohnheim|Alte Kirche|Kaiserkirche|Freiwillige Feuerwehr Golm)$/

const NAMED_POI = /haus|hörsaal|institut|zentrum|center|labor|mensa|bibliothek|wohnheim|stellwerk|golm|biocyc|zelb|schule|kita|verwaltung|campus|basecamp|innovationszentrum|bahnhof|markt|hotel|restaurant|café|cafe|sporthalle|sport|turnhalle|gymnasium|fraunhofer|max-planck|inno|go:in|h-lab|archiv|gästehaus|kantine|magistrale|kochstelle|presse/i

const seenNames = []
const pois = []

function kindFor(name, buildingType) {
  if (OVERRIDES[name]) return OVERRIDES[name]
  for (const [re, kind] of RULES) if (re.test(name)) return kind
  if (buildingType === 'dormitory') return 'wohnen'
  if (/^(university|college|school)$/.test(buildingType)) return 'uni'
  if (/^(train_station|public)$/.test(buildingType)) return 'verkehr'
  return 'sonstiges'
}

const metres = (a, b) => {
  const k = 111320 * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180))
  return Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * k)
}

const isDuplicate = (name, c) => seenNames.some((s) => s.name === name && metres(s.c, c) < 160)

/* ------------------------------------------------------------- buildings */
const named = campus.buildings
  .filter((b) => b.n && NAMED_POI.test(b.n) && !SKIP_TYPES.test(b.t) && !DROP_NAMES.test(b.n) && b.g >= 0)
  .sort((a, b) => b.a - a.a)

for (const b of named) {
  if (isDuplicate(b.n, b.c)) continue
  seenNames.push({ name: b.n, c: b.c })
  const houseMatch = /^(?:Haus|BaseCamp Haus)\s+([0-9]+[a-zA-Z]?)/.exec(b.n)
  pois.push({
    id: `b${b.id}`,
    name: b.n,
    short: SHORT[b.n] ?? b.n,
    kind: kindFor(b.n, b.t),
    house: houseMatch ? houseMatch[1] : b.h.replace(/[^0-9a-zA-Z/-]/g, ''),
    alias: houseMatch && !/basecamp/i.test(b.n) ? `Haus ${houseMatch[1]}` : '',
    c: b.c,
    node: b.g,
    building: b.id,
    street: b.s,
    hours: HOURS[b.n],
    area: b.a,
    note: b.t === 'construction' ? 'Bauarbeiten' : undefined,
  })
}

/* ------------------------------------------------- standalone OSM places */
const rawPlaces = JSON.parse(readFileSync('out/pois_raw.json', 'utf8'))

const EXTRAS = [
  ['Mensa Golm', 'canteen', 'essen'],
  ['Cafeteria im IKMZ', 'cafe', 'essen'],
  ['Lesecafé', 'cafe', 'lernen'],
  ['Golm Dönerhaus', 'fast_food', 'essen'],
  ['goFIT studentischer Fitnessclub', 'fitness_centre', 'sport'],
  ['innoFSPEC Potsdam-Golm', 'research', 'forschen'],
  ['Golm Bahnhof', 'platform', 'verkehr'],
]

function nearestNode(point, coords, maxM = 400) {
  let best = -1
  let bestD = maxM
  const cos = Math.cos((point[0] * Math.PI) / 180)
  for (let i = 0; i < coords.length; i++) {
    const d = Math.hypot((coords[i][0] - point[0]) * 111320, (coords[i][1] - point[1]) * 111320 * cos)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

for (const [name, type, kind] of EXTRAS) {
  const hit = rawPlaces.find((p) => p.name === name && p.kind === type)
  if (!hit) {
    console.warn(`! extra not found: ${name} (${type})`)
    continue
  }
  if (isDuplicate(name, hit.at)) continue
  const node = nearestNode(hit.at, campus.walk.coords)
  if (node < 0) {
    console.warn(`! no graph node near ${name}`)
    continue
  }
  seenNames.push({ name, c: hit.at })
  pois.push({
    id: `p${hit.id}`,
    name: name === 'Golm Bahnhof' ? 'Bahnhof Golm' : name,
    short: name === 'Golm Bahnhof' ? 'Bahnhof Golm' : (SHORT[name] ?? name),
    kind,
    house: '',
    alias: '',
    c: hit.at,
    node,
    building: 0,
    street: '',
    hours: HOURS[name],
    area: 0,
  })
}

/* --------------------------------------------------------- finalise text */
const ambiguous = new Map()
for (const p of pois) ambiguous.set(p.short, (ambiguous.get(p.short) ?? 0) + 1)
for (const p of pois) {
  if (ambiguous.get(p.short) > 1 && !p.alias) p.short = `${p.short} (${p.street || 'Golm'})`
  p.search = [p.name, p.short, p.alias, p.house && `Haus ${p.house}`, p.house, p.street, KIND_LABEL[p.kind], KIND_LABEL[p.kind].toLowerCase()]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

pois.sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }))

const payload = {
  meta: {
    source: 'OpenStreetMap contributors (ODbL)',
    generated: new Date().toISOString().slice(0, 10),
    kinds: KIND_LABEL,
    count: pois.length,
  },
  pois,
}

mkdirSync(DEST.endsWith('/src') || DEST === 'src' ? 'src/data' : `${DEST}/data`, { recursive: true })
writeFileSync(`${DEST}/data/pois.json`, JSON.stringify(payload, null, 1))

const byKind = {}
for (const p of pois) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1
console.log(`pois: ${pois.length}`, JSON.stringify(byKind))
if (process.env.LIST) {
  for (const p of pois) console.log(`  ${KIND_LABEL[p.kind].padEnd(19)} ${p.short.padEnd(40)} node=${String(p.node).padStart(4)}`)
}

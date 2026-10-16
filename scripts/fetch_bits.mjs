// Lädt Komponenten aus dem React-Bits-Register nach scripts/data/.
//
//   node scripts/fetch_bits.mjs [Name ...]
//
// Ohne Argumente werden die Namen aus scripts/data/bits.txt geholt — das ist
// dieselbe Liste, aus der src/bits/MANIFEST.json entsteht, damit Registry und
// Einbau nicht auseinanderlaufen. Die Registry liegt unter
// https://reactbits.dev/r/registry.json, jede Komponente zusätzlich als
// <Name>-TS-TW.json (TypeScript + Tailwind). Nach dem Holen: npm run data:bits.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(here, 'data')
mkdirSync(DATA, { recursive: true })

/** Nur für die erste Auswahl: woran beim Stöbern gedacht wurde. Was
 *  tatsächlich geholt wird, steht in scripts/data/bits.txt. */
const CANDIDATES = [
  // Aktionen
  'SpecularButton',
  'StarBorder',
  'HoldButton',
  'FlyingButton',
  'RubberSegment',
  // Listen und Karten
  'SwipeRow',
  'TiltedCard',
  'PixelCard',
  'Stepper',
  'Stack',
  // Navigations-Anzeigen
  'CometDial',
  'SloshGauge',
  'Radar',
  'StatusMark',
  'SwipeToast',
  // Text und Übergänge
  'TextLoop',
  'RotatingText',
  'AnimatedContent',
  'FadeContent',
  'GlideSelect',
  'OptionWheel',
  // Rahmen und Flächen
  'Dock',
  'LineSidebar',
  'GooeyNav',
  'CardNav',
  'GradualBlur',
  'GlassIcons',
  'MagicBento',
  'BorderGlow',
  'ElectricBorder',
  'DarkVeil',
  'Grainient',
  'Beams',
]

const listPath = resolve(DATA, 'bits.txt')
if (!existsSync(listPath)) writeFileSync(listPath, CANDIDATES.join('\n') + '\n')

const wanted = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readFileSync(listPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

const registryUrl = 'https://reactbits.dev/r/registry.json'
const registryPath = resolve(DATA, 'registry.json')
if (!existsSync(registryPath)) {
  const response = await fetch(registryUrl)
  if (!response.ok) throw new Error(`Registry nicht erreichbar: ${response.status}`)
  writeFileSync(registryPath, await response.text())
}

async function grab(name) {
  const slug = `${name}-TS-TW`
  const response = await fetch(`https://reactbits.dev/r/${slug}.json`)
  if (!response.ok) {
    console.log(`${name.padEnd(18)} fehlt (${response.status})`)
    return null
  }
  const body = await response.json()
  writeFileSync(resolve(DATA, `${name}.json`), JSON.stringify(body, null, 2))
  const bytes = body.files.reduce((sum, f) => sum + f.content.length, 0)
  const files = body.files.map((f) => f.path.split('/').pop()).join(' ')
  console.log(`${name.padEnd(18)} ${String(bytes).padStart(6)} B  ${body.dependencies?.join(' ') || '—'}  ${files}`)
  return { name, bytes, deps: body.dependencies ?? [] }
}

const done = []
for (const name of wanted) {
  const result = await grab(name)
  if (result) done.push(result)
}

const total = done.reduce((sum, d) => sum + d.bytes, 0)
const deps = [...new Set(done.flatMap((d) => d.deps))]
console.log(`\n${done.length} Komponenten, ${(total / 1024).toFixed(0)} kB Quelltext`)
console.log(`Abhängigkeiten: ${deps.join(', ') || 'keine'}`)

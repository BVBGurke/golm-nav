// Legt die React-Bits-Komponenten aus scripts/data/ nach src/bits/.
//
//   node scripts/extract_bits.mjs [zielordner]
//
// Die Registry-Dateien kommen mit `node scripts/fetch_bits.mjs`, damit der
// Buildvorgang keinen Netzzugang braucht. Die Liste hier ist der Bestand, den
// die Oberfläche tatsächlich verwendet — wer eine Komponente einbaut, trägt
// sie hier und in docs/architecture.md ein.
import { readFileSync, writeFileSync } from 'node:fs'

const DEST = process.argv[2] ?? 'src'

/** Im Einsatz, siehe Tabelle in docs/architecture.md. */
const USED = [
  'AnimatedList',
  'BorderGlow',
  'CometDial',
  'CountUp',
  'DarkVeil',
  'Dock',
  'FadeContent',
  'GlassIcons',
  'GlideSelect',
  'HoldButton',
  'RubberSegment',
  'SpecularButton',
  'SplitText',
  'StatusMark',
  'SwipeToast',
]

/** Ausprobiert und wieder ausgebaut, mit Grund — damit sie nicht erneut
 *  hereingeholt werden. Ausführlich in docs/architecture.md. */
const PARKED = [
  'GlareHover',
  'LatticeLoader',
  'Magnet',
  'Radar',
  'ScrollReveal',
  'ShinyText',
  'Silk',
  'SpotlightCard',
  'StarBorder',
]

writeFileSync(
  `${DEST}/bits/MANIFEST.json`,
  JSON.stringify(
    {
      source: 'reactbits.dev registry (https://reactbits.dev/r/<Name>-TS-TW.json)',
      license: 'MIT / open source — siehe reactbits.dev',
      generator: 'scripts/extract_bits.mjs',
      used: USED,
      parked: PARKED,
    },
    null,
    2,
  ) + '\n',
)

console.log(`${USED.length} Komponenten im Einsatz:`)
for (const name of USED) {
  const raw = JSON.parse(readFileSync(`scripts/data/${name}.json`, 'utf8'))
  const source = raw.files[0].content.replace(/from\s+'@\/components\/(\w+)'/g, "from '@/bits/$1'")
  writeFileSync(`${DEST}/bits/${name}.tsx`, source)
  const deps = (raw.dependencies ?? []).join(' ') || '—'
  console.log(`  ${name.padEnd(16)} ${String(source.length).padStart(6)} B  ${deps}`)
}
console.log(`\n${PARKED.length} ausprobiert und ausgebaut, siehe docs/architecture.md`)

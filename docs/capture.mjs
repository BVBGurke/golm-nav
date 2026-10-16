// Erzeugt die Screenshots für README und docs/screens/.
//
//   node docs/capture.mjs [url] [zielordner]
//
// Aufnahme in doppelter Pixeldichte, danach halbiert ImageMagick auf das
// Nennmaß zurück (siehe docs/screens/README.md). Der Server muss laufen:
// npm run serve
//
// Chromium wird über CHROME, die üblichen Fundorte und den Playwright-Cache
// gesucht; im Zweifel genügt `npx playwright install chromium`.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const URL_BASE = process.argv[2] ?? 'http://127.0.0.1:5174/'
const OUT = process.argv[3] ?? 'docs/screens'
mkdirSync(OUT, { recursive: true })

function findChrome() {
  const candidates = [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  const cache = join(homedir(), 'AppData/Local/ms-playwright')
  if (existsSync(cache)) {
    for (const entry of readdirSync(cache)) {
      if (!entry.startsWith('chromium-')) continue
      const exe = join(cache, entry, 'chrome-win64', 'chrome.exe')
      if (existsSync(exe)) candidates.push(exe)
    }
  }
  const found = candidates.find((path) => existsSync(path))
  if (!found) throw new Error('Kein Chromium gefunden. CHROME setzen oder `npx playwright install chromium`.')
  return found
}

function findMagick() {
  const candidates = [process.env.MAGICK, 'magick', 'C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe']
  for (const candidate of candidates.filter(Boolean)) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' })
      return candidate
    } catch {
      /* weitersuchen */
    }
  }
  console.warn('ImageMagick nicht gefunden – Screenshots bleiben in doppelter Auflösung.')
  return null
}

/**
 * Der Screenshot entsteht in doppelter Dichte, damit Text scharf bleibt, ist so
 * aber mehrere Megabyte groß. ImageMagick halbiert ihn und reduziert die
 * Farbtiefe, was rund 200 kB übrig lässt.
 */
function shrink(file) {
  if (!magick) return
  execFileSync(magick, [file, '-resize', '50%', '-strip', '-define', 'png:compression-level=9', '-colors', '200', `${file}.tmp`])
  renameSync(`${file}.tmp`, file)
}

const CHROME = findChrome()
const magick = findMagick()
const BAHNHOF = { latitude: 52.40905, longitude: 12.97206 }
const SEARCH = 'input[aria-label="Ziel suchen"]'
const NAV = (label) => `nav[aria-label="Bereiche"] >> text="${label}"`

const browser = await chromium.launch({ executablePath: CHROME })
const problems = []

async function shot(page, name, pause = 2200) {
  await page.waitForTimeout(pause)
  const file = `${OUT}/${name}.png`
  await page.screenshot({ path: file })
  shrink(file)
  console.log(`  ${name}.png`)
}

async function openPage(options) {
  const context = await browser.newContext({
    locale: 'de-DE',
    permissions: ['geolocation'],
    geolocation: BAHNHOF,
    ...options,
  })
  const page = await context.newPage()
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text().slice(0, 160)))
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 160)))
  return { context, page }
}

/* ------------------------------------------------------------------ Desktop */
const desktop = await openPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })

/* 01 — Einstieg */
await desktop.page.goto(URL_BASE, { waitUntil: 'networkidle' })
await shot(desktop.page, '01-start', 3400)

/* 02 — Karte, alle Ziele beschriftet, Dock und Ausschnittswahl am unteren Rand */
await desktop.page.getByRole('button', { name: 'Standort freigeben und starten' }).click()
await desktop.page.waitForTimeout(2600)
await desktop.page.locator(NAV('Karte')).click()
await desktop.page.waitForTimeout(1600)
await shot(desktop.page, '02-karte', 2600)

/* 03 — Ziele suchen und nach Kategorie eingrenzen */
await desktop.page.locator(NAV('Ziele')).click()
await desktop.page.waitForTimeout(1200)
await desktop.page.locator(SEARCH).fill('haus')
await desktop.page.waitForTimeout(900)
await desktop.page.getByLabel('Kategorie wählen').click()
await desktop.page.waitForTimeout(500)
await desktop.page.getByRole('option', { name: /^Forschung/ }).click()
await shot(desktop.page, '03-suche', 1600)
await desktop.page.getByLabel('Kategorie wählen').click()
await desktop.page.waitForTimeout(400)
await desktop.page.getByRole('option', { name: /^Alle/ }).click()
await desktop.page.waitForTimeout(600)

/* 04 — Route über den halben Campus */
await desktop.page.locator(SEARCH).fill('mpi gravitation')
await desktop.page.waitForTimeout(900)
await desktop.page.getByText('MPI Gravitationsphysik').first().click()
await shot(desktop.page, '04-route', 3400)

/* 05 — Live-Navigation unterwegs */
await desktop.page.getByRole('button', { name: /Navigation starten/i }).click()
await desktop.page.waitForTimeout(1400)
await desktop.context.setGeolocation({ latitude: 52.40835, longitude: 12.97155 })
await shot(desktop.page, '05-navigation', 3000)

/* 06 — Abweichung: automatische Neuberechnung */
await desktop.context.setGeolocation({ latitude: 52.4128, longitude: 12.9759 })
await shot(desktop.page, '06-abweichung', 5000)

/* --------------------------------------------------------------------- Mobil */
const phone = await openPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})
await phone.page.goto(URL_BASE, { waitUntil: 'networkidle' })
await phone.page.getByRole('button', { name: 'Standort freigeben und starten' }).click()
await phone.page.waitForTimeout(2600)
// Der Standorthinweis blendet sich nach seiner Laufzeit selbst aus; erst
// danach ist die Trefferliste wieder frei.
await phone.page.waitForTimeout(7000)
await phone.page.locator(SEARCH).fill('mensa')
await shot(phone.page, '07-mobil', 1400)

await browser.close()
console.log(problems.length ? `Konsolenfehler: ${problems.join(' | ')}` : 'keine Konsolenfehler')

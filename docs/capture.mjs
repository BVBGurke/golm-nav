// Erzeugt die Screenshots für README und docs/screens/.
//
//   node docs/capture.mjs [url] [zielordner]
//
// Aufnahme in doppelter Pixeldichte, danach auf Nennmaß herunterskalieren
// (siehe docs/screens/README.md). Der Server muss laufen: npm run serve
//
// Chromium wird über CHROME oder die üblichen Fundorte gesucht; im Zweifel
// genügt `npx playwright install chromium`.
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
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error('Kein Chromium gefunden. CHROME setzen oder `npx playwright install chromium`.') // prettier-ignore
  return found
}
const CHROME = findChrome()
const magick = findMagick()
const BAHNHOF = { latitude: 52.40905, longitude: 12.97206 }
const SEARCH = /Haus 27/i

const browser = await chromium.launch({ executablePath: CHROME })
const problems = []

async function openPage(options, mobile = false) {
  const context = await browser.newContext({
    locale: 'de-DE',
    permissions: ['geolocation'],
    geolocation: BAHNHOF,
    ...options,
  })
  const page = await context.newPage()
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text().slice(0, 160)))
  page.on('pageerror', (e) => problems.push(e.message.slice(0, 160)))
  await page.goto(URL_BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /nur umsehen/i }).click()
  await page.waitForTimeout(2000)
  return { context, page, mobile }
}

async function shot(page, name, pause = 2200) {
  await page.waitForTimeout(pause)
  const file = `${OUT}/${name}.png`
  await page.screenshot({ path: file })
  shrink(file)
  console.log(`  ${name}.png`)
}

/**
 * Der Screenshot entsteht in doppelter Dichte, damit Text scharf bleibt, ist so
 * aber mehrere Megabyte groß. ImageMagick halbiert ihn wieder und reduziert die
 * Farbtiefe – fehlt das Programm, bleibt die große Datei liegen.
 */
function shrink(file) {
  if (!magick) return
  execFileSync(magick, [file, '-resize', '50%', '-strip', '-define', 'png:compression-level=9', '-colors', '200', `${file}.tmp`]) // prettier-ignore
  renameSync(`${file}.tmp`, file)
}

function findMagick() {
  const candidates = [process.env.MAGICK, 'magick', 'C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe'] // prettier-ignore
  for (const candidate of candidates.filter(Boolean)) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' })
      return candidate
    } catch {}
  }
  console.warn('ImageMagick nicht gefunden – Screenshots bleiben in doppelter Auflösung.')
  return null
}

/* ------------------------------------------------------------------ Desktop */
const desktop = await openPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
})

/* 01 — Einstieg mit Standortfreigabe */
const intro = await desktop.context.newPage()
await intro.goto(URL_BASE, { waitUntil: 'networkidle' })
await intro.waitForTimeout(3200) // CountUp im Intro auszählen lassen
await shot(intro, '01-start', 0)
await intro.close()

/* 02 — Karte, alle Ziele beschriftet */
await desktop.page.getByRole('button', { name: /Standort freigeben/i }).first().click()
await desktop.page.waitForTimeout(2500)
await desktop.page.locator('.maplibregl-ctrl-zoom-in').click()
await shot(desktop.page, '02-karte', 2600)

/* 03 — Volltextsuche plus Kategoriefilter */
const search = desktop.page.getByPlaceholder(SEARCH)
await search.fill('haus')
await desktop.page.waitForTimeout(1200)
await desktop.page.getByRole('button', { name: /^Wohnen/ }).click()
await shot(desktop.page, '03-suche', 1400)
await desktop.page.getByRole('button', { name: /^Wohnen/ }).click()
await desktop.page.waitForTimeout(600)

/* 04 — Route über den Campus */
await search.fill('mpi gravitation')
await desktop.page.waitForTimeout(900)
await desktop.page.locator('li button').first().click()
await shot(desktop.page, '04-route', 3400)

/* 05 — Live-Navigation unterwegs */
await desktop.page.getByRole('button', { name: /Navigation starten/i }).click()
await desktop.page.waitForTimeout(1200)
await desktop.context.setGeolocation({ latitude: 52.40835, longitude: 12.97155 })
await shot(desktop.page, '05-navigation', 3000)

/* 06 — Abweichung: automatische Neuberechnung */
await desktop.context.setGeolocation({ latitude: 52.4128, longitude: 12.9759 })
await shot(desktop.page, '06-abweichung', 5000)

/* --------------------------------------------------------------------- Mobil */
const phone = await openPage(
  { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  true,
)
await phone.page.getByPlaceholder(SEARCH).fill('haus 27')
await shot(phone.page, '07-mobil', 1400)

await browser.close()
console.log(problems.length ? `Konsolenfehler: ${problems.join(' | ')}` : 'keine Konsolenfehler')

// Tailscale-Dienst für GolmNav: liefert den gebauten Stand aus.
//
//   npm run serve
//
// Eigener Port, damit nichts mit anderen Projekten kollidiert. Für den
// Handy-Test muss die Seite über HTTPS laufen, sonst verweigert der Browser die
// Standortfreigabe:
//
//   tailscale serve --bg --https=8443 http://127.0.0.1:4180
//   -> https://<host>.<tailnet>.ts.net:8443
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const PORT = Number(process.env.PORT ?? 4180)
const ROOT = 'dist'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.pbf': 'application/x-protobuf',
}

if (!existsSync(ROOT)) {
  console.error('dist/ fehlt – zuerst "npm run build" ausführen.')
  process.exit(1)
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let path = join(ROOT, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''))
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
  if (!existsSync(path)) path = join(ROOT, 'index.html') // SPA-Fallback

  const body = readFileSync(path)
  res.writeHead(200, {
    'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    'Cache-Control': extname(path) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  res.end(body)
}).listen(PORT, '0.0.0.0', () => {
  console.log(`GolmNav läuft auf http://0.0.0.0:${PORT} (Tailscale + LAN)`)
})

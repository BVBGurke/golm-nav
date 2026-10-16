import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * MapLibre looks for its worker next to its own module. Vite pre-bundles that
 * module into `.vite/deps`, so the shipped worker is out of reach (and CSP
 * blob workers are blocked in some setups). We publish the real worker file and
 * hand MapLibre its URL.
 */
function maplibreWorker(): Plugin {
  const file = 'maplibre-gl-worker.mjs'
  const from = resolve(here, 'node_modules/maplibre-gl/dist', file)
  let base = '/'

  const publish = (root: string) => {
    if (!existsSync(from)) return
    mkdirSync(root, { recursive: true })
    copyFileSync(from, resolve(root, file))
  }

  return {
    name: 'golmnav:maplibre-worker',
    configResolved(config) {
      base = config.base
    },
    configureServer(server) {
      publish(resolve(server.config.publicDir))
    },
    writeBundle(options, bundle) {
      void options
      void bundle
      publish(resolve(here, 'dist'))
    },
    // tell the client where the worker lives
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `window.__MAPLIBRE_WORKER_URL__=${JSON.stringify(`${base}${file}`)}`,
        },
      ]
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorker()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})

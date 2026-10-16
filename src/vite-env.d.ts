/// <reference types="vite/client" />

/**
 * MapLibre resolves its worker relative to its own module URL. Under Vite's
 * dependency pre-bundling that URL is a `.vite/deps` chunk, so the worker can no
 * longer be found and the map stays blank. Copying the shipped worker into the
 * public folder and pointing MapLibre at it fixes both dev and build.
 */
declare module 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url' {
  const url: string
  export default url
}

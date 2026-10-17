/// <reference types="vite/client" />

/**
 * MapLibre löst seinen Worker relativ zur eigenen Moduladresse auf. Unter
 * Vites Abhängigkeits-Vorbündelung ist das ein Chunk in `.vite/deps`, der
 * Worker damit unauffindbar und die Karte bleibt leer. Das Plugin kopiert ihn
 * nach public/ und zeigt MapLibre darauf; das trägt Entwicklung und Build.
 */
declare module 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url' {
  const url: string
  export default url
}

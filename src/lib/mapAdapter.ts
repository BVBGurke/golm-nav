import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

/**
 * Das installierte maplibre-gl liefert klassenbasierte Exporte, und die
 * Zugriffe unten sind je nach Version locker typisiert. Ein Adapter hält die
 * Strenge an einer Stelle, statt Typumwandlungen überall zu verteilen.
 */
export function source(instance: MapLibreMap, id: string): GeoJSONSource {
  return instance.getSource(id) as GeoJSONSource
}

import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

/**
 * The installed maplibre-gl build ships class-based exports, and the accessors
 * below are typed loosely in some versions. One adapter keeps the strictness in
 * a single file instead of scattering casts.
 */
export function source(instance: MapLibreMap, id: string): GeoJSONSource {
  return instance.getSource(id) as GeoJSONSource
}

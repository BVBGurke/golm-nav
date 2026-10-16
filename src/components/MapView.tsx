import { useEffect, useMemo, useRef, useState } from 'react'
import { LngLatBounds, Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import type { CampusData, LatLng, Poi, Route } from '@/types'
import { source } from '@/lib/mapAdapter'
import { BASEMAP_STYLE, LAYER, SOURCE } from '@/lib/mapStyle'
import { circleToFeature, emptyCollection, pointToFeature, polylineToFeature, type FeatureCollection } from '@/lib/geojson'
import { addCampusLayers } from '@/lib/mapLayers'

/* Vite pre-bundles MapLibre, which hides its worker from the library's own
 * URL resolution. The plugin in vite.config.ts publishes the worker and leaves
 * its URL on window; fall back to the default resolution when it is absent. */
const workerUrl = (window as Window & { __MAPLIBRE_WORKER_URL__?: string }).__MAPLIBRE_WORKER_URL__
if (workerUrl) setWorkerUrl(workerUrl)

interface MapViewProps {
  data: CampusData
  selected: Poi | null
  hovered: Poi | null
  pois: Poi[]
  route: Route | null
  travelled: number
  userPosition: LatLng | null
  /** Genauigkeit des GPS-Fixes in Metern, null ohne Fix */
  accuracy: number | null
  follow: boolean
  /** Kartenmaßstab, gesetzt über die Ausschnittswahl oder den Ring */
  zoom: number
  onSelectPoi: (poi: Poi) => void
  onMapClick: (point: LatLng) => void
}

/**
 * MapLibre wrapper: basemap, campus building footprints, live route line, the
 * user pin and the camera behaviour (follow mode vs. route overview).
 */
export default function MapView({
  data,
  selected,
  hovered,
  pois,
  route,
  travelled,
  userPosition,
  accuracy,
  follow,
  zoom,
  onSelectPoi,
  onMapClick,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const selectRef = useRef(onSelectPoi)
  const clickRef = useRef(onMapClick)
  selectRef.current = onSelectPoi
  clickRef.current = onMapClick

  const buildingOf = useMemo(() => new Map(data.buildings.map((b) => [b.id, b])), [data.buildings])
  const poisRef = useRef(pois)
  poisRef.current = pois

  useEffect(() => {
    if (!container.current || map.current) return
    const instance = new MapLibreMap({
      container: container.current,
      style: BASEMAP_STYLE,
      center: [data.center[1], data.center[0]],
      zoom: 15.4,
      minZoom: 12.8,
      maxZoom: 19.5,
      maxBounds: [
        [data.meta.bbox.w - 0.03, data.meta.bbox.s - 0.03],
        [data.meta.bbox.e + 0.03, data.meta.bbox.n + 0.03],
      ],
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
    })
    map.current = instance

    instance.on('load', () => {
      addCampusLayers(instance, data, poisRef.current)

      const setCursor = (value: string) => () => {
        instance.getCanvas().style.cursor = value
      }
      for (const layerId of [LAYER.buildings, LAYER.markers, LAYER.markerLabels]) {
        instance.on('mouseenter', layerId, setCursor('pointer'))
        instance.on('mouseleave', layerId, setCursor(''))
      }
      instance.on('click', (event) => {
        const hits = instance.queryRenderedFeatures(event.point, { layers: [LAYER.markers, LAYER.buildings] })
        const id = hits[0]?.id ?? hits[0]?.properties?.id
        if (id !== undefined && id !== null) {
          const hit = poisRef.current.find((p) => p.building === Number(id))
          if (hit) {
            selectRef.current(hit)
            return
          }
        }
        clickRef.current([event.lngLat.lat, event.lngLat.lng])
      })

      setReady(true)
    })

    instance.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    instance.addControl(new ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-left')

    return () => {
      instance.remove()
      map.current = null
      setReady(false)
    }
    // the map instance is created exactly once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setData = (id: string, collection: FeatureCollection) => {
    const instance = map.current
    const src = instance?.getSource(id)
    if (!instance || !ready || !src) return
    source(instance, id).setData(collection)
  }

  /* route line */
  useEffect(() => {
    setData(SOURCE.route, route ? { type: 'FeatureCollection', features: [polylineToFeature(route.coords)] } : emptyCollection())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, ready])

  /* progress already covered */
  useEffect(() => {
    if (!route) {
      setData(SOURCE.walked, emptyCollection())
      return
    }
    const walked: LatLng[] = []
    for (let i = 0; i < route.coords.length; i++) {
      if (route.cum[i] <= travelled) walked.push(route.coords[i])
      else {
        const before = route.coords[i - 1] ?? route.coords[i]
        const span = route.cum[i] - route.cum[i - 1] || 1
        const t = Math.min(1, Math.max(0, (travelled - route.cum[i - 1]) / span))
        walked.push([before[0] + (route.coords[i][0] - before[0]) * t, before[1] + (route.coords[i][1] - before[1]) * t])
        break
      }
    }
    setData(SOURCE.walked, walked.length > 1 ? { type: 'FeatureCollection', features: [polylineToFeature(walked)] } : emptyCollection())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, travelled, ready])

  /* own position, with the GPS uncertainty drawn to scale */
  useEffect(() => {
    setData(
      SOURCE.user,
      userPosition ? { type: 'FeatureCollection', features: [pointToFeature(userPosition)] } : emptyCollection(),
    )
    setData(
      SOURCE.accuracy,
      userPosition && accuracy && accuracy > 8
        ? { type: 'FeatureCollection', features: [circleToFeature(userPosition, Math.min(accuracy, 120))] }
        : emptyCollection(),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition, accuracy, ready])

  /* the scale is set outside the map, so the camera follows that value */
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return
    if (Math.abs(instance.getZoom() - zoom) < 0.05) return
    instance.easeTo({ zoom, duration: 450 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, ready])

  /* outlines of the selected and hovered destination */
  useEffect(() => {
    const features = []
    const ringOf = (id: number) => {
      const b = buildingOf.get(id)
      if (!b) return null
      const ring = b.r.map(([lat, lon]) => [lon, lat])
      ring.push(ring[0])
      return { type: 'Polygon' as const, coordinates: [ring] }
    }
    if (selected?.building) {
      const geometry = ringOf(selected.building)
      if (geometry) features.push({ type: 'Feature' as const, properties: { kind: 'selected' }, geometry })
    }
    if (hovered?.building && hovered.id !== selected?.id) {
      const geometry = ringOf(hovered.building)
      if (geometry) features.push({ type: 'Feature' as const, properties: { kind: 'hover' }, geometry })
    }
    setData(SOURCE.highlight, { type: 'FeatureCollection', features })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, hovered, buildingOf, ready])

  /* camera: follow the walker, otherwise frame the route or the selection */
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return
    if (follow && userPosition) {
      instance.easeTo({
        center: [userPosition[1], userPosition[0]],
        zoom: Math.max(instance.getZoom(), 16.6),
        duration: 650,
      })
      return
    }
    if (route && route.coords.length > 1) {
      const bounds = route.coords.reduce(
        (acc, c) => acc.extend([c[1], c[0]]),
        new LngLatBounds([route.coords[0][1], route.coords[0][0]], [route.coords[0][1], route.coords[0][0]]),
      )
      instance.fitBounds(bounds, {
        padding: { top: 120, bottom: 210, left: 420, right: 70 },
        duration: 850,
        maxZoom: 17.4,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.computedAt, follow, ready])

  useEffect(() => {
    const instance = map.current
    if (!instance || !ready || !selected || follow || route) return
    instance.easeTo({
      center: [selected.c[1], selected.c[0]],
      zoom: Math.max(instance.getZoom(), 16.4),
      duration: 750,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, ready])

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-base-900">
          <span className="flex items-center gap-2.5 text-[13px] text-ink-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
            Campus-Karte wird geladen
          </span>
        </div>
      )}
    </div>
  )
}

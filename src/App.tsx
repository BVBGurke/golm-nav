import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BorderGlow from '@/bits/BorderGlow'
import CometDial from '@/bits/CometDial'
import CountUp from '@/bits/CountUp'
import DarkVeil from '@/bits/DarkVeil'
import Dock from '@/bits/Dock'
import FadeContent from '@/bits/FadeContent'
import GlassIcons from '@/bits/GlassIcons'
import SpecularButton from '@/bits/SpecularButton'
import SplitText from '@/bits/SplitText'
import SwipeToast from '@/bits/SwipeToast'
import MapView from '@/components/MapView'
import { DestinationPanel, NavPanel, SearchPanel } from '@/components/panels'
import { ICONS, Icon, ProgressLine, Reading } from '@/components/ui'
import campusRaw from '@/data/campus.json'
import poisRaw from '@/data/pois.json'
import { useLiveLocation, useSmoothedHeading, type LocationState } from '@/hooks/useLiveLocation'
import { OFF_ROUTE_M, REROUTE_MS } from '@/lib/navigation'
import { WALK_SPEED } from '@/lib/walk'
import { ZOOM_STEPS } from '@/lib/zoom'
import { formatDistance, formatDuration } from '@/lib/geo'
import { KINDS, KIND_ORDER } from '@/lib/kinds'
import { createCampus, decisionCount, lateralOffset, routeTo, type Campus } from '@/lib/routing'
import type { CampusData, LatLng, Poi, PoiKind, Route } from '@/types'

const campusData = campusRaw as unknown as CampusData
const allPois = poisRaw.pois as Poi[]

/** Der Ring steht zwischen zwei Stufen; die Statusleiste nennt die nächste. */
function zoomLabel(value: number): string {
  let nearest: (typeof ZOOM_STEPS)[number] = ZOOM_STEPS[0]
  for (const step of ZOOM_STEPS) if (Math.abs(step.zoom - value) < Math.abs(nearest.zoom - value)) nearest = step
  return nearest.label
}

const NAV_ITEMS = [
  { id: 'karte', label: 'Karte', key: 'k' },
  { id: 'ziele', label: 'Ziele', key: 'z' },
  { id: 'route', label: 'Route', key: 'r' },
] as const

type Mode = 'explore' | 'navigate'
type Panel = 'ziele' | 'route'

export default function App() {
  const [campus] = useState<Campus>(() => createCampus(campusData.walk.coords, campusData.walk.edges, campusData.walk.roads))
  const [intro, setIntro] = useState(true)
  const [mode, setMode] = useState<Mode>('explore')
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Set<PoiKind>>(new Set())
  const [sort, setSort] = useState<'name' | 'near'>('name')
  const [zoom, setZoom] = useState<number>(ZOOM_STEPS[1].zoom)
  const [panel, setPanel] = useState<Panel>('ziele')
  const [selected, setSelected] = useState<Poi | null>(null)
  const [hovered, setHovered] = useState<Poi | null>(null)
  const [route, setRoute] = useState<Route | null>(null)
  const [manualStart, setManualStart] = useState<LatLng | null>(null)
  const [travelled, setTravelled] = useState(0)
  const [offRoute, setOffRoute] = useState(false)
  const [following, setFollowing] = useState(true)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [computing, setComputing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(true)
  const [toastOpen, setToastOpen] = useState(false)
  const lastCompute = useRef(0)
  const live = useLiveLocation()
  useSmoothedHeading(live.heading)

  const liveState: LocationState = live
  const hasFix = liveState.status === 'live' && liveState.position !== null

  /* Einmal pro Sitzung: sobald der erste Fix da ist, erklärt die App, was mit
     dem Standort passiert. Danach nicht wieder. */
  useEffect(() => {
    if (!hasFix || sessionStorage.getItem('golmnav.location-notice')) return
    sessionStorage.setItem('golmnav.location-notice', '1')
    setToastOpen(true)
  }, [hasFix])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const terms = q ? q.split(/\s+/) : []
    const origin = liveState.position ?? manualStart
    const filtered = allPois.filter((p) => {
      if (kinds.size && !kinds.has(p.kind)) return false
      if (!terms.length) return true
      return terms.every((t) => p.search.includes(t))
    })
    if (sort === 'near' && origin) {
      const cos = Math.cos((origin[0] * Math.PI) / 180)
      const metres = (p: Poi) => Math.hypot((p.c[0] - origin[0]) * 111320, (p.c[1] - origin[1]) * 111320 * cos)
      return [...filtered].sort((a, b) => metres(a) - metres(b))
    }
    return filtered
  }, [query, kinds, sort, liveState.position, manualStart])

  const computeRoute = useCallback(
    (poi: Poi, from?: LatLng) => {
      const origin = from ?? liveState.position ?? manualStart
      if (!origin) {
        setRouteError('Kein Startpunkt. Standort freigeben oder auf die Karte tippen.')
        return null
      }
      setComputing(true)
      const next = routeTo(campus, origin, poi)
      setComputing(false)
      if (!next) {
        setRouteError('Für dieses Ziel wurde kein Weg gefunden.')
        setRoute(null)
        return null
      }
      setRouteError(null)
      setRoute(next)
      setTravelled(0)
      setOffRoute(false)
      lastCompute.current = Date.now()
      return next
    },
    [campus, liveState.position, manualStart],
  )

  const selectPoi = useCallback(
    (poi: Poi) => {
      setSelected(poi)
      setSheetOpen(true)
      setPanel('route')
      setMode('explore')
      setRoute(null)
      setTravelled(0)
      setRouteError(null)
      if (liveState.position || manualStart) computeRoute(poi)
    },
    [computeRoute, liveState.position, manualStart],
  )

  useEffect(() => {
    if (!route || !liveState.position) return
    const { distanceAlong, offset } = lateralOffset(liveState.position, route.coords)
    setTravelled(distanceAlong)
    const off = Math.abs(offset) > OFF_ROUTE_M
    setOffRoute(off)
    if (off && Date.now() - lastCompute.current > REROUTE_MS) {
      lastCompute.current = Date.now()
      const next = routeTo(campus, liveState.position, route.to)
      if (next) setRoute(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState.position, liveState.at, route?.computedAt])

  const startNavigation = useCallback(() => {
    if (!route) return
    setMode('navigate')
    setFollowing(true)
  }, [route])

  const stopNavigation = useCallback(() => {
    setMode('explore')
    setFollowing(true)
    setPanel('route')
  }, [])

  const showTargets = useCallback(() => {
    setSelected(null)
    setRoute(null)
    setTravelled(0)
    setOffRoute(false)
    setRouteError(null)
    setMode('explore')
    setPanel('ziele')
  }, [])

  const clearMap = useCallback(() => {
    showTargets()
    setSheetOpen(false)
  }, [showTargets])

  const onMapClick = useCallback(
    (point: LatLng) => {
      setManualStart(point)
      if (selected) computeRoute(selected, point)
    },
    [selected, computeRoute],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (event.key === 'Escape') (target as HTMLInputElement).blur()
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        setSheetOpen(true)
        showTargets()
        document.querySelector<HTMLInputElement>('input[aria-label="Ziel suchen"]')?.focus()
      }
      if (event.key === 'Escape') clearMap()
      if (event.key === 'l' || event.key === 'L') void live.enable()
      if (event.key === 'k' || event.key === 'K') setSheetOpen(false)
      if (event.key === 'z' || event.key === 'Z') { setSheetOpen(true); showTargets() }
      if (event.key === 'r' || event.key === 'R') { setSheetOpen(true); if (selected) setPanel('route') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearMap, showTargets, live, selected])

  const remaining = route ? Math.max(0, route.distance - travelled) : 0
  const progress = route && route.distance > 0 ? Math.min(1, travelled / route.distance) : 0
  const navigating = mode === 'navigate' && route !== null

  /* Der Einstieg endet entweder auf „Standort freigeben“ oder auf einer
     Kategorie; beide landen im Zielfilter. */
  const startWith = (kind: PoiKind | null) => {
    if (kind) {
      setPanel('ziele')
      setKinds(new Set([kind]))
      setQuery('')
    } else {
      void live.enable()
    }
    setIntro(false)
    setSheetOpen(true)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-base-900">
      <header className="absolute inset-x-0 top-0 z-40 flex h-[52px] items-stretch justify-between border-b border-line bg-base-900/85 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5 pl-4">
          <span className="grid h-6 w-6 shrink-0 place-items-center bg-action text-white">
            <Icon path={ICONS.route} size={14} strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="font-display block truncate text-[17px] leading-none font-bold tracking-tight text-ink">
              GolmNav
            </span>
            <span className="block text-[10px] leading-tight text-ink-3">Campus Golm, Universität Potsdam</span>
          </span>
        </div>

        <nav className="hidden items-stretch sm:flex" aria-label="Bereiche">
          {NAV_ITEMS.map((item) => {
            const active = item.id === 'karte' ? !sheetOpen : sheetOpen && panel === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'karte') return setSheetOpen(false)
                  setSheetOpen(true)
                  if (item.id === 'ziele') return showTargets()
                  if (selected) setPanel('route')
                  else showTargets()
                }}
                className={`relative px-5 text-[13px] transition-colors ${active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-signal" />}
              </button>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 pr-4">
          {route && (
            <button
              type="button"
              onClick={() => { setPanel('route'); setSheetOpen(true) }}
              className="hidden items-center gap-3 border border-line-2 px-3 py-1.5 transition-colors hover:border-line-3 lg:flex"
            >
              <Reading value={formatDistance(remaining)} label="bis zum Ziel" size="sm" />
              <span className="w-14">
                <ProgressLine value={progress} />
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void live.enable()}
            aria-label={hasFix ? 'Standort aktiv' : liveState.status === 'requesting' ? 'Standort wird gesucht' : 'Standort freigeben'}
            className={`flex items-center gap-2 border px-3 py-1.5 text-[12px] transition-colors ${
              hasFix ? 'border-go/40 text-go' : 'border-line-2 text-ink-2 hover:text-ink'
            }`}
          >
            <Icon path={ICONS.locate} size={15} className={liveState.status === 'requesting' ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">
              {hasFix ? 'Standort aktiv' : liveState.status === 'requesting' ? 'Wird gesucht' : 'Standort'}
            </span>
          </button>
        </div>
      </header>

      <div className="absolute inset-0">
        <MapView
          data={campusData}
          pois={allPois}
          selected={selected}
          hovered={hovered}
          route={route}
          travelled={travelled}
          userPosition={liveState.position}
          accuracy={liveState.accuracy}
          follow={navigating && following}
          zoom={zoom}
          onSelectPoi={selectPoi}
          onMapClick={onMapClick}
        />
      </div>

      {/* Das Panel legt sich über die Karte, statt sie zu verschieben: der
          Kartenmittelpunkt bleibt beim Öffnen und Schließen stehen. */}
      <aside
        className={`absolute inset-x-0 bottom-0 z-30 sm:inset-y-0 sm:top-[52px] sm:left-0 sm:max-h-none sm:w-[400px] ${
          navigating ? 'max-h-[58vh]' : 'max-h-[78vh]'
        } ${
          sheetOpen ? '' : 'translate-y-[calc(100%-3.25rem)] sm:-translate-x-full sm:translate-y-0'
        } transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        <div className="flex h-full flex-col border-t border-line bg-surface sm:border-t-0 sm:border-r">
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            className="flex items-center justify-between px-4 py-2.5 text-left sm:hidden"
            aria-label={sheetOpen ? 'Panel schließen' : 'Panel öffnen'}
          >
            <span className="h-1 w-10 bg-white/25" />
            <span className="text-[11px] text-ink-3">{sheetOpen ? 'schließen' : 'Ziele öffnen'}</span>
          </button>

          <div className="hidden items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:flex">
            <span className="min-w-0">
              <span className="font-display block truncate text-[15px] leading-tight font-semibold text-ink">
                {panel === 'route' && selected ? 'Ziel' : 'Campus Golm'}
              </span>
              <span className="block truncate text-[11px] text-ink-3">
                {panel === 'route' && selected ? selected.short : `${allPois.length} Häuser & Ziele`}
              </span>
            </span>
            {panel === 'route' && selected && (
              <button
                type="button"
                onClick={showTargets}
                className="flex shrink-0 items-center gap-1.5 text-[12px] text-ink-3 transition-colors hover:text-ink"
              >
                <Icon path={ICONS.layers} size={13} />
                Alle Ziele
              </button>
            )}
          </div>

          <FadeContent
            key={navigating ? 'nav' : panel === 'route' && selected ? 'route' : 'list'}
            trigger="mount"
            effect="develop"
            duration={0.45}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {navigating && route ? (
              <NavPanel
                route={route}
                travelled={travelled}
                offRoute={offRoute}
                heading={liveState.heading}
                onStop={stopNavigation}
                onRecenter={() => setFollowing((v) => !v)}
                following={following}
              />
            ) : panel === 'route' && selected ? (
              <DestinationPanel
                poi={selected}
                route={route}
                live={hasFix}
                locating={liveState.status === 'requesting'}
                loadingRoute={computing}
                onNavigate={startNavigation}
                onStop={() => setRoute(null)}
                onClear={showTargets}
                onLocate={() => (hasFix && selected ? computeRoute(selected) : void live.enable())}
                error={routeError}
              />
            ) : (
              <SearchPanel
                pois={allPois}
                results={results}
                state={{ query, kinds, sort }}
                onChange={(next) => {
                  if (next.query !== undefined) setQuery(next.query)
                  if (next.kinds !== undefined) setKinds(next.kinds)
                  if (next.sort !== undefined) setSort(next.sort)
                }}
                onSelect={selectPoi}
                onHover={setHovered}
                selected={selected}
                live={hasFix || manualStart !== null}
                onShowAll={() => {
                  setQuery('')
                  setKinds(new Set())
                  setZoom(ZOOM_STEPS[0].zoom)
                  setSheetOpen(false)
                }}
              />
            )}
          </FadeContent>
        </div>
      </aside>

      {navigating && (
        <div
          className={`absolute top-[64px] z-20 hidden transition-[left] duration-400 sm:block ${sheetOpen ? 'left-[416px]' : 'left-4'}`}
        >
          <BorderGlow
            glowColor="#f5b301"
            backgroundColor="#0c141f"
            borderRadius={3}
            glowIntensity={0.75}
            colors={['#f5b301', '#0b4ea2', '#5a9fe0']}
          >
            <div className="flex items-center gap-4 px-4 py-3">
              <CometDial
                value={zoom}
                onChange={setZoom}
                min={14}
                max={18.6}
                step={0.1}
                label="Kartenmaßstab"
                accent="#f5b301"
                ink="#e9eff6"
                size={76}
                thickness={6}
              />
              <span className="min-w-0">
                <span className="label-field block">Maßstab</span>
                <span className="font-display block pt-0.5 text-[15px] font-semibold text-ink">
                  {zoomLabel(zoom)}
                </span>
                <span className="block pt-1 text-[11px] text-ink-3">am Ring drehen</span>
              </span>
            </div>
          </BorderGlow>
        </div>
      )}

      {/* Die Hülle liegt über der ganzen Breite und lässt Zeigerereignisse
          durch; nur das Dock selbst nimmt sie an. */}
      {(!sheetOpen || navigating) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-9 z-20 hidden justify-center sm:flex">
          <Dock
            className="golm-dock"
            items={[
              {
                icon: <Icon path={ICONS.search} size={17} />,
                label: 'Ziele',
                onClick: () => { setSheetOpen(true); showTargets() },
              },
              {
                icon: <Icon path={ICONS.layers} size={17} />,
                label: `Maßstab: ${zoomLabel(zoom)}`,
                menu: ZOOM_STEPS.map((step) => ({
                  label: step.label,
                  onClick: () => setZoom(step.zoom),
                })),
              },
              ...(manualStart
                ? [
                    {
                      icon: <Icon path={ICONS.pinAdd} size={17} />,
                      label: 'Startpunkt löschen',
                      active: true,
                      onClick: () => setManualStart(null),
                    },
                  ]
                : []),
              {
                icon: <Icon path={ICONS.locate} size={17} />,
                label: hasFix ? 'Standort aktiv' : 'Standort freigeben',
                active: hasFix,
                onClick: () => void live.enable(),
              },
            ]}
            position="bottom"
            theme="dark"
            baseItemSize={40}
            magnification={56}
            distance={130}
            panelHeight={52}
            roundness={3}
            accentColor="#f5b301"
            showLabels
            showIndicators
          />
        </div>
      )}

      <StatusBar
        panelOpen={sheetOpen}
        zoom={zoom}
        pois={allPois.length}
        route={route}
        remaining={remaining}
        offRoute={offRoute}
        accuracy={hasFix ? liveState.accuracy : null}
      />

      {/* Die feste Hülle des Hinweises liegt über der ganzen Seite; nur die
          Meldung selbst darf Zeigerereignisse annehmen. */}
      <div className="pointer-events-none [&_[role=status]]:pointer-events-auto">
        <SwipeToast
          open={toastOpen}
          onClose={() => setToastOpen(false)}
          title="Standort ist aktiv"
          description="Die Position bleibt auf diesem Gerät. Es gibt keinen Server, an den sie gesendet wird."
          background="#0c141f"
          color="#e9eff6"
          fuseColor="#f5b301"
          duration={4500}
          closeButton
          width={336}
          radius={4}
        />
      </div>

      {intro && <Intro data={campusData} onDismiss={startWith} />}
    </div>
  )
}

/* --------------------------------------------------------------- Statusleiste */

function StatusBar({
  panelOpen,
  zoom,
  pois,
  route,
  remaining,
  offRoute,
  accuracy,
}: {
  panelOpen: boolean
  zoom: number
  pois: number
  route: Route | null
  remaining: number
  offRoute: boolean
  accuracy: number | null
}) {
  const label = zoomLabel(zoom)
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden items-center justify-between gap-4 border-t border-line bg-base-900/80 px-4 py-1.5 backdrop-blur-md sm:flex ${
        panelOpen ? 'sm:pl-[416px]' : ''
      }`}
    >
      <div className="flex items-center gap-4 truncate">
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-3">
          <Icon path={ICONS.layers} size={13} />
          {label}, {pois} Ziele
        </span>
        {accuracy !== null && accuracy >= 5 && (
          <span className="shrink-0 text-[11px] text-ink-3">GPS ± {Math.round(accuracy)} m</span>
        )}
        <span className="truncate text-[11px] text-ink-3">
          Kartendaten OpenStreetMap-Mitwirkende (ODbL), Kacheln CARTO
        </span>
      </div>
      {route && (
        <span className="flex shrink-0 items-center gap-4">
          <span className="text-[11px] text-ink-3">
            {decisionCount(route)} Abbiegungen, {formatDuration(remaining / WALK_SPEED)} übrig
          </span>
          {offRoute && <span className="text-[11px] font-semibold text-signal">Route wird neu berechnet</span>}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- Einstieg */

function Intro({ data, onDismiss }: { data: CampusData; onDismiss: (kind: PoiKind | null) => void }) {
  const facts = useMemo(() => {
    const pathKm = data.walk.edges.reduce((sum, [, , w]) => sum + w, 0) / 1000
    return [
      { label: 'Ziele', value: allPois.length, suffix: '' },
      { label: 'Gebäudeumrisse', value: data.buildings.length, suffix: '' },
      { label: 'Wegeknoten im Netz', value: data.walk.coords.length, suffix: '' },
      { label: 'Fußwege vermessen', value: Math.round(pathKm), suffix: ' km' },
    ]
  }, [data])

  const icons = KIND_ORDER.slice(0, 6).map((kind) => ({
    icon: <Icon path={KINDS[kind].icon} size={22} strokeWidth={1.7} />,
    color: `linear-gradient(140deg, ${KINDS[kind].color}38, ${KINDS[kind].color}0d)`,
    label: KINDS[kind].short,
    onClick: () => onDismiss(kind),
  }))

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-base-900">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <DarkVeil
          color="#0b4ea2"
          speed={0.4}
          scale={1.3}
          flow={0.8}
          warp={0.25}
          glow={0.5}
          grain={0.02}
          opacity={0.7}
          intro
        />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-center px-6 py-14">
        <p className="flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.08em] text-signal">
          <span className="h-px w-7 bg-signal" />
          Campus Golm, Universität Potsdam
        </p>

        <h1 className="pt-4 font-display text-[42px] leading-[0.96] font-bold tracking-[-0.015em] text-ink sm:text-[54px]">
          <SplitText text="Jedes Haus" splitType="words" tag="span" delay={70} duration={0.6} textAlign="left" className="block" />
          <span className="block text-ink-3">
            <SplitText text="auf dem Campus." splitType="words" tag="span" delay={160} duration={0.6} textAlign="left" className="block" />
          </span>
        </h1>

        <p className="max-w-[46ch] pt-5 text-[14px] leading-relaxed text-ink-2">
          Institute, Wohnheime, Mensa, Bibliothek, Bahnhof: {allPois.length} Ziele auf echten
          Gebäudeumrissen. Ziel wählen, Standort freigeben, und die App führt dich zu Fuß bis an die Tür.
        </p>

        <div className="mt-8 border-t border-line pt-4">
          <span className="label-field">Was in den Daten steckt</span>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="font-display text-[26px] leading-none font-semibold text-ink">
                  <CountUp to={fact.value} duration={1.2} separator="." suffix={fact.suffix} />
                </dt>
                <dd className="pt-1 text-[11px] leading-tight text-ink-3">{fact.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-7 label-field">Kategorie wählen</p>
        <div className="pt-3">
          <GlassIcons
            items={icons}
            size={56}
            columns={6}
            gap={12}
            roundness={2}
            refraction={1.4}
            bevel={0.5}
            frost={0.2}
            tint="#0b4ea2"
            iconColor="#ffffff"
            labels="always"
            theme="dark"
          />
        </div>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <SpecularButton
            onClick={() => onDismiss(null)}
            size="lg"
            radius={3}
            thickness={1}
            tint="#0b4ea2"
            tintOpacity={1}
            textColor="#ffffff"
            lineColor="#7cc0f2"
            baseColor="#041020"
            intensity={1.2}
            idleIntensity={0.3}
            glow={0.5}
            followMouse
            className="flex-1"
          >
            Standort freigeben und starten
          </SpecularButton>
          <button
            type="button"
            onClick={() => onDismiss(null)}
            className="border border-line-2 px-5 py-3 text-[14px] text-ink-2 transition-colors hover:border-line-3 hover:text-ink"
          >
            Erst umsehen
          </button>
        </div>

        <p className="pt-6 text-[11px] leading-relaxed text-ink-3">
          Karten- und Gebäudedaten von OpenStreetMap-Mitwirkenden (ODbL). Die Wegeberechnung läuft im Browser,
          ohne Routing-Dienst und ohne API-Schlüssel.
        </p>
      </div>
    </div>
  )
}

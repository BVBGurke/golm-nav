import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Silk from '@/bits/Silk'
import CountUp from '@/bits/CountUp'
import ShinyText from '@/bits/ShinyText'
import SplitText from '@/bits/SplitText'
import Magnetic from '@/bits/Magnet'
import GlareHover from '@/bits/GlareHover'
import PillNav from '@/bits/PillNav'
import MapView from '@/components/MapView'
import { DestinationPanel, NavPanel, SearchPanel } from '@/components/panels'
import { ICONS, Icon, KindIcon } from '@/components/ui'
import campusRaw from '@/data/campus.json'
import poisRaw from '@/data/pois.json'
import { useLiveLocation, useSmoothedHeading, type LocationState } from '@/hooks/useLiveLocation'
import { formatDistance, formatDuration, compass } from '@/lib/geo'
import { KINDS, KIND_ORDER } from '@/lib/kinds'
import { createCampus, decisionCount, lateralOffset, routeTo, type Campus } from '@/lib/routing'
import type { CampusData, LatLng, Poi, PoiKind, Route } from '@/types'

const data = campusRaw as unknown as CampusData
const allPois = poisRaw.pois as Poi[]

type Mode = 'explore' | 'navigate'

export default function App() {
  const [campus] = useState<Campus>(() => createCampus(data.walk.coords, data.walk.edges, data.walk.roads))
  const [intro, setIntro] = useState(true)
  const [mode, setMode] = useState<Mode>('explore')
  const [query, setQuery] = useState('')
  const [kinds, setKinds] = useState<Set<PoiKind>>(new Set())
  const [sort, setSort] = useState<'name' | 'near'>('name')
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
  const lastCompute = useRef(0)
  const live = useLiveLocation()
  useSmoothedHeading(live.heading)

  const liveState: LocationState = live
  const hasFix = liveState.status === 'live' && liveState.position !== null

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
      const m = (p: Poi) => Math.hypot((p.c[0] - origin[0]) * 111320, (p.c[1] - origin[1]) * 111320 * cos)
      return [...filtered].sort((a, b) => m(a) - m(b))
    }
    return filtered
  }, [query, kinds, sort, liveState.position, manualStart])

  /* --------------------------------------------------------- route compute */
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
      setMode('explore')
      setRoute(null)
      setTravelled(0)
      setRouteError(null)
      if (liveState.position || manualStart) computeRoute(poi)
    },
    [computeRoute, liveState.position, manualStart],
  )

  /* ------------------------------------------------------- progress + reroute */
  useEffect(() => {
    if (!route || !liveState.position) return
    const { distanceAlong, offset } = lateralOffset(liveState.position, route.coords)
    setTravelled(distanceAlong)
    const off = Math.abs(offset) > 40
    setOffRoute(off)
    if (off && Date.now() - lastCompute.current > 6000) {
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
  }, [])

  const clearAll = useCallback(() => {
    setSelected(null)
    setRoute(null)
    setTravelled(0)
    setOffRoute(false)
    setRouteError(null)
    setMode('explore')
  }, [])

  const onMapClick = useCallback(
    (point: LatLng) => {
      setManualStart(point)
      if (selected) computeRoute(selected, point)
    },
    [selected, computeRoute],
  )

  /* keyboard shortcuts */
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
        document.querySelector<HTMLInputElement>('input[placeholder^="Haus 27"]')?.focus()
      }
      if (event.key === 'Escape') clearAll()
      if (event.key === 'l' || event.key === 'L') void live.enable()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearAll, live])

  const remaining = route ? Math.max(0, route.distance - travelled) : 0
  const selectedIsNavActive = mode === 'navigate' && route && selected && route.to.id === selected.id

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <MapView
        data={data}
        pois={allPois}
        selected={selected}
        hovered={hovered}
        route={route}
        travelled={travelled}
        userPosition={liveState.position}
        follow={mode === 'navigate' && following}
        onSelectPoi={selectPoi}
        onMapClick={onMapClick}
      />

      <TopBar
        onLocate={() => void live.enable()}
        locating={liveState.status === 'requesting'}
        live={hasFix}
        onShowList={() => setSheetOpen((v) => !v)}
        listOpen={sheetOpen}
      />

      {hasFix && liveState.position && (liveState.status === 'live') && (
        <div className="pointer-events-none absolute bottom-24 left-4 z-20 sm:bottom-6 sm:left-6">
          <div className="glass-panel rounded-2xl px-3.5 py-2.5">
            <div className="text-[10px] tracking-wider text-slate-400 uppercase">Deine Position</div>
            <div className="mt-0.5 font-mono text-xs text-slate-100">
              {liveState.position[0].toFixed(5)}, {liveState.position[1].toFixed(5)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              ± {Math.round(liveState.accuracy ?? 0)} m
              {liveState.heading !== null && ` · Blick ${Math.round(liveState.heading)}° ${compass(liveState.heading)}`}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- sheet */}
      <aside
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 sm:inset-y-0 sm:left-0 sm:w-[384px] sm:pt-24 ${
          sheetOpen ? '' : 'translate-y-[calc(100%-4.5rem)] sm:-translate-x-[calc(100%-4.25rem)] sm:translate-y-0'
        } transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]`}
      >
        <div className="pointer-events-auto flex max-h-[86vh] min-h-[62vh] flex-col sm:h-full sm:max-h-none">
          <div className="glass-panel mx-2 flex min-h-0 flex-1 flex-col rounded-t-3xl sm:mx-4 sm:mb-4 sm:rounded-3xl">
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              className="flex items-center justify-between px-5 pt-4 pb-3 text-left sm:hidden"
              aria-label={sheetOpen ? 'Panel schließen' : 'Panel öffnen'}
            >
              <span className="h-1.5 w-14 rounded-full bg-white/25" />
              <span className="text-[11px] text-slate-400">{sheetOpen ? 'schließen' : 'öffnen'}</span>
            </button>

            <div className="hidden items-center justify-between px-5 pt-5 pb-3 sm:flex">
              <div>
                <div className="font-display text-sm tracking-wide text-white">
                  Campus <span className="text-up-300">Golm</span>
                </div>
                <div className="text-[11px] text-slate-400">{allPois.length} Häuser & Ziele</div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Panel einklappen"
              >
                <Icon path={ICONS.close} size={16} />
              </button>
            </div>

            {selectedIsNavActive && route ? (
              <NavPanel
                route={route}
                travelled={travelled}
                offRoute={offRoute}
                heading={liveState.heading}
                onStop={stopNavigation}
                onRecenter={() => setFollowing((v) => !v)}
                following={following}
              />
            ) : selected ? (
              <DestinationPanel
                poi={selected}
                route={route}
                live={hasFix}
                locating={liveState.status === 'requesting'}
                loadingRoute={computing}
                onNavigate={startNavigation}
                onStop={() => setRoute(null)}
                onClear={clearAll}
                onLocate={() => (hasFix ? selected && computeRoute(selected) : void live.enable())}
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
              />
            )}
          </div>
        </div>
      </aside>

      {/* --------------------------------------------------------- nav bottom */}
      {mode === 'navigate' && route && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-4 sm:pb-6">
          <div className="glass-panel pointer-events-auto flex items-center gap-4 rounded-2xl px-5 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-400/15 text-accent-400">
              <Icon path={ICONS.walk} size={20} />
            </div>
            <div>
              <div className="font-display text-lg leading-none font-semibold text-white">{formatDistance(remaining)}</div>
              <div className="text-[11px] text-slate-400">
                {decisionCount(route)} Abbiegungen · {route.to.short}
              </div>
            </div>
            <div className="hidden h-10 w-px bg-white/10 sm:block" />
            <div className="hidden sm:block">
              <div className="font-display text-lg leading-none font-semibold text-white">
                {formatDuration(remaining / 1.42)}
              </div>
              <div className="text-[11px] text-slate-400">Gehgeschwindigkeit 1,4 m/s</div>
            </div>
          </div>
        </div>
      )}

      {intro && <Intro data={data} onClose={() => setIntro(false)} onLocate={() => { void live.enable(); setIntro(false) }} />}
    </div>
  )
}

/* ------------------------------------------------------------------ top bar */

function TopBar({
  onLocate,
  locating,
  live,
  onShowList,
  listOpen,
}: {
  onLocate: () => void
  locating: boolean
  live: boolean
  onShowList: () => void
  listOpen: boolean
}) {
  const items = [
    { label: 'Karte', href: '#karte' },
    { label: 'Ziele', href: '#ziele' },
    { label: 'Route', href: '#route' },
  ]
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 p-4 sm:p-6">
      <div className="pointer-events-auto flex items-center gap-3">
        <div className="glass-panel flex items-center gap-3 rounded-2xl py-2.5 pr-4 pl-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-up-400 to-up-600 text-white shadow-inner">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21.4s6.6-6 6.6-10.6a6.6 6.6 0 1 0-13.2 0C5.4 15.4 12 21.4 12 21.4Z" />
              <path d="M12 10.6h.01" />
            </svg>
          </span>
          <span>
            <span className="block font-display text-sm leading-tight font-semibold tracking-wide text-white">
              Golm<span className="text-up-300">Nav</span>
            </span>
            <span className="block text-[10px] tracking-wider text-slate-400 uppercase">Campus Golm · Uni Potsdam</span>
          </span>
        </div>
      </div>

      <div className="pointer-events-auto hidden sm:block">
        <PillNav
          items={items}
          theme="dark"
          surface="glass"
          size="sm"
          highlightColor="#f2b230"
          highlightTextColor="#04101f"
          barColor="rgba(6,17,39,0.72)"
          textColor="#dbe6f5"
          intro={false}
          onItemClick={(item) => {
            if (item.href === '#ziele') onShowList()
          }}
        />
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onShowList}
          className="glass-panel grid h-11 w-11 place-items-center rounded-2xl text-slate-200 transition hover:text-white sm:hidden"
          aria-label={listOpen ? 'Liste schließen' : 'Zielliste öffnen'}
        >
          <Icon path={listOpen ? ICONS.close : ICONS.search} size={18} />
        </button>
        <button
          type="button"
          onClick={onLocate}
          className={`glass-panel flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-medium transition ${
            live ? 'text-emerald-300' : 'text-slate-100 hover:text-white'
          }`}
        >
          <Icon path={locating ? ICONS.compass : ICONS.locate} size={16} className={locating ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{live ? 'Standort aktiv' : locating ? 'Wird gesucht …' : 'Standort freigeben'}</span>
        </button>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------- intro sheet */

function Intro({ data, onClose, onLocate }: { data: CampusData; onClose: () => void; onLocate: () => void }) {
  const buildings = data.buildings.length
  const graphNodes = data.walk.coords.length
  const routeKm = useMemo(() => data.walk.edges.reduce((sum, [, , w]) => sum + w, 0) / 1000, [data.walk.edges])

  return (
    <div className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950/70 px-4 py-8 backdrop-blur-md">
      <div className="absolute inset-0 -z-10 opacity-40">
        <Silk speed={3.4} scale={1.1} color="#0a2b52" sheenColor="#3a86d9" noiseIntensity={0.9} rotation={0.2} glow={1.1} wave={0.6} paused={false} />
      </div>

      <div className="glass-panel relative w-full max-w-2xl overflow-hidden rounded-3xl p-7 sm:p-10">
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-up-400/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-accent-400 uppercase">
            <Icon path={ICONS.spark} size={14} />
            Campus-Navigation
          </div>

          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-semibold text-white sm:text-5xl">
            <SplitText text="Finde jedes Haus" splitType="words" tag="span" delay={40} duration={0.7} textAlign="left" className="block" />
            <ShinyText text="auf dem Campus Golm" color="#7cc0f2" shineColor="#ffffff" speed={3.2} className="mt-1 block text-up-300" />
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">
            Alle {allPois.length} Häuser, Institute und Wohnheime auf einer Karte. Ziel auswählen, Standort freigeben
            und der Campus Golm Navigator führt dich mit Live-Position, Blickrichtung und automatischer Neuberechnung
            bis an die Tür — Hausnummern, Wohnheime und Forschungscampus inklusive.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={allPois.length} label="Ziele" />
            <Stat value={buildings} label="Gebäude" />
            <Stat value={graphNodes} label="Wegeknoten" />
            <Stat value={Math.round(routeKm)} suffix=" km" label="Fußwege" />
          </div>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {KIND_ORDER.slice(0, 6).map((kind) => (
              <span
                key={kind}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: `${KINDS[kind].color}55`, background: `${KINDS[kind].color}14`, color: KINDS[kind].color }}
              >
                <KindIcon kind={kind} size={12} />
                {KINDS[kind].label}
              </span>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Magnetic magnetStrength={0.22} padding={14} className="flex-1">
              <button
                type="button"
                onClick={onLocate}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-up-400 to-up-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-up-500/30 transition hover:brightness-110"
              >
                <Icon path={ICONS.locate} size={18} />
                Standort freigeben und starten
              </button>
            </Magnetic>
            <GlareHover borderRadius="1rem" glareColor="#ffffff" glareOpacity={0.22} className="sm:w-auto" background="transparent">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl border border-up-400/30 px-5 py-3.5 text-sm text-slate-200 transition hover:border-up-400/70 hover:text-white"
              >
                Erst mal nur umsehen
              </button>
            </GlareHover>
          </div>

          <div className="mt-6 border-t border-white/8 pt-4 text-[11px] leading-relaxed text-slate-500">
            Kartendaten und Gebäudeumrisse: OpenStreetMap-Mitwirkende (ODbL), Kacheln von CARTO. Wegeberechnung
            ausschließlich im Browser — keine Anfragen an einen Routing-Dienst, kein API-Key. Eigener Standort
            verlässt das Gerät nicht.
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label, suffix }: { value: number; label: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-up-400/20 bg-ink-950/40 px-3 py-3">
      <div className="font-display text-2xl leading-none font-semibold text-white">
        <CountUp to={value} duration={1.4} separator="." suffix={suffix} />
      </div>
      <div className="mt-1 text-[10px] tracking-wider text-slate-400 uppercase">{label}</div>
    </div>
  )
}

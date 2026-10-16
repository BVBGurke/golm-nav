import { useEffect, useMemo, useRef } from 'react'
import LatticeLoader from '@/bits/LatticeLoader'
import { formatDistance, formatDuration, formatClock } from '@/lib/geo'
import { KINDS, KIND_ORDER } from '@/lib/kinds'
import { decisionCount, guidance, upcomingSteps, turnShort } from '@/lib/routing'
import type { Poi, PoiKind, Route } from '@/types'
import { ICONS, Icon, KindChip, KindIcon } from './ui'

interface SearchState {
  query: string
  kinds: Set<PoiKind>
  sort: 'name' | 'near'
}

interface SearchPanelProps {
  pois: Poi[]
  results: Poi[]
  state: SearchState
  onChange: (next: Partial<SearchState>) => void
  onSelect: (poi: Poi) => void
  onHover: (poi: Poi | null) => void
  selected: Poi | null
  live: boolean
}

export function SearchPanel({ pois, results, state, onChange, onSelect, onHover, selected, live }: SearchPanelProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [state.query, state.kinds, state.sort])

  const counts = useMemo(() => {
    const map = new Map<PoiKind, number>()
    for (const p of pois) map.set(p.kind, (map.get(p.kind) ?? 0) + 1)
    return map
  }, [pois])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-3">
        <label className="group flex items-center gap-2.5 rounded-2xl border border-up-400/25 bg-ink-950/60 px-3.5 py-2.5 transition focus-within:border-accent-400/60 focus-within:bg-ink-950/80">
          <Icon path={ICONS.search} size={17} className="shrink-0 text-up-300" />
          <input
            value={state.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Haus 27, Mensa, BaseCamp, MPI …"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {state.query && (
            <button
              type="button"
              onClick={() => onChange({ query: '' })}
              className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Suche leeren"
            >
              <Icon path={ICONS.close} size={14} />
            </button>
          )}
        </label>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ kinds: new Set() })}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              state.kinds.size === 0
                ? 'border-accent-400/70 bg-accent-400/15 text-accent-400'
                : 'border-up-400/25 text-slate-300 hover:border-up-400/60 hover:text-white'
            }`}
          >
            Alle {pois.length}
          </button>
          {KIND_ORDER.map((kind) => {
            const active = state.kinds.has(kind)
            const meta = KINDS[kind]
            return (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  const next = new Set(state.kinds)
                  if (active) next.delete(kind)
                  else next.add(kind)
                  onChange({ kinds: next })
                }}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition"
                style={
                  active
                    ? { borderColor: `${meta.color}aa`, background: `${meta.color}22`, color: meta.color }
                    : { borderColor: 'rgb(43 134 217 / 0.22)', color: 'rgb(203 213 225 / 0.85)' }
                }
              >
                <KindIcon kind={kind} size={11} />
                {meta.short}
                <span className="font-mono opacity-60">{counts.get(kind) ?? 0}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {results.length} von {pois.length} Zielen
          </span>
          <div className="flex gap-1">
            {(['name', 'near'] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                disabled={sort === 'near' && !live}
                onClick={() => onChange({ sort })}
                className={`rounded-full px-2.5 py-1 transition disabled:opacity-35 ${
                  state.sort === sort ? 'bg-up-500/30 text-white' : 'hover:bg-white/10'
                }`}
                title={sort === 'near' && !live ? 'Standortfreigabe nötig' : undefined}
              >
                {sort === 'name' ? 'A–Z' : 'Nächste'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {results.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-slate-400">
            Kein Haus gefunden. Andere Schreibweise versuchen oder Filter zurücksetzen.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {results.map((poi) => (
              <PoiRow
                key={poi.id}
                poi={poi}
                active={selected?.id === poi.id}
                onSelect={() => onSelect(poi)}
                onHover={onHover}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PoiRow({ poi, active, onSelect, onHover }: { poi: Poi; active: boolean; onSelect: () => void; onHover: (p: Poi | null) => void }) {
  const meta = KINDS[poi.kind]
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => onHover(poi)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(poi)}
        onBlur={() => onHover(null)}
        className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
          active
            ? 'border-accent-400/60 bg-accent-400/10'
            : 'border-transparent hover:border-up-400/35 hover:bg-white/5'
        }`}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
          style={{ borderColor: `${meta.color}55`, background: `${meta.color}18`, color: meta.color }}
        >
          <KindIcon kind={poi.kind} size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-100">{poi.short}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
            {poi.house && <span className="font-mono text-up-300">Haus {poi.house}</span>}
            {poi.house && poi.street && <span className="opacity-40">·</span>}
            {poi.street && <span className="truncate">{poi.street}</span>}
            {!poi.house && !poi.street && <span>{meta.label}</span>}
          </span>
        </span>
        <Icon
          path={ICONS.target}
          size={15}
          className={`shrink-0 transition ${active ? 'text-accent-400' : 'text-slate-600 group-hover:text-up-300'}`}
        />
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------ detail */

interface DestinationPanelProps {
  poi: Poi
  route: Route | null
  live: boolean
  locating: boolean
  loadingRoute: boolean
  onNavigate: () => void
  onStop: () => void
  onClear: () => void
  onLocate: () => void
  error: string | null
}

export function DestinationPanel({
  poi,
  route,
  live,
  locating,
  loadingRoute,
  onNavigate,
  onStop,
  onClear,
  onLocate,
  error,
}: DestinationPanelProps) {
  const meta = KINDS[poi.kind]
  const arrive = route ? formatClock(route.duration) : null
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-4">
        <div className="flex items-start gap-3.5">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border"
            style={{ borderColor: `${meta.color}66`, background: `${meta.color}1a`, color: meta.color }}
          >
            <KindIcon kind={poi.kind} size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight font-semibold text-white">{poi.short}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
              {poi.house && <span className="font-mono text-up-300">Haus {poi.house}</span>}
              {poi.street && <span>{poi.street}</span>}
              {poi.area > 0 && <span className="opacity-60">{poi.area.toLocaleString('de-DE')} m²</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Auswahl aufheben"
          >
            <Icon path={ICONS.close} size={16} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <KindChip kind={poi.kind} />
          {poi.hours && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
              <Icon path={ICONS.clock} size={12} />
              {poi.hours}
            </span>
          )}
          {poi.note && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
              <Icon path={ICONS.info} size={12} />
              {poi.note}
            </span>
          )}
        </div>
      </div>

      {route ? (
        <RouteSummary route={route} arrive={arrive} />
      ) : (
        <div className="mx-5 mb-4 rounded-2xl border border-up-400/20 bg-ink-950/50 px-4 py-3 text-xs text-slate-400">
          {live
            ? 'Route wird berechnet …'
            : 'Standort freigeben, um die Route von hier aus zu berechnen. Ohne Freigabe kannst du einen Startpunkt auf der Karte antippen.'}
        </div>
      )}

      {error && (
        <div className="mx-5 mb-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-auto space-y-2 px-5 pb-5">
        {route ? (
          <>
            <button
              type="button"
              onClick={onNavigate}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-up-400 to-up-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-up-500/25 transition hover:brightness-110"
            >
              <Icon path={ICONS.walk} size={18} />
              Navigation starten
            </button>
            <button
              type="button"
              onClick={onStop}
              className="w-full rounded-2xl border border-up-400/25 px-4 py-2.5 text-sm text-slate-300 transition hover:border-up-400/60 hover:text-white"
            >
              Route verwerfen
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onLocate}
              disabled={locating || loadingRoute}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-up-400 to-up-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-up-500/25 transition hover:brightness-110 disabled:opacity-60"
            >
              {loadingRoute ? (
                <LatticeLoader label="" cellSize={4} gap={2} />
              ) : (
                <Icon path={ICONS.locate} size={18} />
              )}
              {live ? 'Route berechnen' : 'Standort freigeben & route'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-2xl border border-up-400/25 px-4 py-2.5 text-sm text-slate-300 transition hover:border-up-400/60 hover:text-white"
            >
              Anderes Ziel wählen
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function RouteSummary({ route, arrive }: { route: Route; arrive: string | null }) {
  const decisions = decisionCount(route)
  return (
    <div className="mx-5 mb-4 grid grid-cols-3 gap-2">
      <Metric label="Distanz" value={formatDistance(route.distance)} />
      <Metric label="Gehzeit" value={formatDuration(route.duration)} />
      <Metric label="Ankunft" value={arrive ?? '–'} hint={`${decisions} Abbiegungen`} />
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-up-400/20 bg-ink-950/50 px-3 py-2.5">
      <div className="text-[10px] tracking-wider text-slate-400 uppercase">{label}</div>
      <div className="mt-0.5 font-display text-base font-semibold text-white">{value}</div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </div>
  )
}

/* -------------------------------------------------------------- navigation */

interface NavPanelProps {
  route: Route
  travelled: number
  offRoute: boolean
  heading: number | null
  onStop: () => void
  onRecenter: () => void
  following: boolean
}

export function NavPanel({ route, travelled, offRoute, heading, onStop, onRecenter, following }: NavPanelProps) {
  const { step, toTurn, text, now } = guidance(route, travelled)
  const remaining = Math.max(0, route.distance - travelled)
  const progress = route.distance > 0 ? Math.min(1, travelled / route.distance) : 0
  const stepsLeft = upcomingSteps(route, travelled)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] tracking-wider text-slate-400 uppercase">
            <span className={`h-2 w-2 rounded-full ${offRoute ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
            {offRoute ? 'Abseits der Route' : 'Live-Navigation'}
          </div>
          <button
            type="button"
            onClick={onStop}
            className="rounded-full border border-rose-400/30 px-3 py-1 text-[11px] text-rose-200 transition hover:bg-rose-400/15"
          >
            Beenden
          </button>
        </div>

        <div className="mt-3 flex items-start gap-3.5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-accent-400/50 bg-accent-400/15 text-accent-400">
            <TurnGlyph turn={step.turn} size={30} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl leading-tight font-semibold text-white">
              {step.turn === 'arrive' ? 'Ankunft' : now ? 'Jetzt' : formatDistance(toTurn)}
            </div>
            <div className={`mt-0.5 text-sm ${now ? 'font-medium text-emerald-200' : 'text-slate-200'}`}>{text}</div>
          </div>
        </div>

        {offRoute && (
          <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Du bist neben der Route – sie wird automatisch neu berechnet, sobald du weiter als 40 m abweichst.
          </div>
        )}
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-end justify-between text-xs text-slate-400">
          <span>
            Ziel: <span className="text-slate-200">{route.to.short}</span>
          </span>
          <span className="font-mono">{formatDistance(remaining)} · {formatDuration(remaining / 1.42)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-up-300 via-up-400 to-accent-400 transition-[width] duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {stepsLeft.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28 sm:pb-24">
          <div className="mb-2 text-[10px] tracking-wider text-slate-500 uppercase">Nächste Schritte</div>
          <ol className="space-y-1">
            {stepsLeft.slice(0, 8).map((s, i) => (
              <li key={`${s.index}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-up-400/25 text-up-300">
                  <TurnGlyph turn={s.turn} size={16} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{s.text}</span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">
                  {s.turn === 'arrive' ? formatDistance(Math.max(0, route.distance - travelled)) : formatDistance(Math.max(0, s.atDistance - travelled))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-white/8 px-5 py-4">
        <Compass heading={heading} />
        <button
          type="button"
          onClick={onRecenter}
          className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs transition ${
            following ? 'border-accent-400/60 bg-accent-400/12 text-accent-400' : 'border-up-400/25 text-slate-300 hover:text-white'
          }`}
        >
          <Icon path={ICONS.locate} size={15} />
          {following ? 'Folgt dir' : 'Zentrieren'}
        </button>
      </div>
    </div>
  )
}

function Compass({ heading }: { heading: number | null }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-up-400/20 bg-ink-950/50 px-3 py-2">
      <span
        className="grid h-8 w-8 place-items-center rounded-full border border-up-400/30 text-up-300 transition-transform duration-300"
        style={{ transform: `rotate(${heading ?? 0}deg)` }}
      >
        <Icon path={ICONS.compass} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] tracking-wider text-slate-500 uppercase">Blickrichtung</span>
        <span className="block font-mono text-xs text-slate-200">
          {heading === null ? 'kein Kompass' : `${Math.round(heading)}°`}
        </span>
      </span>
    </div>
  )
}

const TURN_PATHS: Record<string, string> = {
  start: 'M12 20.4V5.4 M6.6 10.8 12 5.4l5.4 5.4',
  left: 'M8.4 5.6v8.6a4 4 0 0 0 4 4h3.2 M8.4 5.6 4.6 9.6 M8.4 5.6l3.8 4',
  right: 'M15.6 5.6v8.6a4 4 0 0 1-4 4H8.4 M15.6 5.6l3.8 4 M15.6 5.6l-3.8 4',
  'slight-left': 'M12 20.4V9.6a5.4 5.4 0 0 0-5.4-5.4 M6.6 4.2 3.4 7.4 M6.6 4.2 9.8 7.4',
  'slight-right': 'M12 20.4V9.6a5.4 5.4 0 0 1 5.4-5.4 M17.4 4.2l3.2 3.2 M17.4 4.2 14.2 7.4',
  straight: 'M12 20.4V5 M6.6 10.4 12 5l5.4 5.4',
  arrive: 'M12 21.4s6.4-5.8 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15.6 12 21.4 12 21.4Z M9.6 11.4l1.8 1.8 3.4-3.6',
}

export function TurnGlyph({ turn, size = 20 }: { turn: keyof typeof TURN_PATHS | string; size?: number }) {
  return <Icon path={TURN_PATHS[turn] ?? TURN_PATHS.straight} size={size} strokeWidth={1.9} />
}

export { turnShort }

import { useEffect, useMemo, useRef } from 'react'
import AnimatedList from '@/bits/AnimatedList'
import HoldButton from '@/bits/HoldButton'
import GlideSelect from '@/bits/GlideSelect'
import RubberSegment from '@/bits/RubberSegment'
import StatusMark from '@/bits/StatusMark'
import { formatDistance } from '@/lib/geo'
import { OFF_ROUTE_M } from '@/lib/navigation'
import { KINDS, KIND_ORDER } from '@/lib/kinds'
import { decisionCount, guidance, upcomingSteps } from '@/lib/routing'
import { WALK_SPEED } from '@/lib/walk'
import type { Poi, PoiKind, Route } from '@/types'
import { ICONS, Icon, KindDot, Notice, ProgressLine, Reading, Row, SectionHead } from './ui'

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
  onShowAll: () => void
}

export function SearchPanel({
  pois,
  results,
  state,
  onChange,
  onSelect,
  onHover,
  selected,
  live,
  onShowAll,
}: SearchPanelProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [state.query, state.kinds, state.sort])

  const counts = useMemo(() => {
    const map = new Map<PoiKind, number>()
    for (const p of pois) map.set(p.kind, (map.get(p.kind) ?? 0) + 1)
    return map
  }, [pois])

  const kindOptions = useMemo(
    () => [
      { value: 'alle', label: `Alle ${pois.length}` },
      ...KIND_ORDER.filter((kind) => (counts.get(kind) ?? 0) > 0).map((kind) => ({
        value: kind,
        label: `${KINDS[kind].short} ${counts.get(kind) ?? 0}`,
      })),
    ],
    [counts, pois.length],
  )

  /* GlideSelect kennt nur einen Wert; die Suche filtert aber über mehrere
     Kategorien. Deshalb zeigt es die erste gesetzte und setzt beim Wählen neu. */
  const activeKind = state.kinds.size === 1 ? [...state.kinds][0] : 'alle'
  const hiddenKinds = state.kinds.size > 1

  const shown = results.slice(0, 60)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-4 pt-4 pb-3">
        {/* Ziele auf der Karte: welche Ziele hervorstechen, in welcher Dichte. */}
        <div>
          <SectionHead
            title="Ziele auf der Karte"
            aside={
              <button type="button" onClick={onShowAll} className="text-[12px] text-ink-2 hover:text-ink">
                Auf der Karte zeigen
              </button>
            }
          />
          <GlideSelect
            options={kindOptions}
            value={hiddenKinds ? 'alle' : activeKind}
            onChange={(value) => onChange({ kinds: value === 'alle' ? new Set() : new Set([value as PoiKind]) })}
            placeholder="Kategorie"
            accentColor="#f5b301"
            surfaceColor="#0c141f"
            highlightColor="#1a2634"
            textColor="#e9eff6"
            size="md"
            radius={2}
            menuWidth={240}
            ariaLabel="Kategorie wählen"
            className="w-full"
          />
          {hiddenKinds && (
            <p className="pt-2 text-[11px] text-ink-3">
              {state.kinds.size} Kategorien gefiltert.{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => onChange({ kinds: new Set() })}>
                zurücksetzen
              </button>
            </p>
          )}
        </div>

        <div className="rule-h" />

        {/* Ziele finden: Name, Hausnummer, Straße. */}
        <div>
          <SectionHead
            title="Ziel finden"
            aside={
              <span className="text-[11px] text-ink-3">
                {results.length} von {pois.length}
              </span>
            }
          />
          <label className="flex items-center gap-2.5 border border-line-2 bg-base-800 px-3 py-2.5 transition-colors focus-within:border-signal">
            <Icon path={ICONS.search} size={16} className="shrink-0 text-ink-3" />
            <input
              value={state.query}
              onChange={(e) => onChange({ query: e.target.value })}
              placeholder="Haus 27, Mensa, BaseCamp, MPI …"
              className="w-full bg-transparent text-[14px] text-ink placeholder:text-ink-3 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
              aria-label="Ziel suchen"
            />
            {state.query && (
              <button
                type="button"
                onClick={() => onChange({ query: '' })}
                className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                aria-label="Suche leeren"
              >
                <Icon path={ICONS.close} size={14} />
              </button>
            )}
          </label>
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="truncate text-[11px] text-ink-3">
              {state.query ? `Treffer für „${state.query}“` : 'Alle Ziele alphabetisch'}
            </span>
            <RubberSegment
              items={[
                { value: 'name', label: 'A–Z' },
                { value: 'near', label: 'Nächste' },
              ]}
              value={state.sort}
              onChange={(value) => onChange({ sort: value as 'name' | 'near' })}
              disabled={!live && state.sort !== 'near'}
              trackColor="#080e17"
              thumbColor="#1a2634"
              textColor="#6e7f94"
              activeTextColor="#e9eff6"
              size="sm"
              radius={3}
              aria-label="Sortierung"
            />
          </div>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto pb-4">
        {shown.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-ink">Kein Ziel gefunden.</p>
            <p className="pt-1 text-[12px] text-ink-3">
              Andere Schreibweise versuchen oder{' '}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => onChange({ query: '', kinds: new Set() })}
              >
                Filter zurücksetzen
              </button>
              .
            </p>
          </div>
        ) : (
          <AnimatedList
            items={shown.map((poi) => ({
              id: poi.id,
              title: poi.short,
              description: poi.house ? `Haus ${poi.house}` : poi.street,
            }))}
            onItemSelect={(_, index) => shown[index] && onSelect(shown[index])}
            renderItem={(_, index, isSelected) => {
              const poi = shown[index]
              return (
                <Row
                  active={isSelected || selected?.id === poi.id}
                  onClick={() => onSelect(poi)}
                  onHover={() => onHover(poi)}
                  className="py-2"
                >
                  <KindDot kind={poi.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="font-display block truncate text-[16px] leading-tight font-semibold text-ink">
                      {poi.short}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {poi.house && <>Haus {poi.house}</>}
                      {poi.house && poi.street && ', '}
                      {poi.street}
                    </span>
                  </span>
                </Row>
              )
            }}
            accentColor="#f5b301"
            theme="dark"
            width="100%"
            radius={2}
            gap={0}
            maxHeight="none"
            frame={false}
            showGradients={false}
            displayScrollbar={false}
            selectOnHover={false}
            className="!w-full !bg-line"
            style={
              {
                '--al-tile': 'var(--color-surface)',
                '--al-tile-shadow': 'none',
                '--al-tile-edge': 'transparent',
                '--al-tile-highlight': 'transparent',
                '--al-gap': '1px',
              } as React.CSSProperties
            }
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Detail */

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
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <KindDot kind={poi.kind} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[21px] leading-[1.15] font-semibold text-ink">{poi.short}</h2>
            <p className="pt-1 text-[12px] text-ink-3">
              {poi.house && <>Haus {poi.house}</>}
              {poi.house && poi.street && ', '}
              {poi.street}
              {poi.area > 0 && <>, {poi.area.toLocaleString('de-DE')} m²</>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 p-1 text-ink-3 transition-colors hover:text-ink"
            aria-label="Auswahl aufheben"
          >
            <Icon path={ICONS.close} size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3">
          <span className="flex items-center gap-1.5 text-[12px]" style={{ color: meta.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </span>
          {poi.hours && (
            <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
              <Icon path={ICONS.clock} size={13} />
              {poi.hours}
            </span>
          )}
          {poi.note && <span className="text-[12px] text-signal">{poi.note}</span>}
        </div>
      </div>

      <div className="rule-h mx-4" />

      {route ? (
        <div className="px-4 pt-3 pb-4">
          <SectionHead title={live ? 'Route von deinem Standort' : 'Route vom gesetzten Startpunkt'} />
          <div className="grid grid-cols-3 gap-3">
            <Reading value={formatDistance(route.distance)} label="Strecke" size="md" />
            <Reading value={String(Math.max(1, Math.round(route.duration / 60)))} unit="Min" label="Gehzeit" size="md" />
            <Reading value={String(decisionCount(route))} label="Abbiegungen" size="md" />
          </div>
        </div>
      ) : (
        <div className="px-4 pt-3 pb-4">
          <Notice tone="info">
            {live
              ? loadingRoute
                ? 'Route wird berechnet …'
                : 'Route wird beim Auswählen eines Ziels sofort berechnet.'
              : 'Standort freigeben, um die Route zu berechnen. Ohne Freigabe kannst du einen Startpunkt auf der Karte antippen.'}
          </Notice>
        </div>
      )}

      {error && (
        <div className="px-4 pb-3">
          <Notice tone="stop">{error}</Notice>
        </div>
      )}

      <div className="mt-auto space-y-2 px-4 pt-2 pb-4">
        {route ? (
          <>
            <ActionButton onClick={onNavigate} icon={ICONS.walk}>
              Navigation starten
            </ActionButton>
            <PlainButton onClick={onStop}>Route verwerfen</PlainButton>
          </>
        ) : (
          <>
            <ActionButton onClick={onLocate} disabled={locating || loadingRoute} icon={ICONS.locate}>
              {live ? 'Route berechnen' : 'Standort freigeben'}
            </ActionButton>
            <PlainButton onClick={onClear}>Anderes Ziel wählen</PlainButton>
          </>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Navigation */

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
      <div className="px-4 pt-4 pb-3">
        <SectionHead
          title={offRoute ? 'Abseits der Route' : 'Live-Navigation'}
          aside={
            <span className="flex items-center gap-1.5">
              <StatusMark
                status={offRoute ? 'failed' : 'running'}
                size={13}
                color={offRoute ? '#e05c6e' : '#2fbf71'}
                doneColor="#2fbf71"
                errorColor="#e05c6e"
              />
              <span className="text-[12px] text-ink-2">{offRoute ? 'wird neu berechnet' : 'Standort aktiv'}</span>
            </span>
          }
        />
      </div>

      {/* Die nächste Abbiegung entscheidet die Farbgebung der ganzen Fläche. */}
      <div
        className={`mx-4 flex items-center gap-3 border-l-2 py-3 pl-3 ${
          now ? 'border-go bg-go/8' : 'border-signal bg-signal/6'
        }`}
      >
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center border ${
            now ? 'border-go/50 text-go' : 'border-signal/45 text-signal'
          }`}
        >
          <TurnGlyph turn={step.turn} size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <Reading
            value={step.turn === 'arrive' ? 'Ziel' : now ? 'Jetzt' : formatDistance(toTurn)}
            label={step.turn === 'arrive' ? undefined : 'Nächster Schritt'}
            size="md"
            tone={now ? 'go' : 'signal'}
          />
          <span className={`block pt-1 text-[13px] ${now ? 'text-go' : 'text-ink'}`}>{text}</span>
        </span>
      </div>

      <div className="px-4 pt-4 pb-3">
        <div className="flex items-end justify-between gap-3">
          <Reading value={formatDistance(remaining)} label="Bis zum Ziel" size="sm" />
          <Reading value={String(Math.max(0, Math.round(remaining / WALK_SPEED / 60)))} unit="Min" label="Gehzeit" size="sm" />
          <Reading value={route.to.short} label="Ziel" size="sm" />
        </div>
        <div className="pt-3">
          <ProgressLine value={progress} />
          <p className="pt-1.5 text-[11px] text-ink-3">
            {Math.round(progress * 100)} % geschafft, {decisionCount(route)} Abbiegungen insgesamt
          </p>
        </div>
      </div>

      {offRoute && (
        <div className="px-4 pb-3">
          <Notice tone="warn" actionLabel="Jetzt" onAction={onRecenter}>
            Du bist neben der Route. Sie wird neu berechnet, sobald du weiter als {OFF_ROUTE_M} m abweichst.
          </Notice>
        </div>
      )}

      {stepsLeft.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <SectionHead title="Danach" />
          <ol>
            {stepsLeft.slice(0, 8).map((s, i) => (
              <li key={`${s.index}-${i}`} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
                <span className="grid h-7 w-7 shrink-0 place-items-center border border-line-2 text-ink-2">
                  <TurnGlyph turn={s.turn} size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{s.text}</span>
                <span className="tnum shrink-0 text-[11px] text-ink-3">
                  {formatDistance(Math.max(0, s.atDistance - travelled))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line px-4 py-3">
        <Compass heading={heading} />
        <PlainButton onClick={onRecenter} active={following}>
          {following ? 'Karte folgt dir' : 'Zentrieren'}
        </PlainButton>
      </div>

      {/* Beenden ist hier die folgenreichste Handlung; sie braucht Absicht,
          keinen Fehlgriff. */}
      <div className="px-4 pb-4">
        <HoldButton
          size="md"
          radius={3}
          backgroundColor="#080e17"
          fillColor="#e05c6e"
          textColor="#e05c6e"
          fillTextColor="#12060a"
          holdTime={800}
          onHold={onStop}
          className="w-full"
          icon={<Icon path={ICONS.close} size={15} />}
          doneIcon={<StatusMark status="done" size={15} color="#12060a" doneColor="#12060a" />}
        >
          Navigation beenden
        </HoldButton>
      </div>
    </div>
  )
}

function Compass({ heading }: { heading: number | null }) {
  return (
    <span className="flex items-center gap-2.5 border border-line-2 px-2.5 py-2">
      <span className="text-ink-3 transition-transform duration-300" style={{ transform: `rotate(${heading ?? 0}deg)` }}>
        <Icon path={ICONS.compass} size={17} />
      </span>
      <Reading
        value={heading === null ? '—' : String(Math.round(heading))}
        unit={heading === null ? undefined : '°'}
        label="Blickrichtung"
        size="sm"
      />
    </span>
  )
}

/* ------------------------------------------------------------------ Knöpfe */

function ActionButton({
  children,
  onClick,
  icon,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  icon: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 bg-action px-4 py-3 text-[14px] font-semibold text-white transition-colors enabled:hover:bg-action-2 disabled:opacity-50"
    >
      <Icon path={icon} size={17} />
      {children}
    </button>
  )
}

function PlainButton({
  children,
  onClick,
  active,
  tone,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  tone?: 'stop'
}) {
  const color = tone === 'stop' ? 'text-stop border-stop/40 hover:bg-stop/10' : active ? 'text-signal border-signal/50' : 'text-ink-2 border-line-2 hover:text-ink'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 border px-4 py-2.5 text-[13px] transition-colors ${color}`}
    >
      {children}
    </button>
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

function TurnGlyph({ turn, size = 20 }: { turn: keyof typeof TURN_PATHS | string; size?: number }) {
  return <Icon path={TURN_PATHS[turn] ?? TURN_PATHS.straight} size={size} strokeWidth={2} />
}

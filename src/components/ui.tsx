/* eslint-disable react-refresh/only-export-components -- Icons, Farbwerte und
   Bausteine gehoeren zusammen; die Trennung waere hier reine Zeremonie. */
import type { CSSProperties, ReactNode } from 'react'
import { KINDS } from '@/lib/kinds'
import type { PoiKind } from '@/types'

/* ------------------------------------------------------------------ Icons */

export function Icon({
  path,
  size = 18,
  className,
  strokeWidth = 1.7,
}: {
  path: string
  size?: number
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path.split(' M').map((segment, i) => (
        <path key={i} d={i === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  )
}

export const ICONS = {
  search: 'M11 3.6a7.4 7.4 0 1 0 0 14.8 7.4 7.4 0 0 0 0-14.8Z M16.4 16.4 21 21',
  route: 'M6.4 20.4v-2.2a4 4 0 0 1 4-4h3.2a4 4 0 0 0 4-4V3.6 M13.4 6.6l3.6-3 3.6 3',
  close: 'M6 6l12 12 M18 6L6 18',
  locate: 'M12 3.4v3 M12 17.6v3 M3.4 12h3 M17.6 12h3 M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z',
  compass: 'M12 21.2a9.2 9.2 0 1 0 0-18.4 9.2 9.2 0 0 0 0 18.4Z M15.6 8.4l-2 5.2-5.2 2 2-5.2 5.2-2Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6V12l3.2 2',
  walk: 'M13.4 4.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z M13.8 8.6 10.6 11l-1.4 4.4 3.6 5.6 M13.8 8.6l3 3 2.6 1 M13.8 8.6l-4.2.6-2.8 3',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z M12 12h.01',
  chevron: 'M9.5 5.5 16 12l-6.5 6.5',
  layers: 'M12 3.4 3.2 8 12 12.6 20.8 8 12 3.4Z M3.2 12.6 12 17.2l8.8-4.6 M3.2 16.8 12 21.4l8.8-4.6',
  pinAdd: 'M12 21.2s6.6-5.9 6.6-10.6a6.6 6.6 0 0 0-12.4-3 M12 10.4h.01 M5 4.6v6 M2 7.6h6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5.4 M12 7.8h.01',
  refresh: 'M20.4 12a8.4 8.4 0 1 1-2.6-6.1 M20.4 4.6v5h-5',
} as const

/* ------------------------------------------------------------------ Kategorien */

function KindIcon({ kind, size = 16, className }: { kind: PoiKind; size?: number; className?: string }) {
  return <Icon path={KINDS[kind].icon} size={size} className={className} strokeWidth={1.7} />
}

const tint = (color: string, amount: number) => `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, transparent)`

/** Kategoriefarbe als Bildmarke einer Zeile: Kante und Zeichen, nicht die Fläche. */
export function KindDot({ kind, size = 30 }: { kind: PoiKind; size?: number }) {
  const meta = KINDS[kind]
  return (
    <span
      className="grid shrink-0 place-items-center border"
      style={{
        width: size,
        height: size,
        borderColor: tint(meta.color, 0.45),
        background: tint(meta.color, 0.1),
        color: meta.color,
      }}
    >
      <KindIcon kind={kind} size={Math.round(size * 0.5)} />
    </span>
  )
}

/* ----------------------------------------------------------------- Bausteine */

export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-2">
      <span className="label-field">{title}</span>
      {aside}
    </div>
  )
}

/** Zahl mit Einheit — trägt jede Strecken- und Zeitangabe der App. */
export function Reading({
  value,
  unit,
  label,
  size = 'md',
  tone = 'ink',
}: {
  value: string
  unit?: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'ink' | 'signal' | 'action' | 'go' | 'stop'
}) {
  const scale = { sm: 'text-[17px]', md: 'text-[24px]', lg: 'text-[34px]' }[size]
  const color = {
    ink: 'text-ink',
    signal: 'text-signal',
    action: 'text-action-2',
    go: 'text-go',
    stop: 'text-stop',
  }[tone]
  return (
    <span className="block min-w-0">
      {label && <span className="label-field block pb-1">{label}</span>}
      <span className={`font-display ${scale} leading-none font-semibold ${color}`}>
        <span className="tnum">{value}</span>
        {unit && <span className="ml-0.5 text-[0.62em] font-medium text-ink-3">{unit}</span>}
      </span>
    </span>
  )
}

/** Fortschritt als Linie mit gesetztem Segment. */
export function ProgressLine({ value, tone = 'signal' }: { value: number; tone?: 'signal' | 'action' }) {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div className="h-[3px] w-full bg-white/10">
      <div
        className={`h-full transition-[width] duration-500 ease-out ${tone === 'signal' ? 'bg-signal' : 'bg-action-2'}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

/** Hinweis: sagt, was los ist und was zu tun ist. */
export function Notice({
  children,
  tone = 'warn',
  onAction,
  actionLabel,
}: {
  children: ReactNode
  tone?: 'warn' | 'stop' | 'info'
  onAction?: () => void
  actionLabel?: string
}) {
  const styles = {
    warn: 'border-signal/35 bg-signal/8 text-signal-2',
    stop: 'border-stop/40 bg-stop/10 text-stop',
    info: 'border-line-2 bg-white/4 text-ink-2',
  }[tone]
  return (
    <div className={`flex items-start gap-2.5 border px-3 py-2.5 text-[12px] leading-relaxed ${styles}`}>
      <Icon path={ICONS.info} size={14} className="mt-px shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {onAction && (
        <button type="button" onClick={onAction} className="shrink-0 font-medium underline underline-offset-2">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

/** Zeilenfläche ohne Schlagschatten: aktive Zeile trägt eine Signalkante links. */
export function Row({
  children,
  active,
  onClick,
  onHover,
  className = '',
  style,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  onHover?: (over: boolean) => void
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onFocus={onHover ? () => onHover(true) : undefined}
      onBlur={onHover ? () => onHover(false) : undefined}
      style={style}
      className={`group flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${
        active ? 'border-signal bg-white/6' : 'border-transparent enabled:hover:border-line-3 enabled:hover:bg-white/4'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export { tint }

import { KINDS } from '@/lib/kinds'
import type { PoiKind } from '@/types'

export function KindIcon({ kind, size = 16, className }: { kind: PoiKind; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {KINDS[kind].icon.split(' M').map((segment, i) => (
        <path key={i} d={i === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  )
}

export function KindChip({ kind }: { kind: PoiKind }) {
  const meta = KINDS[kind]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide"
      style={{
        color: meta.color,
        borderColor: `${meta.color}55`,
        background: `${meta.color}14`,
      }}
    >
      <KindIcon kind={kind} size={12} />
      {meta.label}
    </span>
  )
}

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
  pin: 'M12 21.2s6.6-5.9 6.6-10.6a6.6 6.6 0 1 0-13.2 0C5.4 15.3 12 21.2 12 21.2Z M12 10.4h.01',
  route: 'M6.4 20.4v-2.2a4 4 0 0 1 4-4h3.2a4 4 0 0 0 4-4V3.6 M13.4 6.6l3.6-3 3.6 3',
  close: 'M6 6l12 12 M18 6L6 18',
  locate: 'M12 3.4v3 M12 17.6v3 M3.4 12h3 M17.6 12h3 M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z',
  compass: 'M12 21.2a9.2 9.2 0 1 0 0-18.4 9.2 9.2 0 0 0 0 18.4Z M15.6 8.4l-2 5.2-5.2 2 2-5.2 5.2-2Z',
  building: 'M4.6 20.4V5.6a2 2 0 0 1 2-2h6.8a2 2 0 0 1 2 2v14.8 M15.4 10.4h4v10 M8.2 8.4h3.2 M8.2 12.2h3.2 M8.2 16h3.2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6V12l3.2 2',
  walk: 'M13.4 4.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z M13.8 8.6 10.6 11l-1.4 4.4 3.6 5.6 M13.8 8.6l3 3 2.6 1 M13.8 8.6l-4.2.6-2.8 3',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z M12 12h.01',
  share: 'M12 15.4V3.6 M8 7.4 12 3.4l4 4 M5 13.4v5.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-5.2',
  check: 'M5 12.8 9.6 17.4 19 6.6',
  spark: 'M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5.4 M12 7.8h.01',
} as const


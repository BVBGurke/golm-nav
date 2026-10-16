import type { PoiKind } from '@/types'

export interface KindMeta {
  label: string
  short: string
  color: string
  /** icon path data on a 24×24 grid, stroke-based */
  icon: string
}

export const KINDS: Record<PoiKind, KindMeta> = {
  uni: {
    label: 'Universität',
    short: 'Uni',
    color: '#2b86d9',
    icon: 'M12 3.2 2.4 7.8 12 12.4l9.6-4.6L12 3.2Z M5.4 10.2v6.1 M9 12v5.6 M15 12v5.6 M18.6 10.2v6.1 M3 19.4h18',
  },
  forschen: {
    label: 'Forschung',
    short: 'Forschung',
    color: '#8b6fe0',
    icon: 'M9.5 2.8h5 M10.6 2.8v6.4L5.4 18.6a2.1 2.1 0 0 0 1.8 3.2h9.6a2.1 2.1 0 0 0 1.8-3.2l-5.2-9.4V2.8 M7.6 15.6h8.8',
  },
  wohnen: {
    label: 'Wohnen',
    short: 'Wohnen',
    color: '#2fa37c',
    icon: 'M3 10.4 12 3.4l9 7 M5.6 12.2v8.4h12.8v-8.4 M9.6 20.6v-5.2h4.8v5.2',
  },
  essen: {
    label: 'Essen & Trinken',
    short: 'Essen',
    color: '#f2b230',
    icon: 'M6.4 2.8v7.4a2.6 2.6 0 0 0 5.2 0V2.8 M9 10.2v11 M17 2.8c1.7 2.1 2.3 4.2 2.3 6.3v12.1 M17 2.8v8.9h-2.4',
  },
  lernen: {
    label: 'Lernen & Bibliothek',
    short: 'Lernen',
    color: '#4fc3d9',
    icon: 'M4.2 4.6A2 2 0 0 1 6.2 2.6h12.6v18H6.2a2 2 0 0 1-2-2Z M8.6 2.6v18 M11.6 7.4h4.6 M11.6 11h4.6',
  },
  sport: {
    label: 'Sport',
    short: 'Sport',
    color: '#e2643f',
    icon: 'M3.4 9.4v5.2 M6.6 6.8v10.4 M17.4 6.8v10.4 M20.6 9.4v5.2 M6.6 12h10.8',
  },
  service: {
    label: 'Service',
    short: 'Service',
    color: '#9aa7b8',
    icon: 'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z M12 8.2h.01 M11.2 11.6h1v5.4h1',
  },
  verkehr: {
    label: 'Verkehr',
    short: 'Verkehr',
    color: '#e0e6ef',
    icon: 'M6.4 3.4h11.2v9.8a2.6 2.6 0 0 1-2.6 2.6H9a2.6 2.6 0 0 1-2.6-2.6Z M8.2 19.6l1.8-3.8 M15.8 19.6l-1.8-3.8 M6.4 8.4h11.2 M9.4 12.8h.01 M14.6 12.8h.01',
  },
  sonstiges: {
    label: 'Sonstiges',
    short: 'Sonstiges',
    color: '#7f8ea3',
    icon: 'M12 21.2s6.8-6.1 6.8-10.8a6.8 6.8 0 1 0-13.6 0C5.2 15.1 12 21.2 12 21.2Z M12 10.2h.01',
  },
}

export const KIND_ORDER: PoiKind[] = [
  'uni',
  'forschen',
  'essen',
  'lernen',
  'wohnen',
  'sport',
  'service',
  'verkehr',
  'sonstiges',
]

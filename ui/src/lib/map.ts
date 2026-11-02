import raw from '@/assets/ua-map.json'
import type { AlertLevel, RegionState } from './api'

export interface MapRegion { d: string; cx: number; cy: number }
export interface UaMap { width: number; height: number; regions: Record<string, MapRegion> }

export const UA_MAP = raw as UaMap
export const MAP_W = UA_MAP.width
export const MAP_H = UA_MAP.height
export const MAP_REGION_NAMES = Object.keys(UA_MAP.regions)

export interface PaintRegion {
  name: string
  d: string
  level: AlertLevel | null
  partial: boolean
}

export function paintOrder(regions: Record<string, RegionState>): PaintRegion[] {
  const all = MAP_REGION_NAMES.map((name) => {
    const st = regions[name]
    return { name, d: UA_MAP.regions[name].d, level: st?.level ?? null, partial: !!st && !st.full }
  })
  const city = (n: string) => n.startsWith('м. ')
  const rank = (r: PaintRegion) => (city(r.name) ? 2 : 0) + (r.level ? 1 : 0)
  return all.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map(({ r }) => r)
}

export function centroid(name: string): { cx: number; cy: number } | null {
  const r = UA_MAP.regions[name]
  return r ? { cx: r.cx, cy: r.cy } : null
}

import { memo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { AlertLevel, RegionState } from '@/lib/api'
import { MAP_H, MAP_W, UA_MAP, centroid, paintOrder } from '@/lib/map'
import { mapAriaLabel, shortRegion } from '@/lib/alerts-copy'

const FILL = { red: 'var(--map-red)', yellow: 'var(--map-yellow)' } as const
const EDGE = { red: 'var(--map-red-edge)', yellow: 'var(--map-yellow-edge)' } as const
const PULSE = { red: 'border-[var(--map-red)]', yellow: 'border-alert-yellow-foreground' } as const

const PLATE_W = 358

export const UaMap = memo(function UaMap({
  regions,
  focusName,
  pulseKey,
  onHover,
}: {
  regions: Record<string, RegionState>
  focusName: string
  pulseKey: number
  onHover: (name: string | null) => void
}) {
  const painted = paintOrder(regions)
  const focus = UA_MAP.regions[focusName]
  const c = centroid(focusName)
  const st = regions[focusName]
  return (
    <div data-focus-inset className="map-plate relative mx-3 rounded-xl border bg-card p-2 shadow-e1">
      <svg
        role="img"
        aria-label={mapAriaLabel(regions, focusName)}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="block h-auto w-full"
        onPointerLeave={() => onHover(null)}
      >
        <defs>
          <Hatch id="hatch-red" fill={FILL.red} />
          <Hatch id="hatch-yellow" fill={FILL.yellow} />
          <pattern id="fc-dots" patternUnits="userSpaceOnUse" width="12" height="12">
            <rect width="12" height="12" fill="Canvas" />
            <circle cx="6" cy="6" r="3" fill="CanvasText" />
          </pattern>
          <pattern id="fc-hatch" patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(45)">
            <rect width="16" height="16" fill="Canvas" />
            <rect width="7" height="16" fill="CanvasText" />
          </pattern>
        </defs>
        {painted.map((r) => (
          <path
            key={r.name}
            d={r.d}
            className="map-region"
            data-level={r.level ?? undefined}
            data-partial={r.partial ? 'true' : undefined}
            fill={!r.level ? 'var(--map-idle)' : r.partial ? `url(#hatch-${r.level})` : FILL[r.level]}
            stroke={r.level ? EDGE[r.level] : 'var(--map-stroke)'}
            strokeWidth={1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            aria-hidden
            onPointerEnter={() => onHover(r.name)}
          />
        ))}
        {focus ? (
          <path
            d={focus.d}
            fill="none"
            stroke="var(--map-focus)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            aria-hidden
          />
        ) : null}
      </svg>
      {c ? <Locator cx={c.cx} cy={c.cy} name={focusName} level={st?.level ?? null} pulseKey={pulseKey} /> : null}
    </div>
  )
})

function Hatch({ id, fill }: { id: string; fill: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(45)">
      <rect width="16" height="16" fill="var(--map-idle)" />
      <rect width="7" height="16" fill={fill} />
    </pattern>
  )
}

function Locator({ cx, cy, name, level, pulseKey }: { cx: number; cy: number; name: string; level: AlertLevel | null; pulseKey: number }) {
  const flip = 8 + (cx / MAP_W) * PLATE_W > 300
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `calc(8px + ${cx / MAP_W} * (100% - 16px))`, top: `calc(8px + ${cy / MAP_H} * (100% - 16px))` }}
    >
      <div className="relative size-2.5">
        {level ? <AlertRing key={`${pulseKey}-${level}`} level={level} /> : null}
        <span className="absolute inset-0 rounded-full bg-[var(--map-focus)] shadow-[0_0_0_2px_var(--map-focus-ring)]" />
        <span
          className={`absolute top-1/2 -translate-y-1/2 text-micro font-medium whitespace-nowrap text-foreground ${flip ? 'right-[calc(100%+10px)]' : 'left-[calc(100%+10px)]'}`}
          style={{ textShadow: '0 0 2px var(--card), 0 0 2px var(--card), 0 0 3px var(--card)' }}
        >
          {shortRegion(name)}
        </span>
      </div>
    </div>
  )
}

function AlertRing({ level }: { level: AlertLevel }) {
  const reduced = useReducedMotion()
  const [ended, setDone] = useState(false)
  return ended || reduced ? (
    <span className="absolute top-1/2 left-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[var(--map-focus)]" />
  ) : (
    <span
      className={`map-pulse absolute inset-0 rounded-full border-2 ${PULSE[level]}`}
      onAnimationEnd={() => setDone(true)}
    />
  )
}

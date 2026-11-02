import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { RotateCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HatchSwatch } from '@/components/app/HatchSwatch'
import { LevelIcon } from '@/components/app/LevelIcon'
import { Spin } from '@/components/app/Spin'
import type { Alerts, AlertLevel } from '@/lib/api'
import {
  CLEAR_LINE_MIN,
  alertMeta,
  alertTitle,
  clearAge,
  clearBandMeta,
  clearLine,
  clearTitle,
  errorCopy,
  isStale,
  otherTypesText,
  placesSummary,
  quietTitle,
  staleBandLine,
  staleQuietLine,
  statusKind,
  threatsText,
  updatedText,
  type StatusKind,
} from '@/lib/alerts-copy'
import { appear, iconSwap, tween } from '@/lib/motion'
import { cn } from '@/lib/utils'

const BAND = {
  red: 'bg-alert-red-soft border-alert-red-border',
  yellow: 'bg-alert-yellow-soft border-alert-yellow-border',
  clear: 'bg-alert-clear-soft border-alert-clear-border',
} as const
const LEVEL_TEXT = { red: 'text-alert-red-foreground', yellow: 'text-alert-yellow-foreground' } as const
const STALE_BORDER = { red: 'border-alert-red-border', yellow: 'border-alert-yellow-border' } as const

export interface RetryState {
  retrying: boolean
  retry: () => void
}

export function AlertStatus({ alerts, now, retry }: { alerts: Alerts | null; now: Date; retry: RetryState }) {
  const kind: StatusKind = alerts ? statusKind(alerts, now) : 'loading'
  const band = kind === 'alert' || kind === 'alert-stale' || kind === 'clear-band'

  const [prevKind, setPrevKind] = useState(kind)
  const [drawClear, setDrawClear] = useState(false)
  if (kind !== prevKind) {
    setPrevKind(kind)
    setDrawClear(
      kind === 'clear-band' && (prevKind === 'alert' || prevKind === 'alert-stale') && document.visibilityState === 'visible',
    )
  }

  return (
    <div role="status" aria-live="polite" className="relative shrink-0">
      <AnimatePresence mode="popLayout" initial={false}>
        {band && alerts ? (
          <motion.div key="band" {...appear}>
            <Band alerts={alerts} now={now} kind={kind as 'alert' | 'alert-stale' | 'clear-band'} drawClear={drawClear} retry={retry} />
          </motion.div>
        ) : (
          <motion.div key="row" {...appear} className="border-y">
            {!alerts || kind === 'loading' ? (
              <LoadingRow />
            ) : kind === 'error' ? (
              <ErrorRow alerts={alerts} retry={retry} />
            ) : (
              <QuietRow alerts={alerts} now={now} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusRow({
  icon,
  title,
  detail,
  right,
  action,
}: {
  icon: ReactNode
  title: string
  detail?: string | null
  right?: ReactNode
  action?: ReactNode
}) {
  const titleRef = useRef<HTMLSpanElement>(null)
  const [drop, setDrop] = useState(false)
  useLayoutEffect(() => setDrop(false), [title, !!action])
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!drop && action && el && el.scrollWidth > el.clientWidth + 1) setDrop(true)
  })
  return (
    <div className="grid min-h-11 grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-x-2.5 px-3 py-3">
      <span className="flex h-[18px] items-center">{icon}</span>
      <span
        ref={titleRef}
        className={cn('col-start-2 row-start-1 text-body font-medium', action && !drop && 'overflow-hidden whitespace-nowrap')}
      >
        {title}
      </span>
      {detail ? <span className="col-start-2 row-start-2 text-caption text-muted-foreground tabular-nums">{detail}</span> : null}
      {right ? (
        <span className="col-start-3 row-start-1 flex h-[18px] items-center text-caption whitespace-nowrap text-muted-foreground tabular-nums">
          {right}
        </span>
      ) : null}
      {action ? (
        <div
          className={cn(
            'flex',
            drop ? 'col-span-2 col-start-2 row-start-3 justify-end pt-2' : 'col-start-3 row-span-2 row-start-1 self-center pl-1',
          )}
        >
          {action}
        </div>
      ) : null}
    </div>
  )
}

function LoadingRow() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="grid min-h-11 grid-cols-[16px_minmax(0,1fr)] items-center gap-x-2.5 px-3 py-3">
      {show ? (
        <motion.div className="contents" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: tween.fade }}>
          <Spin className="size-4" />
          <span className="text-body font-medium">Завантаження даних про тривоги…</span>
        </motion.div>
      ) : null}
    </div>
  )
}

function QuietRow({ alerts, now }: { alerts: Alerts; now: Date }) {
  const stale = isStale(alerts, now)
  const age = clearAge(alerts.lastClear, now)
  const detail = stale && alerts.updatedAt
    ? staleQuietLine(alerts.updatedAt)
    : alerts.lastClear && age !== null && age < CLEAR_LINE_MIN
      ? clearLine(alerts.lastClear)
      : null
  return (
    <StatusRow
      icon={<LevelIcon level="clear" size={16} />}
      title={quietTitle(alerts.focus.name)}
      detail={detail}
      right={!stale && alerts.updatedAt ? updatedText(alerts.updatedAt) : null}
    />
  )
}

function ErrorRow({ alerts, retry }: { alerts: Alerts; retry: RetryState }) {
  const copy = errorCopy(alerts)
  const Icon = copy.icon
  const a = copy.action
  return (
    <StatusRow
      icon={<Icon aria-hidden className="size-4 text-muted-foreground" />}
      title={copy.title}
      detail={copy.detail}
      action={
        a ? (
          'retry' in a ? (
            <RetryButton retry={retry} variant="outline" />
          ) : (
            <Button type="button" variant="outline" size="xs" onClick={() => window.api.openEditor(a.target)}>
              {a.label}
            </Button>
          )
        ) : null
      }
    />
  )
}

function RetryButton({ retry, variant }: { retry: RetryState; variant: 'outline' | 'link' }) {
  return (
    <Button
      type="button"
      variant={variant}
      size="xs"
      disabled={retry.retrying}
      aria-keyshortcuts="R"
      onClick={retry.retry}
      className={cn(variant === 'link' && 'h-auto px-0 py-0 font-medium')}
    >
      {variant === 'outline' ? (
        retry.retrying ? <Spin className="size-3.5" /> : <RotateCw aria-hidden className="size-3.5" />
      ) : retry.retrying ? (
        <Spin className="size-3" />
      ) : null}
      Повторити
    </Button>
  )
}

function Band({
  alerts,
  now,
  kind,
  drawClear,
  retry,
}: {
  alerts: Alerts
  now: Date
  kind: 'alert' | 'alert-stale' | 'clear-band'
  drawClear: boolean
  retry: RetryState
}) {
  const focus = alerts.focus
  const clear = kind === 'clear-band'
  const level: AlertLevel = focus.level ?? alerts.lastClear?.level ?? 'red'
  const tone = clear ? 'clear' : level
  const reduced = useReducedMotion()
  return (
    <section
      aria-label={clear ? 'Відбій тривоги' : 'Тривога'}
      className={cn('alert-band border-y px-3 py-3', !reduced && 'transition-colors duration-300 ease-out', BAND[tone])}
    >
      <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2 gap-y-1">
        <span className="flex h-[22px] items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={tone} className="inline-flex" {...iconSwap}>
              {clear ? <ClearIcon draw={drawClear} /> : <LevelIcon level={level} size={20} />}
            </motion.span>
          </AnimatePresence>
        </span>
        {clear ? <ClearRows alerts={alerts} /> : <AlertRows alerts={alerts} now={now} level={level} />}
      </div>

      <AnimatePresence initial={false}>
        {kind === 'alert-stale' && alerts.updatedAt ? (
          <motion.div
            key="stale"
            {...appear}
            className={cn('mt-3 flex items-center gap-2 border-t border-dashed pt-2 text-caption text-muted-foreground', STALE_BORDER[level])}
          >
            <WifiOff aria-hidden className="size-3.5 shrink-0" />
            <span className="min-w-0 tabular-nums">{staleBandLine(alerts.updatedAt)}</span>
            <RetryButton retry={retry} variant="link" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function AlertRows({ alerts, now, level }: { alerts: Alerts; now: Date; level: AlertLevel }) {
  const focus = alerts.focus
  const meta = alertMeta(focus, now)
  const threats = threatsText(focus.threats)
  const others = otherTypesText(focus)
  const places = focus.full === false && (focus.places?.length ?? 0) > 0 ? placesSummary(focus.places) : null
  return (
    <>
      <h2 className="line-clamp-2 text-title text-balance text-foreground select-text">{alertTitle(focus)}</h2>

      <p className="col-start-2 text-body text-muted-foreground tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={level}
            className={cn('inline-block font-medium', LEVEL_TEXT[level])}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: tween.fade }}
            exit={{ opacity: 0, transition: tween.fadeOut }}
          >
            {meta.level}
          </motion.span>
        </AnimatePresence>
        {meta.since ? <> · {meta.since}</> : null}
        {meta.lasting ? <> · {meta.lasting}</> : null}
      </p>

      {threats ? (
        <p className="col-start-2 line-clamp-2 text-body select-text">
          <span className="text-muted-foreground">Загрози: </span>
          {threats}
        </p>
      ) : null}

      {others ? (
        <p className="col-start-2 line-clamp-1 text-body select-text">
          <span className="text-muted-foreground">Також: </span>
          {others}
        </p>
      ) : null}

      {places ? (
        <p className="col-start-2 flex min-w-0 items-center gap-1.5 text-body select-text" title={places.full}>
          <HatchSwatch level={level} size={10} />
          <span className="min-w-0 truncate" aria-hidden>
            <span className="text-muted-foreground">Частково: </span>
            {places.text}
          </span>
          <span className="sr-only">Частково: {places.full}</span>
        </p>
      ) : null}
    </>
  )
}

function ClearRows({ alerts }: { alerts: Alerts }) {
  const c = alerts.lastClear
  return (
    <>
      <h2 className="text-title text-balance text-foreground select-text">{clearTitle(alerts.focus.name)}</h2>
      {c ? <p className="col-start-2 text-body text-muted-foreground tabular-nums">{clearBandMeta(c)}</p> : null}
    </>
  )
}

const SHIELD =
  'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'

function ClearIcon({ draw }: { draw: boolean }) {
  return (
    <svg
      aria-hidden
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-alert-clear"
    >
      <path d={SHIELD} />
      <motion.path d="m9 12 2 2 4-4" initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1, transition: tween.draw }} />
    </svg>
  )
}

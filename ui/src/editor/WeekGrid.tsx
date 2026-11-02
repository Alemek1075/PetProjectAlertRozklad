import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { CircleX, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { isoDow, mondayOf } from '@shared/schedule.mjs'
import { Tip } from '@/components/app/Tip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { Lesson } from '@/lib/api'
import { DAY_NAMES, DAY_SHORT, fmtClock, pairsCount } from '@/lib/format'
import { spring } from '@/lib/motion'
import { subjectIndex } from '@/lib/subjects'
import { addMin, nowMin, toMin } from '@/lib/time'
import { useMinute } from '@/lib/useMinute'
import { cn } from '@/lib/utils'
import { fieldSelector, useEditor } from './context'
import { DAYS, addInDayLabel, hasStart, isInvalidRange, lanes, lengthOf, matchesFilter, sortLessons, unsavedText } from './lessons'
import { LessonBlock, type BlockBox } from './LessonBlock'

const GUTTER = 56
const HEADER = 44
const PAD_Y = 10
const WEEKEND_EMPTY = 64

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function WeekGrid() {
  const { lessons, filter, settings, select, actions, fresh, conflicts, alternation, thisWeek, setView, setActiveDay } = useEditor()
  const now = useMinute()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [instant, setInstant] = useState(true)
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const scrolled = useRef(false)
  const dd = settings.defaultDuration

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let t: number | undefined
    const ro = new ResizeObserver(() => {
      setInstant(true)
      setSize({ w: el.clientWidth, h: el.clientHeight })
      window.clearTimeout(t)
      t = window.setTimeout(() => setInstant(false), 200)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
  }, [])

  const visible = useMemo(() => lessons.filter((l) => matchesFilter(l, filter)), [lessons, filter])
  const drawn = useMemo(() => sortLessons(visible.filter(hasStart)), [visible])
  const noStart = lessons.filter((l) => !hasStart(l))
  const byDay = useMemo(() => {
    const m = new Map<number, Lesson[]>()
    for (const d of DAYS) m.set(d, [])
    for (const l of drawn) m.get(l.day)!.push(l)
    return m
  }, [drawn])

  const showsNext = alternation && filter !== 'both' && filter !== thisWeek
  const monday = mondayOf(now)
  if (showsNext) monday.setDate(monday.getDate() + 7)
  const today = showsNext ? 0 : isoDow(now)
  const dateOf = (d: number) => {
    const x = new Date(monday)
    x.setDate(monday.getDate() + d - 1)
    return x.getDate()
  }

  let lo = 8 * 60
  let hi = 18 * 60
  for (const l of drawn) {
    const s = toMin(l.start)
    lo = Math.min(lo, Math.floor(s / 60) * 60)
    hi = Math.max(hi, Math.ceil((s + lengthOf(l, dd)) / 60) * 60)
  }
  lo = Math.max(0, lo)
  hi = Math.min(24 * 60, hi)
  const hours = (hi - lo) / 60
  const alertH = noStart.length ? 52 : 0
  const avail = Math.max(0, size.h - HEADER - PAD_Y * 2 - alertH - 24)
  const hourPx = clamp(size.h ? avail / hours : 64, 48, 96)
  const ppm = hourPx / 60
  const bodyH = hours * hourPx + PAD_Y * 2
  const yOf = (min: number) => PAD_Y + (min - lo) * ppm

  const narrowDays = DAYS.filter((d) => d >= 6 && !byDay.get(d)!.length)
  const flexCount = 7 - narrowDays.length
  const areaW = Math.max(0, size.w - 48 - GUTTER)
  const flexW = flexCount ? (areaW - narrowDays.length * WEEKEND_EMPTY) / flexCount : 0
  const colW = (d: number) => (narrowDays.includes(d as 6 | 7) ? WEEKEND_EMPTY : flexW)
  const colLeft = (d: number) => DAYS.slice(0, d - 1).reduce((a, x) => a + colW(x), 0)
  const template = `${GUTTER}px ${DAYS.map((d) => (narrowDays.includes(d as 6 | 7) ? `${WEEKEND_EMPTY}px` : 'minmax(0,1fr)')).join(' ')}`
  const longNames = flexW >= 140

  useEffect(() => {
    if (scrolled.current || !size.h) return
    scrolled.current = true
    const el = viewportRef.current
    if (!el || el.scrollHeight <= el.clientHeight) return
    const first = drawn.length ? Math.min(...drawn.map((l) => toMin(l.start))) : lo
    const target = Math.min(first, today ? nowMin(now) - 60 : first)
    el.scrollTop = Math.max(0, yOf(target) - 8)
  })

  const boxes = useMemo(() => {
    const out = new Map<string, BlockBox>()
    for (const d of DAYS) {
      const list = byDay.get(d)!
      const lane = lanes(list, dd)
      const w = colW(d) - 4
      for (const l of list) {
        const { lane: i, of } = lane.get(l.id) ?? { lane: 0, of: 1 }
        const laneW = (w - 2 * (of - 1)) / of
        const len = Math.max(lengthOf(l, dd), 1)
        out.set(l.id, {
          left: GUTTER + colLeft(d) + 2 + i * (laneW + 2),
          top: yOf(toMin(l.start)) + 1,
          width: Math.max(laneW, 8),
          height: Math.max(24, (isInvalidRange(l) ? 0 : len) * ppm - 2),
        })
      }
    }
    return out
  }, [byDay, dd, flexW, ppm, lo, narrowDays.join(',')])

  const focusLesson = (l: Lesson | undefined) => {
    if (!l) return
    select(l.id)
    setActiveDay(l.day)
    ;(document.querySelector(fieldSelector(l.id, 'block')) as HTMLElement | null)?.focus()
  }
  const onBlockKey = (e: KeyboardEvent<HTMLButtonElement>, l: Lesson) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const list = byDay.get(l.day)!
    const i = list.findIndex((x) => x.id === l.id)
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault()
        focusLesson(list[i + (e.key === 'ArrowUp' ? -1 : 1)])
        return
      case 'ArrowLeft':
      case 'ArrowRight': {
        e.preventDefault()
        const step = e.key === 'ArrowLeft' ? -1 : 1
        for (let d = l.day + step; d >= 1 && d <= 7; d += step) {
          const other = byDay.get(d)!
          if (!other.length) continue
          const s = toMin(l.start)
          focusLesson(other.reduce((a, b) => (Math.abs(toMin(b.start) - s) < Math.abs(toMin(a.start) - s) ? b : a)))
          return
        }
        return
      }
      case 'Enter':
        e.preventDefault()
        select(l.id)
        actions.focusField(l.id, 'subject')
        return
    }
  }

  const onColumnDouble = (e: MouseEvent<HTMLDivElement>, day: number) => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const min = lo + (e.clientY - rect.top - PAD_Y) / ppm
    const snapped = clamp(Math.round(min / 5) * 5, 0, 24 * 60 - 5)
    actions.add(day, addMin('00:00', snapped))
  }

  const nowM = nowMin(now)
  const nowTop = today && nowM >= lo && nowM <= hi ? yOf(nowM) : null
  const hourMarks = Array.from({ length: hours + 1 }, (_, i) => lo + i * 60)

  return (
    <div className="relative min-h-0 flex-1 bg-card">
      <div ref={viewportRef} className="absolute inset-0 overflow-auto px-6 pb-6" data-grid-viewport>
        {noStart.length ? (
          <Alert className="mt-4 mb-2 flex items-center gap-2 py-1.5">
            <CircleX className="size-4 shrink-0 text-destructive" aria-hidden />
            <AlertDescription className="flex flex-1 flex-wrap items-center gap-x-2 text-body text-foreground">
              {unsavedText(noStart.length)}.
              <Button
                variant="link"
                size="xs"
                className="h-auto p-0"
                onClick={() => {
                  setView('list')
                  actions.focusField(noStart[0].id, 'start')
                }}
              >
                Показати в списку
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div
          className="sticky top-0 z-30 grid h-11 border-b bg-card"
          style={{ gridTemplateColumns: template }}
        >
          <div aria-hidden />
          {DAYS.map((d) => {
            const n = byDay.get(d)!.length
            const isToday = d === today
            const narrow = narrowDays.includes(d as 6 | 7)
            return (
              <div
                key={d}
                aria-current={isToday ? 'date' : undefined}
                className="group/head relative flex min-w-0 items-center gap-1 border-l border-border/60 pr-1 pl-2"
                onMouseEnter={() => setHoverDay(d)}
                onMouseLeave={() => setHoverDay(null)}
              >
                <div className="min-w-0 flex-1 leading-none">
                  <div className={cn('truncate', 'text-subject-title', isToday && 'text-primary')}>
                    {longNames && !narrow ? DAY_NAMES[d] : DAY_SHORT[d]}{' '}
                    <span className={cn('tabular-nums', isToday ? 'text-primary' : 'text-muted-foreground')}>{dateOf(d)}</span>
                  </div>
                  <div className={cn('mt-0.5 truncate text-caption', isToday ? 'text-primary' : 'text-muted-foreground')}>
                    {narrow ? ' ' : isToday ? 'сьогодні' : n ? pairsCount(n) : ' '}
                  </div>
                </div>
                <Tip label={addInDayLabel(d)}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={addInDayLabel(d)}
                    className={cn(
                      'shrink-0 bg-card text-muted-foreground opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100',
                      narrow && 'absolute right-1',
                      hoverDay === d && 'opacity-100',
                    )}
                    onClick={() => {
                      setActiveDay(d)
                      actions.add(d)
                    }}
                  >
                    <Plus />
                  </Button>
                </Tip>
              </div>
            )
          })}
        </div>

        <div className="relative" style={{ height: bodyH }} onMouseLeave={() => setHoverDay(null)}>
          {hourMarks.map((m, i) => {
            const y = yOf(m)
            const hidden = nowTop !== null && Math.abs(nowTop - y) < 12
            return (
              <div key={m} aria-hidden>
                <div className="absolute right-0 border-t border-border" style={{ top: y, left: GUTTER }} />
                {i < hours ? (
                  <div className="grid-half-line absolute right-0" style={{ top: y + hourPx / 2, left: GUTTER }} />
                ) : null}
                {!hidden ? (
                  <span
                    className="absolute -translate-y-1/2 pr-2 text-right text-micro text-muted-foreground tabular-nums"
                    style={{ top: y, left: 0, width: GUTTER }}
                  >
                    {m === 24 * 60 ? '24:00' : addMin('00:00', m)}
                  </span>
                ) : null}
              </div>
            )
          })}

          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: template }}>
            <div />
            {DAYS.map((d) => (
              <div
                key={d}
                className="relative border-l border-border/60"
                onMouseEnter={() => setHoverDay(d)}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return
                  select(null)
                  setActiveDay(d)
                }}
                onDoubleClick={(e) => onColumnDouble(e, d)}
              />
            ))}
          </div>

          {nowTop !== null ? (
            <>
              <motion.div
                aria-hidden
                className="pointer-events-none absolute z-20 h-0.5 bg-now"
                initial={false}
                animate={{ top: nowTop - 1, left: GUTTER + colLeft(today), width: colW(today) }}
                transition={instant ? { duration: 0 } : spring.layout}
              >
                <span className="absolute top-1/2 -left-[3px] size-1.5 -translate-y-1/2 rounded-full bg-now" />
              </motion.div>
              <motion.span
                className="pointer-events-none absolute z-20 -translate-y-1/2 rounded-sm bg-now px-1 text-micro text-primary-foreground tabular-nums"
                initial={false}
                animate={{ top: nowTop }}
                transition={instant ? { duration: 0 } : spring.layout}
                style={{ right: `calc(100% - ${GUTTER - 6}px)` }}
              >
                <span className="sr-only">Зараз </span>
                {fmtClock(now)}
              </motion.span>
            </>
          ) : null}

          <AnimatePresence initial={false}>
            {size.w
              ? drawn.map((l) => (
                  <LessonBlock
                    key={l.id}
                    lesson={l}
                    box={boxes.get(l.id)!}
                    subject={subjectIndex(l.subject, settings.subjectColors)}
                    invalid={isInvalidRange(l)}
                    conflict={conflicts.get(l.id)}
                    isNew={fresh.has(l.id)}
                    instant={instant}
                    onKeyDown={onBlockKey}
                  />
                ))
              : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

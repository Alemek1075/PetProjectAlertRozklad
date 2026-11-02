import { useLayoutEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Settings } from '@/lib/api'
import { DAY_ACC_BARE, DAY_LOWER, MONTHS_GEN, NBSP, fmtClock, fmtDayMonthLong, fmtDuration, leftText } from '@/lib/format'
import { spring, tween } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { LessonRow, ROW_GRID } from './LessonRow'
import { dayItems, type DayInfo, type Lesson, type WeekInfo, type WeekOffset } from './schedule'

export interface JumpTarget {
  offset: WeekOffset
  day: DayInfo
}

export function Timeline({
  week,
  selected,
  now,
  showGaps,
  settings,
  remindOf,
  onRemind,
  jump,
  onJump,
}: {
  week: WeekInfo
  selected: number
  now: Date
  showGaps: boolean
  settings: Settings
  remindOf: (l: Lesson) => boolean
  onRemind: (l: Lesson, next: boolean) => void
  jump: JumpTarget | null
  onJump: (t: JumpTarget) => void
}) {
  const refs = useRef(new Map<string, HTMLOListElement>())
  const prev = useRef<{ pos: number; offset: WeekOffset } | null>(null)
  const reduced = useReducedMotion()
  const selIso = week.days[selected - 1]?.iso

  useLayoutEffect(() => {
    const pos = week.offset * 7 + selected
    const before = prev.current
    prev.current = { pos, offset: week.offset }
    if (!before || before.pos === pos || !selIso) return
    const el = refs.current.get(selIso)
    if (!el) return
    const dist = before.offset !== week.offset ? 16 : 12
    const sign = pos > before.pos ? 1 : -1
    const anim = reduced
      ? animate(el, { opacity: [0, 1] }, { duration: 0.1 })
      : animate(el, { x: [sign * dist, 0], opacity: [0, 1] }, { x: spring.enter, opacity: tween.fade })
    return () => anim.stop()
  }, [week.offset, selected, selIso, reduced])

  const nowMin = now.getHours() * 60 + now.getMinutes()
  return (
    <div className="grid px-3 pb-3">
      {week.days.map((d) => {
        const visible = d.iso === selIso
        const items = dayItems(d, now, showGaps)
        return (
          <ol
            key={d.iso}
            ref={(el) => {
              if (el) refs.current.set(d.iso, el)
              else refs.current.delete(d.iso)
            }}
            aria-label={`Пари, ${DAY_LOWER[d.dow]} ${d.date.getDate()}${NBSP}${MONTHS_GEN[d.date.getMonth()]}`}
            aria-hidden={!visible}
            inert={!visible}
            className="col-start-1 row-start-1 flex flex-col"
            style={{ visibility: visible ? 'visible' : 'hidden' }}
          >
            {items.length === 0 ? (
              <EmptyDay jump={jump && visible ? jump : null} onJump={onJump} />
            ) : (
              items.map((it) =>
                it.kind === 'lesson' ? (
                  <LessonRow
                    key={it.lesson.id}
                    lesson={it.lesson}
                    state={it.state}
                    first={it.first}
                    last={it.last}
                    nowMin={nowMin}
                    settings={settings}
                    remind={remindOf(it.lesson)}
                    onRemind={(v) => onRemind(it.lesson, v)}
                  />
                ) : it.kind === 'now' ? (
                  <NowLine key="now" now={now} first={it.first} last={it.last} />
                ) : (
                  <GapRow key={`gap-${it.minutes}-${it.untilNext}`} minutes={it.minutes} untilNext={it.untilNext} />
                ),
              )
            )}
          </ol>
        )
      })}
    </div>
  )
}

function NowLine({ now, first, last }: { now: Date; first: boolean; last: boolean }) {
  const t = fmtClock(now)
  return (
    <li className={cn(ROW_GRID, 'relative h-4 items-center')}>
      <span aria-hidden className="justify-self-start rounded-sm bg-now px-1 text-micro text-primary-foreground tabular-nums">
        {t}
      </span>
      <span aria-hidden className="relative h-full">
        {!first ? <span className="absolute top-0 left-[5px] h-1/2 w-0.5 bg-border" /> : null}
        {!last ? <span className="absolute bottom-0 left-[5px] h-1/2 w-0.5 bg-border" /> : null}
        <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-now" />
      </span>
      <span aria-hidden className="absolute top-1/2 right-0 left-[54px] h-px -translate-y-1/2 bg-now" />
      <span className="sr-only">Зараз {t}</span>
    </li>
  )
}

function GapRow({ minutes, untilNext }: { minutes: number; untilNext: number | null }) {
  return (
    <li className={cn(ROW_GRID, 'h-5 items-center')}>
      <span />
      <span aria-hidden className="ml-[5px] h-full border-l-2 border-dashed border-border" />
      <span className="col-span-3 text-caption text-muted-foreground tabular-nums">
        {untilNext !== null ? `вікно · ${leftText(untilNext)}` : `вікно ${fmtDuration(minutes)}`}
      </span>
    </li>
  )
}

function EmptyDay({ jump, onJump }: { jump: JumpTarget | null; onJump: (t: JumpTarget) => void }) {
  return (
    <li className="flex flex-col items-start gap-1 py-3">
      <p className="text-body text-muted-foreground">Пар немає.</p>
      {jump ? (
        <Button type="button" variant="link" size="xs" className="h-auto px-0 text-body font-medium" onClick={() => onJump(jump)}>
          Показати {DAY_ACC_BARE[jump.day.dow]}, {fmtDayMonthLong(jump.day.date)}
          <ArrowRight aria-hidden className="size-3.5" />
        </Button>
      ) : null}
    </li>
  )
}

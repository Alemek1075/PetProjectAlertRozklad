import { AnimatePresence, motion } from 'motion/react'
import { TruncateTip } from '@/components/app/Tip'
import type { Settings } from '@/lib/api'
import { NBSP, atTime, fmtDuration, fmtRange, minutesUntil, nextWhen } from '@/lib/format'
import { spring } from '@/lib/motion'
import { addMin, toMin } from '@/lib/time'
import { cn } from '@/lib/utils'
import { BellToggle } from './BellToggle'
import { JoinButton } from './JoinButton'
import { DUE_MIN, type Lesson, type Upcoming } from './schedule'

export interface FocusInfo {
  up: Upcoming
  due: boolean
  laterToday: Lesson | null
  todayHasLessons: boolean
}

const at = (date: Date, hhmm: string) => {
  const m = toMin(hhmm)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(m / 60), m % 60)
}

export function focusInfo(up: Upcoming | null, todayLessons: Lesson[], now: Date): FocusInfo | null {
  if (!up) return null
  const nowM = now.getHours() * 60 + now.getMinutes()
  const due = up.current || (up.daysAhead === 0 && minutesUntil(at(up.date, up.lesson.start), now) <= DUE_MIN)
  const laterToday = up.current ? (todayLessons.find((l) => toMin(l.start) > nowM && l.id !== up.lesson.id) ?? null) : null
  return { up, due, laterToday, todayHasLessons: todayLessons.length > 0 }
}

export function FocusLesson({
  info,
  now,
  settings,
  remindOf,
  onRemind,
}: {
  info: FocusInfo
  now: Date
  settings: Settings
  remindOf: (l: Lesson) => boolean
  onRemind: (l: Lesson, next: boolean) => void
}) {
  const { up, due, laterToday } = info
  const l = up.lesson
  const today = up.daysAhead === 0
  const start = at(up.date, l.start)
  const end = at(up.date, l.end)

  let row1: React.ReactNode
  let row3: React.ReactNode
  if (up.current) {
    const total = Math.max(1, toMin(l.end) - toMin(l.start))
    const left = minutesUntil(end, now)
    row1 = (
      <>
        <span className="font-medium text-primary-soft-foreground">Зараз</span>
        <span className="text-muted-foreground">
          {' · '}ще{NBSP}
          <Countdown text={fmtDuration(left)} />
        </span>
      </>
    )
    row3 = (
      <div className="col-span-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pt-0.5 text-caption text-muted-foreground tabular-nums">
        <span>{fmtRange(l.start, l.end)}</span>
        <LessonProgress elapsed={Math.min(total, total - left)} total={total} />
        <span>{laterToday ? `далі ${atTime(laterToday.start)}` : ''}</span>
      </div>
    )
  } else if (today) {
    const until = minutesUntil(start, now)
    const remindAt = addMin(l.start, -settings.remindBefore)
    const showRemind = remindOf(l) && settings.remindBefore > 0 && minutesUntil(start, now) > settings.remindBefore
    row1 = (
      <>
        <span className="font-medium">Далі {atTime(l.start)}</span>
        <span className="text-muted-foreground">
          {' · '}через{NBSP}
          <Countdown text={fmtDuration(until)} />
        </span>
      </>
    )
    row3 = (
      <p className="col-span-3 text-caption text-muted-foreground tabular-nums">
        {fmtRange(l.start, l.end)}
        {showRemind ? ` · нагадування ${atTime(remindAt)}` : ''}
      </p>
    )
  } else {
    row1 = (
      <span className="font-medium text-muted-foreground">{info.todayHasLessons ? 'На сьогодні все' : 'Сьогодні пар немає'}</span>
    )
    row3 = (
      <p className="col-span-3 text-caption text-muted-foreground tabular-nums">
        Наступна пара {nextWhen(up.daysAhead, up.date, l.start)}
      </p>
    )
  }

  const actionable = today
  return (
    <section
      aria-label="Найближча пара"
      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-0.5 border-b px-3 py-3"
    >
      <p className="col-span-3 text-body tabular-nums">{row1}</p>
      <TruncateTip label={l.subject}>
        <h2 className={cn('line-clamp-2 text-title select-text', actionable ? 'col-start-1' : 'col-span-3')}>
          {l.subject || 'Без назви'}
        </h2>
      </TruncateTip>
      {actionable ? (
        <>
          {l.link ? <JoinButton url={l.link} subject={l.subject} variant={due ? 'default' : 'outline'} size="sm" /> : <span />}
          <BellToggle on={remindOf(l)} subject={l.subject} settings={settings} onToggle={(v) => onRemind(l, v)} />
        </>
      ) : null}
      {row3}
    </section>
  )
}

function LessonProgress({ elapsed, total }: { elapsed: number; total: number }) {
  const share = Math.max(0, Math.min(1, elapsed / total))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={elapsed}
      aria-valuetext={`минуло ${fmtDuration(elapsed)} із ${total}`}
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      <motion.div
        className="h-full w-full origin-left bg-primary"
        initial={false}
        animate={{ scaleX: share }}
        transition={spring.progress}
      />
    </div>
  )
}

export function Countdown({ text, className }: { text: string; className?: string }) {
  const chars = [...text]
  return (
    <span className={cn('inline-flex whitespace-nowrap tabular-nums', className)}>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={`${chars.length}-${i}`} className="relative inline-block h-[1lh] overflow-hidden align-bottom">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                className="inline-block"
                initial={{ y: '0.6em', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-0.6em', opacity: 0 }}
                transition={spring.digit}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        ) : (
          <span key={`${chars.length}-${i}`} className="whitespace-pre">
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

import { motion } from 'motion/react'
import { Chip } from '@/components/app/Chip'
import { TruncateTip } from '@/components/app/Tip'
import type { Settings } from '@/lib/api'
import { NBSP, fmtDuration, leftText, inText } from '@/lib/format'
import { spring } from '@/lib/motion'
import { subjectIndex } from '@/lib/subjects'
import { toMin } from '@/lib/time'
import { cn } from '@/lib/utils'
import { BellToggle } from './BellToggle'
import { JoinButton } from './JoinButton'
import type { Lesson, RowState } from './schedule'

const NODE_Y = 18

export const ROW_GRID = 'grid grid-cols-[40px_12px_minmax(0,1fr)_minmax(76px,max-content)_28px] gap-x-2'

export function LessonRow({
  lesson,
  state,
  first,
  last,
  nowMin,
  settings,
  remind,
  onRemind,
}: {
  lesson: Lesson
  state: RowState
  first: boolean
  last: boolean
  nowMin: number
  settings: Settings
  remind: boolean
  onRemind: (next: boolean) => void
}) {
  const start = toMin(lesson.start)
  const end = toMin(lesson.end)
  const past = state === 'past'
  const current = state === 'current'
  const subject = lesson.subject || 'Без назви'

  let meta: React.ReactNode
  if (past) meta = 'завершилась'
  else if (current)
    meta = (
      <>
        <span className="font-medium text-primary-soft-foreground">йде зараз</span>
        {` · ${leftText(end - nowMin)}`}
      </>
    )
  else if (state === 'future') meta = inText(start - nowMin)
  else meta = fmtDuration(end - start)

  const share = current ? Math.max(0, Math.min(1, (nowMin - start) / Math.max(1, end - start))) : 0

  return (
    <li
      data-subject={subjectIndex(lesson.subject, settings.subjectColors)}
      aria-current={current ? 'time' : undefined}
      className={cn(ROW_GRID, 'min-h-14 items-start py-2', current && '-mx-1.5 rounded-lg bg-primary-soft px-1.5')}
    >
      <div className={cn('flex flex-col tabular-nums', past && 'text-muted-foreground')}>
        <span aria-hidden className="text-body leading-5 font-semibold">{lesson.start}</span>
        <span aria-hidden className="text-caption text-muted-foreground">{lesson.end}</span>
        <span className="sr-only">
          з{NBSP}{lesson.start} до{NBSP}{lesson.end}
        </span>
      </div>

      <div aria-hidden className="relative -my-2 self-stretch">
        {!first ? <span className="absolute top-0 left-[5px] w-0.5 bg-border" style={{ height: NODE_Y }} /> : null}
        {!last ? (
          <span className="absolute bottom-0 left-[5px] w-0.5 bg-border" style={{ top: NODE_Y }}>
            {current ? (
              <motion.span
                className="absolute inset-0 origin-top bg-primary"
                initial={false}
                animate={{ scaleY: share }}
                transition={spring.progress}
              />
            ) : null}
          </span>
        ) : null}
        <span
          className={cn(
            'absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-subject',
            current ? 'size-2.5 shadow-[0_0_0_3px_color-mix(in_oklch,var(--s-solid)_25%,transparent)]' : 'size-2',
            past && 'opacity-40',
          )}
          style={{ top: NODE_Y }}
        />
      </div>

      <div className="min-w-0">
        <TruncateTip label={subject}>
          <p className={cn('line-clamp-2 select-text', 'text-subject-title', past && 'text-muted-foreground')}>{subject}</p>
        </TruncateTip>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-muted-foreground tabular-nums">
          <span className="whitespace-nowrap">{meta}</span>
          {lesson.week !== 'all' && lesson.week ? <Chip week={lesson.week} /> : null}
        </p>
      </div>

      <div className="-mt-0.5 flex justify-end">
        {lesson.link ? (
          <JoinButton url={lesson.link} subject={subject} variant={past ? 'ghost' : 'outline'} size="xs" />
        ) : null}
      </div>

      <BellToggle className="-mt-1" on={remind} subject={subject} settings={settings} onToggle={onRemind} />
    </li>
  )
}

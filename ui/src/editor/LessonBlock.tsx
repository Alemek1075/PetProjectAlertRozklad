import type { KeyboardEvent } from 'react'
import { BellRing, CircleAlert, CircleX } from 'lucide-react'
import { motion } from 'motion/react'
import { Chip } from '@/components/app/Chip'
import { Tip } from '@/components/app/Tip'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Lesson, Week } from '@/lib/api'
import { DAY_LOWER, fmtRange, linkInfo, weekName } from '@/lib/format'
import { spring, tween } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useEditor } from './context'
import { WEEK_OPTIONS, conflictText } from './lessons'

export interface BlockBox { left: number; top: number; width: number; height: number }

export function LessonBlock({
  lesson,
  box,
  subject,
  invalid,
  conflict,
  isNew,
  instant,
  onKeyDown,
}: {
  lesson: Lesson
  box: BlockBox
  subject: number
  invalid: boolean
  conflict: Lesson | undefined
  isNew: boolean
  instant: boolean
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, l: Lesson) => void
}) {
  const { selectedId, select, setActiveDay, actions } = useEditor()
  const selected = selectedId === lesson.id
  const name = lesson.subject.trim() || 'Без назви'
  const service = lesson.week !== 'all' && box.width < 104 ? undefined : linkInfo(lesson.link)?.service
  const h = box.height
  const label = [
    name,
    `${DAY_LOWER[lesson.day]} ${fmtRange(lesson.start, lesson.end)}`,
    lesson.week !== 'all' ? `лише ${weekName(lesson.week)}` : '',
    lesson.remind ? 'з нагадуванням' : '',
    invalid ? 'кінець раніше за початок' : '',
    conflict ? conflictText(conflict) : '',
  ]
    .filter(Boolean)
    .join(', ')

  const corner = invalid ? (
    <CircleX className="size-3 text-destructive" aria-hidden />
  ) : conflict ? (
    <Tip label={conflictText(conflict)} side="top">
      <span className="flex text-muted-foreground">
        <CircleAlert className="size-3" aria-hidden />
      </span>
    </Tip>
  ) : null

  return (
    <ContextMenu onOpenChange={(o) => o && select(lesson.id)}>
      <ContextMenuTrigger asChild>
        <motion.button
          type="button"
          data-lid={lesson.id}
          data-field="block"
          data-subject={subject}
          data-invalid={invalid || undefined}
          aria-label={label}
          aria-pressed={selected}
          initial={isNew ? { opacity: 0, scale: 0.98, ...box } : false}
          animate={{ opacity: 1, scale: 1, ...box }}
          exit={{ opacity: 0, transition: tween.fadeOut }}
          transition={instant ? { duration: 0 } : { default: spring.layout, opacity: tween.fade, scale: spring.enter }}
          onClick={() => {
            select(lesson.id)
            setActiveDay(lesson.day)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            actions.focusField(lesson.id, 'subject', true)
          }}
          onKeyDown={(e) => onKeyDown(e, lesson)}
          className={cn(
            'lesson-block absolute flex flex-col overflow-hidden rounded-lg text-left text-subject-foreground',
            h < 36 ? 'px-1.5 py-0.5' : 'p-1.5',
            selected && 'z-10 shadow-e1 ring-2 ring-ring ring-offset-1 ring-offset-card',
            isNew && 'editor-new',
          )}
        >
          <span className="flex min-w-0 items-start gap-1">
            <span className={cn('min-w-0 flex-1 text-caption font-semibold [overflow-wrap:anywhere]', h < 44 ? 'line-clamp-1' : 'line-clamp-2')}>{name}</span>
            {corner ? <span className="mt-0.5 shrink-0">{corner}</span> : null}
          </span>
          {h >= 44 ? (
            <span className="truncate text-micro font-normal tabular-nums opacity-90">{fmtRange(lesson.start, lesson.end)}</span>
          ) : null}
          {h >= 64 && (service || lesson.remind || lesson.week !== 'all') ? (
            <span className="mt-auto flex min-w-0 items-center gap-1.5 pt-0.5 text-micro font-normal">
              {service ? <span className="truncate">{service}</span> : null}
              {lesson.remind ? <BellRing className="size-3 shrink-0" aria-hidden /> : null}
              {lesson.week !== 'all' ? (
                <Chip week={lesson.week} className="ml-auto border-current/30 text-subject-foreground" />
              ) : null}
            </span>
          ) : null}
        </motion.button>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-52">
        <ContextMenuItem onSelect={() => actions.focusField(lesson.id, 'subject', true)}>Редагувати</ContextMenuItem>
        <ContextMenuItem onSelect={() => actions.duplicate(lesson.id)}>
          Дублювати
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Тиждень</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup value={lesson.week} onValueChange={(v) => actions.setWeek(lesson.id, v as Week)}>
              {WEEK_OPTIONS.map((o) => (
                <ContextMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuCheckboxItem checked={lesson.remind} onCheckedChange={(v) => actions.setRemind(lesson.id, v === true)}>
          Нагадувати
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => actions.remove(lesson.id)}>
          Видалити
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

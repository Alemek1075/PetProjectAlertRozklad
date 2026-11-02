import { Fragment, useMemo, useState, type KeyboardEvent } from 'react'
import { CircleAlert, CircleX, Ellipsis, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { isoDow } from '@shared/schedule.mjs'
import { Chip } from '@/components/app/Chip'
import { LinkInput } from '@/components/app/LinkInput'
import { SubjectDot } from '@/components/app/SubjectDot'
import { TimeInput } from '@/components/app/TimeInput'
import { Tip } from '@/components/app/Tip'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Lesson, Week } from '@/lib/api'
import { DAY_NAMES, DAY_SHORT, pairsCount } from '@/lib/format'
import { spring, tween } from '@/lib/motion'
import { subjectIndex, subjectKey, subjectStats } from '@/lib/subjects'
import { moveStartKeepLength } from '@/lib/time'
import { useMinute } from '@/lib/useMinute'
import { cn } from '@/lib/utils'
import { fieldSelector, useEditor, type FocusField } from './context'
import { END_ERROR, START_MISSING } from './Inspector'
import { DAYS, WEEK_OPTIONS, addInDayLabel, conflictText, hasStart, isInvalidRange, matchesFilter, sortLessons } from './lessons'
import { SubjectInput } from './SubjectInput'
import { BP } from './useWidth'

const QUIET =
  'h-8 text-ellipsis border-transparent bg-transparent shadow-none hover:border-input dark:bg-transparent aria-invalid:border-destructive has-disabled:bg-transparent has-disabled:opacity-100 dark:has-disabled:bg-transparent [&_button:disabled]:opacity-0'
const QUIET_TRIGGER =
  'w-full border-transparent bg-transparent px-2 text-foreground shadow-none hover:border-input dark:bg-transparent dark:hover:bg-transparent [&>svg]:opacity-0 group-hover/row:[&>svg]:opacity-100 group-focus-within/row:[&>svg]:opacity-100 aria-expanded:[&>svg]:opacity-100'

const COLS = 8

function flashLink(id: string) {
  const el = document.querySelector(fieldSelector(id, 'link'))?.closest('[data-slot="input-group"]') as HTMLElement | null
  if (!el) return
  el.classList.remove('flash-soft')
  void el.offsetWidth
  el.classList.add('flash-soft')
}

interface RowProps {
  lesson: Lesson
  dimmed: boolean
  compact: boolean
  isNew: boolean
  onNav: (e: KeyboardEvent<HTMLElement>, id: string, field: FocusField) => void
  onStartFocus: () => void
  onStartBlur: () => void
}

function ListRow({ lesson, dimmed, compact, isNew, onNav, onStartFocus, onStartBlur }: RowProps) {
  const { ctl, lessons, settings, actions, conflicts } = useEditor()
  const [startErr, setStartErr] = useState<string | null>(null)
  const [endErr, setEndErr] = useState<string | null>(null)
  const id = lesson.id
  const name = lesson.subject.trim() || 'Без назви'
  const others = useMemo(() => subjectStats(lessons.filter((l) => l.id !== id)), [lessons, id])
  const conflict = conflicts.get(id)
  const error = startErr ?? endErr ?? (!hasStart(lesson) ? START_MISSING : isInvalidRange(lesson) ? END_ERROR : null)
  const errId = `row-err-${id}`
  const warnId = `row-warn-${id}`

  const onAccept = (subject: string) => {
    if (lesson.link.trim()) return
    const src = ctl.lastEditedWithSubject(subjectKey, subjectKey(subject))
    if (!src) return
    ctl.update(id, { subject, link: src.link })
    requestAnimationFrame(() => flashLink(id))
  }

  return (
    <Fragment>
      <motion.tr
        layout="position"
        transition={{ layout: spring.layout }}
        initial={isNew ? { opacity: 0 } : false}
        animate={{ opacity: dimmed ? 0.5 : 1 }}
        exit={{ opacity: 0, transition: tween.fadeOut }}
        data-row-id={id}
        className={cn(
          'group/row h-10 hover:bg-accent/50 focus-within:bg-accent/50',
          isNew && 'editor-new',
        )}
      >
        <td className="pl-1">
          <div className="flex items-center gap-1">
            <SubjectDot index={subjectIndex(lesson.subject, settings.subjectColors)} className="ml-1" />
            <Select value={String(lesson.day)} onValueChange={(v) => actions.moveDay(id, Number(v))}>
              <SelectTrigger
                size="sm"
                data-lid={id}
                data-field="day"
                aria-label={`День: ${DAY_NAMES[lesson.day]}`}
                className={QUIET_TRIGGER}
              >
                <SelectValue>{DAY_SHORT[lesson.day]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {DAY_NAMES[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </td>
        <td className="px-1">
          <TimeInput
            data-lid={id}
            data-field="start"
            aria-label={`Початок: ${name}`}
            value={lesson.start}
            onValueChange={(v) =>
              ctl.update(id, v ? moveStartKeepLength(lesson.start, lesson.end, v, settings.defaultDuration) : { start: '' })
            }
            onRange={(a, b) => ctl.update(id, { start: a, end: b })}
            onInvalidChange={setStartErr}
            aria-invalid={!hasStart(lesson) || undefined}
            aria-describedby={error ? errId : undefined}
            className={QUIET}
            onFocus={onStartFocus}
            onBlur={onStartBlur}
            onKeyDown={(e) => onNav(e, id, 'start')}
          />
        </td>
        <td className="px-1">
          <TimeInput
            data-lid={id}
            data-field="end"
            aria-label={`Кінець: ${name}`}
            value={lesson.end}
            onValueChange={(v) => ctl.update(id, { end: v })}
            onInvalidChange={setEndErr}
            aria-invalid={isInvalidRange(lesson) || undefined}
            aria-describedby={error ? errId : undefined}
            className={QUIET}
            onKeyDown={(e) => onNav(e, id, 'end')}
          />
        </td>
        <td className="relative px-1">
          <SubjectInput
            data-lid={id}
            data-field="subject"
            aria-label="Предмет"
            aria-describedby={conflict ? warnId : undefined}
            value={lesson.subject}
            onValueChange={(v) => ctl.update(id, { subject: v })}
            suggestions={others}
            colors={settings.subjectColors}
            onAccept={onAccept}
            className={cn(QUIET, 'font-medium', conflict && 'pr-7')}
            onKeyDown={(e) => onNav(e, id, 'subject')}
          />
          {conflict ? (
            <Tip label={conflictText(conflict)} side="top">
              <span className="absolute top-1/2 right-3 flex -translate-y-1/2 text-muted-foreground">
                <CircleAlert className="size-3.5" aria-hidden />
                <span id={warnId} className="sr-only">
                  {conflictText(conflict)}
                </span>
              </span>
            </Tip>
          ) : null}
        </td>
        <td className="px-1">
          <LinkInput
            data-lid={id}
            data-field="link"
            aria-label={`Посилання: ${name}`}
            value={lesson.link}
            onValueChange={(v) => ctl.update(id, { link: v })}
            showService={!compact}
            revealButton
            groupClassName={QUIET}
            className="text-ellipsis"
            onKeyDown={(e) => onNav(e, id, 'link')}
          />
        </td>
        <td className="px-1">
          <Select value={lesson.week} onValueChange={(v) => actions.setWeek(id, v as Week)}>
            <SelectTrigger
              size="sm"
              data-lid={id}
              data-field="week"
              aria-label={`Тиждень: ${name}`}
              className={cn(QUIET_TRIGGER, lesson.week === 'all' && 'text-muted-foreground')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="px-1">
          <div className="flex justify-center">
            <Checkbox
              data-lid={id}
              data-field="remind"
              checked={lesson.remind}
              onCheckedChange={(v) => actions.setRemind(id, v === true)}
              aria-label={`Нагадувати: ${name}`}
            />
          </div>
        </td>
        <td className="pr-1">
          <DropdownMenu>
            <Tip label="Дії">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={`Дії: ${name}`} data-lid={id} data-field="menu">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onSelect={() => actions.duplicate(id)}>
                Дублювати
                <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Перенести на</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={String(lesson.day)} onValueChange={(v) => actions.moveDay(id, Number(v))}>
                    {DAYS.map((d) => (
                      <DropdownMenuRadioItem key={d} value={String(d)}>
                        {DAY_NAMES[d]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem disabled={!lesson.link.trim()} onSelect={() => window.api.openLink(lesson.link.trim())}>
                Відкрити посилання
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(id)}>
                Видалити
                <DropdownMenuShortcut>Del</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </motion.tr>
      {error ? (
        <motion.tr key={`${id}-err`} initial={{ opacity: 0 }} animate={{ opacity: dimmed ? 0.5 : 1 }} exit={{ opacity: 0, transition: tween.fadeOut }}>
          <td />
          <td colSpan={COLS - 1} className="px-1 pb-2">
            <p id={errId} className="flex items-center gap-1.5 pl-2.5 text-caption text-destructive">
              <CircleX className="size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          </td>
        </motion.tr>
      ) : null}
    </Fragment>
  )
}

export function ListView() {
  const { lessons, filter, actions, fresh, width } = useEditor()
  const now = useMinute()
  const today = isoDow(now)
  const compact = width < BP.wide
  const [frozen, setFrozen] = useState<string[] | null>(null)

  const ordered = useMemo(() => {
    const sorted = sortLessons(lessons)
    if (!frozen) return sorted
    const pos = new Map(frozen.map((id, i) => [id, i]))
    const rank = (l: Lesson) => pos.get(l.id) ?? Number.MAX_SAFE_INTEGER
    return [...lessons].sort((a, b) => a.day - b.day || rank(a) - rank(b) || sorted.indexOf(a) - sorted.indexOf(b))
  }, [lessons, frozen])

  const byDay = useMemo(() => {
    const m = new Map<number, Lesson[]>()
    for (const d of DAYS) m.set(d, [])
    for (const l of ordered) m.get(l.day)!.push(l)
    return m
  }, [ordered])

  const onNav = (e: KeyboardEvent<HTMLElement>, id: string, field: FocusField) => {
    if (e.key !== 'Enter' || e.altKey || e.metaKey) return
    if (e.ctrlKey) {
      e.preventDefault()
      actions.addBelow(id)
      return
    }
    const flat = ordered.map((l) => l.id)
    const next = flat[flat.indexOf(id) + (e.shiftKey ? -1 : 1)]
    if (!next) return
    e.preventDefault()
    ;(document.querySelector(fieldSelector(next, field)) as HTMLElement | null)?.focus()
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="px-6 pb-24">
        <table className="w-full max-w-[1280px] table-fixed border-collapse text-body" data-focus-inset aria-label="Розклад">
          <colgroup>
            <col style={{ width: compact ? 72 : 112 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 84 }} />
            <col />
            <col />
            <col style={{ width: 124 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="h-8 border-b text-left text-caption font-medium text-muted-foreground">
              <th scope="col" className="pl-3 font-medium">День</th>
              <th scope="col" className="px-3.5 font-medium">Початок</th>
              <th scope="col" className="px-3.5 font-medium">Кінець</th>
              <th scope="col" className="px-3.5 font-medium">Предмет</th>
              <th scope="col" className="px-3.5 font-medium">Посилання</th>
              <th scope="col" className="px-3 font-medium">Тиждень</th>
              <th scope="col" className="text-center font-medium">Нагад.</th>
              <th scope="col">
                <span className="sr-only">Дії</span>
              </th>
            </tr>
          </thead>
          {DAYS.map((d) => {
            const list = byDay.get(d)!
            const isToday = d === today
            const addBtn = (
              <Tip label={addInDayLabel(d)}>
                <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => actions.add(d)}>
                  <Plus />
                  Пара
                </Button>
              </Tip>
            )
            return (
              <tbody key={d} data-day={d} className="border-b last:border-b-0">
                <tr className={list.length ? 'h-9' : 'h-9'}>
                  <th scope="rowgroup" colSpan={COLS} className="pr-1 pl-3 text-left font-normal">
                    <div className="flex items-center gap-2">
                      {list.length ? (
                        <>
                          <span className="text-sm font-semibold" aria-current={isToday ? 'date' : undefined}>
                            {DAY_NAMES[d]}
                          </span>
                          <span className="text-caption text-muted-foreground tabular-nums">{pairsCount(list.length)}</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground" aria-current={isToday ? 'date' : undefined}>
                          <span className="font-semibold text-foreground">{DAY_NAMES[d]}</span> · пар немає
                        </span>
                      )}
                      {isToday ? <Chip>сьогодні</Chip> : null}
                      <span className="flex-1" />
                      {addBtn}
                    </div>
                  </th>
                </tr>
                <AnimatePresence initial={false}>
                  {list.map((l) => (
                    <ListRow
                      key={l.id}
                      lesson={l}
                      dimmed={!matchesFilter(l, filter)}
                      compact={compact}
                      isNew={fresh.has(l.id)}
                      onNav={onNav}
                      onStartFocus={() => setFrozen(ordered.map((x) => x.id))}
                      onStartBlur={() => setFrozen(null)}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            )
          })}
        </table>
      </div>
    </ScrollArea>
  )
}

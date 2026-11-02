import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CircleAlert, CircleX, Copy, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Dialog as DialogPrimitive, RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { LinkInput } from '@/components/app/LinkInput'
import { SubjectDot } from '@/components/app/SubjectDot'
import { TimeInput } from '@/components/app/TimeInput'
import { Tip } from '@/components/app/Tip'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Lesson, Settings, Week } from '@/lib/api'
import { DAY_NAMES, DAY_SHORT, NBSP, fmtDuration, fmtRange, weekName } from '@/lib/format'
import { spring, tween } from '@/lib/motion'
import { SUBJECT_COLOR_NAMES, SUBJECT_INDICES, subjectIndex, subjectKey, subjectStats } from '@/lib/subjects'
import { addMin, durationOf, isHHMM, moveStartKeepLength } from '@/lib/time'
import { cn } from '@/lib/utils'
import { fieldSelector, useEditor } from './context'
import { DAYS, WEEK_OPTIONS, conflictText, hasStart, isInvalidRange } from './lessons'
import { SubjectInput } from './SubjectInput'
import { BP } from './useWidth'

export const END_ERROR = 'Кінець має бути пізніше за початок'
export const START_MISSING = 'Вкажіть час початку, інакше пару не буде збережено'
export const EMPTY_SUBJECT = 'Порожня назва збережеться як «Без назви»'

export function reminderText(s: Settings): string | null {
  const before = s.remindBefore > 0 ? `За${NBSP}${fmtDuration(s.remindBefore)}` : ''
  if (before && s.remindAtStart) return `${before} і на початку пари`
  if (before) return `${before} до початку`
  if (s.remindAtStart) return 'На початку пари'
  return null
}

function FieldBlock({ label, htmlFor, children, id }: { label: string; htmlFor?: string; children: ReactNode; id?: string }) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-labelledby={id}>
      <label id={id} htmlFor={htmlFor} className="text-caption font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

function Message({ kind, children, id }: { kind: 'error' | 'warning'; children: ReactNode; id?: string }) {
  const Icon = kind === 'error' ? CircleX : CircleAlert
  return (
    <p id={id} className={cn('flex items-start gap-1.5 text-caption', kind === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="text-pretty">{children}</span>
    </p>
  )
}

const QUICK = [45, 80, 90] as const

function InspectorBody({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const { ctl, lessons, settings, actions, conflicts, thisWeek, go } = useEditor()
  const [startErr, setStartErr] = useState<string | null>(null)
  const [endErr, setEndErr] = useState<string | null>(null)
  const id = lesson.id
  const idx = subjectIndex(lesson.subject, settings.subjectColors)
  const key = subjectKey(lesson.subject)
  const colorable = !!key && key !== 'без назви'
  const others = useMemo(() => subjectStats(lessons.filter((l) => l.id !== id)), [lessons, id])
  const len = hasStart(lesson) && isHHMM(lesson.end) ? durationOf(lesson.start, lesson.end) : null
  const conflict = conflicts.get(id)
  const remindText = reminderText(settings)
  const backToGrid = () => (document.querySelector(fieldSelector(id, 'block')) as HTMLElement | null)?.focus()

  const setStart = (v: string) => {
    if (!v) ctl.update(id, { start: '' })
    else ctl.update(id, moveStartKeepLength(lesson.start, lesson.end, v, settings.defaultDuration))
  }

  const setColor = (n: number) => {
    void window.api.saveSettings({ subjectColors: { ...settings.subjectColors, [key]: n } }).then((s) => {
      if (ctl.state) ctl.apply({ ...s, lessons: ctl.state.lessons })
    })
  }

  const onAccept = (subject: string) => {
    if (lesson.link.trim()) return
    const src = ctl.lastEditedWithSubject(subjectKey, subjectKey(subject))
    if (!src) return
    ctl.update(id, { subject, link: src.link })
    const el = document.querySelector(fieldSelector(id, 'link'))?.closest('[data-slot="input-group"]')
    el?.classList.remove('flash-soft')
    void (el as HTMLElement | undefined)?.offsetWidth
    el?.classList.add('flash-soft')
  }

  const errId = `insp-time-err-${id}`
  const timeError = startErr ?? endErr ?? (!hasStart(lesson) ? START_MISSING : isInvalidRange(lesson) ? END_ERROR : null)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-2" data-subject={idx}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SubjectDot />
            <h2 className={cn('line-clamp-1 text-title', !lesson.subject.trim() && 'text-muted-foreground')}>
              {lesson.subject.trim() || 'Без назви'}
            </h2>
          </div>
          <p className="mt-0.5 pl-4 text-caption text-muted-foreground tabular-nums">
            {DAY_NAMES[lesson.day]}
            {hasStart(lesson) ? ` · ${fmtRange(lesson.start, lesson.end)}` : ''}
          </p>
        </div>
        <div className="-mt-0.5 -mr-1.5 flex shrink-0 items-center">
          <Tip label="Дублювати" kbd={['Ctrl', 'D']}>
            <Button variant="ghost" size="icon-sm" aria-label="Дублювати" onClick={() => actions.duplicate(id)}>
              <Copy />
            </Button>
          </Tip>
          <Tip label="Видалити" kbd="Del">
            <Button variant="ghost" size="icon-sm" aria-label="Видалити" className="hover:text-destructive" onClick={() => actions.remove(id)}>
              <Trash2 />
            </Button>
          </Tip>
          <Tip label="Закрити" kbd="Esc">
            <Button variant="ghost" size="icon-sm" aria-label="Закрити" onClick={onClose}>
              <X />
            </Button>
          </Tip>
        </div>
      </div>

      <FieldBlock label="Предмет" htmlFor={`insp-subject-${id}`}>
        <SubjectInput
          id={`insp-subject-${id}`}
          data-lid={id}
          data-field="subject"
          value={lesson.subject}
          onValueChange={(v) => ctl.update(id, { subject: v })}
          suggestions={others}
          colors={settings.subjectColors}
          onAccept={onAccept}
          className="h-9 text-subject-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              backToGrid()
            }
          }}
        />
        {!lesson.subject.trim() ? <p className="text-caption text-muted-foreground">{EMPTY_SUBJECT}</p> : null}
      </FieldBlock>

      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-medium" id={`insp-color-${id}`}>
          Колір
        </span>
        <div className="flex items-center gap-3">
          <RadioGroupPrimitive.Root
            aria-labelledby={`insp-color-${id}`}
            value={String(idx)}
            disabled={!colorable}
            onValueChange={(v) => setColor(Number(v))}
            orientation="horizontal"
            className="flex items-center gap-1.5"
          >
            {SUBJECT_INDICES.map((n) => (
              <RadioGroupPrimitive.Item
                key={n}
                value={String(n)}
                data-subject={n}
                aria-label={`Колір предмета: ${SUBJECT_COLOR_NAMES[n]}`}
                className="size-4 rounded-full bg-subject ring-offset-2 ring-offset-background transition-shadow disabled:opacity-40 data-[state=checked]:ring-2 data-[state=checked]:ring-foreground/70"
              />
            ))}
          </RadioGroupPrimitive.Root>
        </div>
        <p className="text-caption text-muted-foreground">
          {colorable ? `Колір: ${SUBJECT_COLOR_NAMES[idx]}. Для всіх пар цього предмета.` : 'Колір з’явиться, коли пара матиме назву.'}
        </p>
      </div>

      <FieldBlock label="День" id={`insp-day-${id}`}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={String(lesson.day)}
          onValueChange={(v) => v && actions.moveDay(id, Number(v))}
          className="w-full"
          aria-labelledby={`insp-day-${id}`}
        >
          {DAYS.map((d) => (
            <ToggleGroupItem
              key={d}
              value={String(d)}
              aria-label={DAY_NAMES[d]}
              className="flex-1 data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground"
            >
              {DAY_SHORT[d]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FieldBlock>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`insp-start-${id}`} className="text-caption font-medium">
              Початок
            </label>
            <TimeInput
              id={`insp-start-${id}`}
              data-lid={id}
              data-field="start"
              variant="inspector"
              value={lesson.start}
              onValueChange={setStart}
              onRange={(a, b) => ctl.update(id, { start: a, end: b })}
              onInvalidChange={setStartErr}
              onEscapeBlur={backToGrid}
              aria-invalid={!hasStart(lesson) || undefined}
              aria-describedby={timeError ? errId : undefined}
            />
          </div>
          <span className="pb-1.5 text-muted-foreground" aria-hidden>
            –
          </span>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`insp-end-${id}`} className="text-caption font-medium">
              Кінець
            </label>
            <TimeInput
              id={`insp-end-${id}`}
              data-lid={id}
              data-field="end"
              variant="inspector"
              value={lesson.end}
              onValueChange={(v) => ctl.update(id, { end: v })}
              onInvalidChange={setEndErr}
              onEscapeBlur={backToGrid}
              aria-invalid={isInvalidRange(lesson) || undefined}
              aria-describedby={timeError ? errId : undefined}
            />
          </div>
        </div>
        {timeError ? (
          <Message kind="error" id={errId}>
            {timeError}
          </Message>
        ) : len !== null ? (
          <p className="text-caption text-muted-foreground tabular-nums">Тривалість {fmtDuration(len)}</p>
        ) : null}
        <div className="flex items-center gap-1.5">
          {QUICK.map((n) => (
            <Button
              key={n}
              variant="outline"
              size="xs"
              disabled={!hasStart(lesson)}
              aria-pressed={len === n}
              className="tabular-nums aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-soft-foreground"
              onClick={() => ctl.update(id, { end: addMin(lesson.start, n) })}
            >
              {n}
              {NBSP}хв
            </Button>
          ))}
        </div>
        {conflict ? <Message kind="warning">{conflictText(conflict)}</Message> : null}
      </div>

      <FieldBlock label="Посилання" htmlFor={`insp-link-${id}`}>
        <LinkInput
          id={`insp-link-${id}`}
          data-lid={id}
          data-field="link"
          value={lesson.link}
          onValueChange={(v) => ctl.update(id, { link: v })}
          groupClassName="h-9 rounded-lg has-disabled:bg-transparent has-disabled:opacity-100 dark:has-disabled:bg-input/30"
        />
      </FieldBlock>

      <FieldBlock label="Тиждень" id={`insp-week-${id}`}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={lesson.week}
          onValueChange={(v) => v && actions.setWeek(id, v as Week)}
          className="w-full"
          aria-labelledby={`insp-week-${id}`}
        >
          {WEEK_OPTIONS.map((o) => (
            <ToggleGroupItem
              key={o.value}
              value={o.value}
              className="flex-1 data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground"
            >
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-caption text-muted-foreground">Цей тиждень — {weekName(thisWeek)}</p>
      </FieldBlock>

      <div className="flex items-start justify-between gap-4 border-t pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={`insp-remind-${id}`} className="text-body font-medium">
            Нагадати перед початком
          </label>
          {remindText ? (
            <p className="text-caption text-muted-foreground">{remindText}</p>
          ) : (
            <p className="text-caption text-muted-foreground">
              Нагадування вимкнені в налаштуваннях.{' '}
              <Button variant="link" size="xs" className="h-auto p-0 text-caption" onClick={() => go('settings/reminders')}>
                Налаштування
              </Button>
            </p>
          )}
        </div>
        <Switch
          id={`insp-remind-${id}`}
          data-lid={id}
          data-field="remind"
          checked={lesson.remind}
          onCheckedChange={(v) => actions.setRemind(id, v)}
        />
      </div>

      <p className="text-caption text-muted-foreground">Зміни зберігаються автоматично.</p>
    </div>
  )
}

const SHORTCUTS: [string[], string][] = [
  [['N'], 'нова пара'],
  [['Ctrl', 'D'], 'дублювати'],
  [['Del'], 'видалити'],
  [['←', '↑', '↓', '→'], 'між парами'],
  [['Alt', '↑/↓'], 'на 5 хв раніше / пізніше'],
  [['Alt', '←/→'], 'інший день'],
  [['Ctrl', 'Z'], 'скасувати'],
  [['Esc'], 'зняти виділення'],
]

function InspectorEmpty() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-body text-muted-foreground text-pretty">
        Виберіть пару, щоб змінити її, або двічі клацніть вільний час у сітці.
      </p>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-caption text-muted-foreground">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label} className="contents">
            <dt className="flex items-center gap-1">
              {keys.map((k) => (
                <Kbd key={k} className="h-5 min-w-5 text-micro">
                  {k}
                </Kbd>
              ))}
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function useBackKey(lesson: Lesson | null) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !lesson) return
    const el = document.querySelector(fieldSelector(lesson.id, 'block')) as HTMLElement | null
    if (el) {
      e.preventDefault()
      e.stopPropagation()
      el.focus()
    }
  }
}

export function Inspector() {
  const { lessons, selectedId, select, width } = useEditor()
  const lesson = lessons.find((l) => l.id === selectedId) ?? null
  const docked = width >= BP.dock
  const onKey = useBackKey(lesson)

  if (docked) {
    return (
      <aside
        aria-label="Властивості пари"
        className="flex w-[360px] shrink-0 flex-col border-l bg-background"
        onKeyDown={onKey}
      >
        <ScrollArea className="min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={lesson?.id ?? 'none'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.12 } }}
              exit={{ opacity: 0, transition: tween.fadeOut }}
            >
              {lesson ? <InspectorBody lesson={lesson} onClose={() => select(null)} /> : <InspectorEmpty />}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </aside>
    )
  }

  return (
    <DialogPrimitive.Root open={!!lesson} onOpenChange={(o) => !o && select(null)} modal={false}>
      <AnimatePresence>
        {lesson ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content
              forceMount
              asChild
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              onKeyDown={onKey}
            >
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={spring.sheet}
                className="fixed top-11 right-0 bottom-0 z-40 flex w-[360px] flex-col border-l bg-background shadow-e3 outline-none"
              >
                <DialogPrimitive.Title className="sr-only">Властивості пари</DialogPrimitive.Title>
                <ScrollArea className="min-h-0 flex-1">
                  <InspectorBody key={lesson.id} lesson={lesson} onClose={() => select(null)} />
                </ScrollArea>
              </motion.aside>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

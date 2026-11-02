import { BellOff, BellRing, CalendarDays, Copy, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { alertHoursOpen } from '@shared/alert-hours.mjs'
import { TimeInput } from '@/components/app/TimeInput'
import { Tip } from '@/components/app/Tip'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AlertHours, AlertHoursDay, AlertHoursMode, AlertHoursRange } from '@/lib/api'
import { DAY_ACC, DAY_NAMES, NBSP, fmtClock } from '@/lib/format'
import { toMin } from '@/lib/time'
import { useMinute } from '@/lib/useMinute'
import { cn } from '@/lib/utils'
import { useEditor } from './context'
import { Row, Section, useSaveSettings } from './SettingsView'

const MODES: [AlertHoursMode, string][] = [
  ['all', 'Цілодобово'],
  ['hours', 'Години'],
  ['off', 'Не сповіщати'],
]

function nextFlip(ah: AlertHours, now: Date): Date | null {
  const open = alertHoursOpen(ah, now)
  const t = new Date(now)
  t.setSeconds(0, 0)
  for (let i = 0; i < 7 * 24 * 60; i++) {
    t.setMinutes(t.getMinutes() + 1)
    if (alertHoursOpen(ah, t) !== open) return t
  }
  return null
}

function whenText(at: Date, now: Date) {
  const days = Math.round(
    (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  )
  const time = `о${NBSP}${fmtClock(at)}`
  if (days === 0) return time
  if (days === 1) return `завтра ${time}`
  return `${DAY_ACC[((at.getDay() + 6) % 7) + 1]} ${time}`
}

function StatusLine({ ah, enabled }: { ah: AlertHours; enabled: boolean }) {
  const now = useMinute()
  if (!enabled) {
    return (
      <p className="flex items-center gap-1.5 text-body text-muted-foreground">
        <BellOff className="size-4" aria-hidden />
        Сповіщення про тривоги вимкнені в налаштуваннях
      </p>
    )
  }
  const open = alertHoursOpen(ah, now)
  const flip = ah.enabled ? nextFlip(ah, now) : null
  const Icon = open ? BellRing : BellOff
  let text: string
  if (!ah.enabled) text = 'Сповіщення приходять цілодобово'
  else if (open) text = flip ? `Зараз сповіщення приходять, тиша почнеться ${whenText(flip, now)}` : 'Зараз сповіщення приходять'
  else text = flip ? `Зараз тиша, сповіщення почнуться ${whenText(flip, now)}` : 'Сповіщення не приходять жодного дня'
  return (
    <p className="flex items-center gap-1.5 text-body text-muted-foreground" aria-live="polite">
      <Icon className={cn('size-4', open ? 'text-primary' : '')} aria-hidden />
      {text}
    </p>
  )
}

function RangeRow({
  id,
  range,
  onChange,
  onRemove,
}: {
  id: string
  range: AlertHoursRange
  onChange: (r: AlertHoursRange) => void
  onRemove?: () => void
}) {
  const overnight = toMin(range.start) >= toMin(range.end)
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-body text-muted-foreground">з</span>
      <TimeInput id={`${id}-s`} aria-label="Початок" value={range.start} onValueChange={(v) => v && onChange({ ...range, start: v })} />
      <span className="text-body text-muted-foreground">до</span>
      <TimeInput id={`${id}-e`} aria-label="Кінець" value={range.end} onValueChange={(v) => v && onChange({ ...range, end: v })} />
      {overnight ? <span className="text-caption text-muted-foreground">до наступного дня</span> : null}
      {onRemove ? (
        <Tip label="Прибрати проміжок">
          <Button variant="ghost" size="icon-xs" aria-label="Прибрати проміжок" className="text-muted-foreground" onClick={onRemove}>
            <X />
          </Button>
        </Tip>
      ) : null}
    </div>
  )
}

function DayRow({
  index,
  day,
  onChange,
  onCopy,
}: {
  index: number
  day: AlertHoursDay
  onChange: (d: AlertHoursDay) => void
  onCopy: (to: 'weekdays' | 'all') => void
}) {
  const id = `ah-${index}`
  const ranges = day.ranges.length ? day.ranges : [{ start: '08:00', end: '18:00' }]
  return (
    <Row
      label={DAY_NAMES[index + 1]}
      control={
        <>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={day.mode}
            aria-label={DAY_NAMES[index + 1]}
            onValueChange={(v) => v && onChange({ mode: v as AlertHoursMode, ranges })}
          >
            {MODES.map(([v, label]) => (
              <ToggleGroupItem key={v} value={v} className="data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <DropdownMenu>
            <Tip label="Скопіювати на інші дні">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Скопіювати на інші дні" className="text-muted-foreground">
                  <Copy />
                </Button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onCopy('weekdays')}>На всі будні (Пн–Пт)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCopy('all')}>На всі дні</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {day.mode === 'hours' ? (
        <div className="mt-3 flex flex-col gap-2">
          {ranges.map((r, i) => (
            <RangeRow
              key={i}
              id={`${id}-${i}`}
              range={r}
              onChange={(nr) => onChange({ ...day, ranges: ranges.map((x, j) => (j === i ? nr : x)) })}
              onRemove={ranges.length > 1 ? () => onChange({ ...day, ranges: ranges.filter((_, j) => j !== i) }) : undefined}
            />
          ))}
          {ranges.length < 6 ? (
            <div>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => {
                  const last = ranges[ranges.length - 1]
                  onChange({ ...day, ranges: [...ranges, { start: last.end, end: last.end < '22:00' ? '22:00' : '23:59' }] })
                }}
              >
                <Plus />
                Ще проміжок
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Row>
  )
}

export function AlertHoursView() {
  const { settings, lessons } = useEditor()
  const save = useSaveSettings()
  const ah = settings.alertHours

  const setAh = (next: AlertHours) => void save({ alertHours: next })
  const setDay = (i: number, d: AlertHoursDay) => setAh({ ...ah, days: ah.days.map((x, j) => (j === i ? d : x)) })
  const copyDay = (i: number, to: 'weekdays' | 'all') => {
    const src = ah.days[i]
    setAh({ ...ah, days: ah.days.map((x, j) => (j === i || (to === 'weekdays' && j > 4) ? x : { mode: src.mode, ranges: src.ranges.map((r) => ({ ...r })) })) })
    toast.success(to === 'weekdays' ? 'Скопійовано на будні' : 'Скопійовано на всі дні')
  }
  const fromLessons = () => {
    const days = ah.days.map((_, i): AlertHoursDay => {
      const own = lessons.filter((l) => l.day === i + 1)
      if (!own.length) return { mode: 'off', ranges: ah.days[i].ranges }
      const start = own.map((l) => l.start).sort()[0]
      const end = own.map((l) => l.end).sort().pop()!
      return { mode: 'hours', ranges: [{ start, end }] }
    })
    setAh({ enabled: true, days })
    toast.success('Години взято з розкладу пар', { description: 'Дні без пар — без сповіщень. Можна підправити вручну.' })
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex max-w-[720px] flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-heading">Коли сповіщати про тривоги</h1>
          <p className="text-body text-muted-foreground text-pretty">
            Сповіщення про тривогу приходять лише в обрані години. Якщо тривога почалася в тиху годину і ще триває, сповіщення
            прийде, щойно почнеться ваш час. Відбій приходить для тих тривог, про які ви отримали сповіщення. Значок у треї
            й віджет показують тривогу завжди.
          </p>
          <StatusLine ah={ah} enabled={settings.alertNotifications} />
        </div>

        <Section id="alert-hours" title="Розклад сповіщень" icon={BellRing}>
          <Row
            label="Сповіщати лише в обрані години"
            htmlFor="ah-enabled"
            description={ah.enabled ? 'Поза цими годинами сповіщень про тривоги не буде' : 'Зараз вимкнено: сповіщення приходять цілодобово'}
            control={<Switch id="ah-enabled" checked={ah.enabled} onCheckedChange={(v) => setAh({ ...ah, enabled: v })} />}
          />
          <div className={cn(!ah.enabled && 'opacity-60')}>
            {ah.days.map((d, i) => (
              <DayRow key={i} index={i} day={d} onChange={(nd) => setDay(i, nd)} onCopy={(to) => copyDay(i, to)} />
            ))}
          </div>
          {lessons.length ? (
            <div className="border-t px-4 py-3">
              <Button variant="outline" size="sm" onClick={fromLessons}>
                <CalendarDays />
                Заповнити за розкладом пар
              </Button>
            </div>
          ) : null}
        </Section>
      </div>
    </ScrollArea>
  )
}

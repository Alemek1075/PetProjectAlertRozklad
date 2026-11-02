import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Bell,
  CircleCheck,
  CircleX,
  Copy,
  Eye,
  EyeOff,
  FileInput,
  FileOutput,
  FileSpreadsheet,
  Monitor,
  Moon,
  Play,
  Repeat2,
  Settings2,
  ShieldAlert,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { anchorFor, mondayOf, weekType } from '@shared/schedule.mjs'
import { Spin } from '@/components/app/Spin'
import { Tip } from '@/components/app/Tip'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Settings, SoundKind, ThemeSetting } from '@/lib/api'
import { CITIES, OBLASTS, errorCopy, updatedText } from '@/lib/alerts-copy'
import { MONTHS_GEN, NBSP, weekName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useEditor } from './context'
import type { SettingsSection } from './useRoute'
import { BP } from './useWidth'

type SectionId = Exclude<SettingsSection, 'token'>

const SECTIONS: { id: SectionId; title: string; icon: LucideIcon }[] = [
  { id: 'reminders', title: 'Нагадування', icon: Bell },
  { id: 'weeks', title: 'Тижні', icon: Repeat2 },
  { id: 'alerts', title: 'Тривоги', icon: ShieldAlert },
  { id: 'general', title: 'Загальне', icon: Settings2 },
  { id: 'csv', title: 'Імпорт і експорт', icon: FileSpreadsheet },
]

const CSV_SAMPLE = `День,Час,Предмет,Посилання,Тиждень
Понеділок,08:30-09:50,Матаналіз,https://zoom.us/j/123,
,10:10-11:30,Англійська,https://meet.google.com/abc-defg-hij,
Вт,11:50,Фізика,,чисельник
Вт,11:50,Хімія,,знаменник`

const CSV_COLUMNS: [string, string, string][] = [
  ['День', 'так', '«Пн», «Понеділок», «1», «Пн (чис)»'],
  ['Час', 'так', '«08:30», «08:30-09:50»'],
  ['Предмет', 'так', 'будь-який текст'],
  ['Посилання', 'ні', '«https://zoom.us/j/123»'],
  ['Тиждень', 'ні', '«чисельник», «знаменник»'],
  ['Нагадування', 'ні', '«так», «ні»'],
]

export function useSaveSettings() {
  const { ctl } = useEditor()
  return (patch: Partial<Settings> & { token?: string }) =>
    window.api
      .saveSettings(patch)
      .then((s) => {
        if (ctl.state) ctl.apply({ ...s, lessons: ctl.state.lessons })
        return s
      })
      .catch((e) => {
        toast.error('Не вдалося зберегти налаштування', { description: String(e?.message ?? e) })
        return null
      })
}

function weekRangeText(monday: Date) {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}–${sunday.getDate()}${NBSP}${MONTHS_GEN[sunday.getMonth()]}`
  }
  return `${monday.getDate()}${NBSP}${MONTHS_GEN[monday.getMonth()]} – ${sunday.getDate()}${NBSP}${MONTHS_GEN[sunday.getMonth()]}`
}

export function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section id={`settings-${id}`} data-section={id} aria-labelledby={`settings-${id}-h`} className="scroll-mt-6">
      <h2 id={`settings-${id}-h`} className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
    </section>
  )
}

export function Row({
  label,
  description,
  htmlFor,
  control,
  children,
  className,
  rowRef,
}: {
  label: ReactNode
  description?: ReactNode
  htmlFor?: string
  control?: ReactNode
  children?: ReactNode
  className?: string
  rowRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div ref={rowRef} role="group" className={cn('border-t px-4 py-4 first:border-t-0', className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </label>
          {description ? <p className="text-body text-muted-foreground text-pretty">{description}</p> : null}
        </div>
        {control ? <div className="flex shrink-0 items-center gap-2">{control}</div> : null}
      </div>
      {children}
    </div>
  )
}

function NumberSetting({
  id,
  value,
  min,
  max,
  step,
  error,
  onSave,
}: {
  id: string
  value: number
  min: number
  max: number
  step: number
  error: string
  onSave: (n: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [bad, setBad] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setDraft(String(value)), [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const commit = () => {
    const n = Number(draft.trim().replace(',', '.'))
    const ok = draft.trim() !== '' && Number.isFinite(n) && n >= min && n <= max
    if (!ok) {
      setBad(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setBad(false), 4000)
    }
    const v = Number.isFinite(n) && draft.trim() !== '' ? Math.min(max, Math.max(min, Math.round(n))) : value
    setDraft(String(v))
    if (v !== value) onSave(v)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <InputGroup className="w-28">
        <InputGroupInput
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-err` : undefined}
          className="text-right tabular-nums"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>хв</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      {bad ? (
        <p id={`${id}-err`} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SoundTest() {
  const kinds: [SoundKind, string][] = [
    ['lesson', 'Пара'],
    ['alert', 'Тривога'],
    ['clear', 'Відбій'],
  ]
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-body text-muted-foreground">Прослухати</span>
      <ButtonGroup aria-label="Прослухати звуки">
        {kinds.map(([k, label]) => (
          <Button key={k} variant="outline" size="xs" onClick={() => window.api.testSound(k)}>
            <Play />
            {label}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  )
}

function TokenRow({ rowRef }: { rowRef: React.Ref<HTMLDivElement> }) {
  const { settings, alerts } = useEditor()
  const save = useSaveSettings()
  const [value, setValue] = useState('')
  const [shown, setShown] = useState(false)
  const [checking, setChecking] = useState(false)
  const snap = useRef('')
  const sig = `${alerts.status}|${alerts.errorCode}|${alerts.updatedAt}`

  useEffect(() => {
    if (checking && sig !== snap.current) setChecking(false)
  }, [sig, checking])
  useEffect(() => {
    if (!checking) return
    const t = window.setTimeout(() => setChecking(false), 15000)
    return () => window.clearTimeout(t)
  }, [checking])

  const submit = (token: string) => {
    snap.current = sig
    setChecking(true)
    void save({ token }).then(() => {
      setValue('')
      setShown(false)
      void window.api.refreshAlerts().catch(() => {})
    })
  }

  const placeholder = settings.tokenFromSettings
    ? 'Збережено в налаштуваннях'
    : settings.hasToken
      ? 'Береться з файлу Tocken.txt'
      : 'Вставте токен'

  let status: ReactNode
  if (checking || alerts.status === 'loading') {
    status = (
      <>
        <Spin className="size-3.5" />
        Перевіряємо токен…
      </>
    )
  } else if (alerts.status === 'ok' && settings.hasToken) {
    status = (
      <>
        <CircleCheck className="size-3.5 text-alert-clear" aria-hidden />
        Дані надходять{alerts.updatedAt ? ` · ${updatedText(alerts.updatedAt)}` : ''}
      </>
    )
  } else {
    status = (
      <>
        <CircleX className="size-3.5 text-destructive" aria-hidden />
        {errorCopy(alerts).title}
      </>
    )
  }

  return (
    <Row
      rowRef={rowRef}
      label="Токен alerts.in.ua"
      htmlFor="settings-token"
      description="Потрібен для даних про тривоги. Отримати токен можна на сайті alerts.in.ua."
    >
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InputGroup className="w-80">
          <InputGroupInput
            id="settings-token"
            type={shown ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={value}
            className="font-mono text-body placeholder:font-sans"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) submit(value.trim())
            }}
          />
          <InputGroupAddon align="inline-end">
            <Tip label={shown ? 'Сховати токен' : 'Показати токен'}>
              <InputGroupButton
                size="icon-xs"
                aria-label={shown ? 'Сховати токен' : 'Показати токен'}
                className="text-muted-foreground"
                onClick={() => setShown((s) => !s)}
              >
                {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </InputGroupButton>
            </Tip>
          </InputGroupAddon>
        </InputGroup>
        <Button variant="outline" size="sm" disabled={!value.trim()} onClick={() => submit(value.trim())}>
          Зберегти
        </Button>
        {settings.tokenFromSettings ? (
          <Button variant="ghost" size="sm" onClick={() => submit('')}>
            Видалити
          </Button>
        ) : null}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-caption text-muted-foreground" aria-live="polite">
        {status}
      </p>
    </Row>
  )
}

function CsvHelp() {
  return (
    <div className="border-t px-4 py-4">
      <h3 className="mb-2 text-sm font-medium">Формат CSV</h3>
      <table className="w-full text-body">
        <thead>
          <tr className="h-8 border-b text-left text-caption text-muted-foreground">
            <th scope="col" className="pr-4 font-medium">Колонка</th>
            <th scope="col" className="pr-4 font-medium">Обов’язкова</th>
            <th scope="col" className="font-medium">Приклади</th>
          </tr>
        </thead>
        <tbody>
          {CSV_COLUMNS.map(([col, req, ex]) => (
            <tr key={col} className="h-8 border-b last:border-b-0">
              <td className="pr-4 font-medium">{col}</td>
              <td className="pr-4 text-muted-foreground">{req}</td>
              <td className="text-muted-foreground">{ex}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-body text-muted-foreground text-pretty">
        Роздільник: кома, крапка з комою або табуляція. Порожня клітинка дня береться з рядка вище. Рядок заголовків
        розпізнається автоматично.
      </p>
      <div className="relative mt-3">
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 pr-10 font-mono text-caption">{CSV_SAMPLE}</pre>
        <Tip label="Копіювати приклад">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Копіювати приклад"
            className="absolute top-2 right-2 text-muted-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(CSV_SAMPLE).then(
                () => toast.success('Приклад скопійовано'),
                () => toast.error('Не вдалося скопіювати'),
              )
            }}
          >
            <Copy />
          </Button>
        </Tip>
      </div>
      <p className="mt-3 text-body text-muted-foreground">У Google Таблицях: Файл → Завантажити → CSV.</p>
    </div>
  )
}

export function SettingsView() {
  const { settings, route, width, actions, go } = useEditor()
  const save = useSaveSettings()
  const viewport = useRef<HTMLDivElement>(null)
  const tokenRow = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState<SectionId>('reminders')
  const withNav = width >= BP.settingsNav
  const now = new Date()
  const thisType = weekType(now, settings.weekAnchor)
  const nextMonday = mondayOf(now)
  nextMonday.setDate(nextMonday.getDate() + 7)
  const nextType = thisType === 'odd' ? 'even' : 'odd'

  useEffect(() => {
    const sec = route.section
    if (!sec) return
    const id = sec === 'token' ? 'alerts' : sec
    const t = window.setTimeout(() => {
      document.getElementById(`settings-${id}`)?.scrollIntoView({ block: 'start' })
      if (sec === 'token') {
        const row = tokenRow.current
        row?.classList.remove('flash-soft')
        void row?.offsetWidth
        row?.classList.add('flash-soft')
        ;(document.getElementById('settings-token') as HTMLInputElement | null)?.focus({ preventScroll: true })
      }
    }, 30)
    return () => window.clearTimeout(t)
  }, [route.section, route.nonce])

  useEffect(() => {
    const root = viewport.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null
    if (!root || !withNav) return
    const onScroll = () => {
      const top = root.getBoundingClientRect().top
      let cur: SectionId = 'reminders'
      for (const s of SECTIONS) {
        const el = document.getElementById(`settings-${s.id}`)
        if (el && el.getBoundingClientRect().top - top <= 48) cur = s.id
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) cur = 'csv'
      setCurrent(cur)
    }
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [withNav])

  return (
    <div className="flex min-h-0 flex-1">
      {withNav ? (
        <nav aria-label="Розділи налаштувань" className="w-[180px] shrink-0 border-r bg-sidebar p-3">
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-current={current === s.id ? 'location' : undefined}
                  className={cn(
                    'w-full justify-start font-normal text-muted-foreground',
                    current === s.id && 'bg-sidebar-accent font-medium text-foreground',
                  )}
                  onClick={() => document.getElementById(`settings-${s.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
                >
                  {s.title}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <ScrollArea ref={viewport} className="min-h-0 flex-1">
        <div className="flex max-w-[720px] flex-col gap-8 px-6 py-6">
          <h1 className="text-heading">Налаштування</h1>

          <Section id="reminders" title="Нагадування" icon={Bell}>
            <Row
              label="Нагадувати заздалегідь"
              htmlFor="s-remind-before"
              description="Для пар із дзвіночком. 0 — без попереднього нагадування."
              control={
                <NumberSetting
                  id="s-remind-before"
                  value={settings.remindBefore}
                  min={0}
                  max={120}
                  step={1}
                  error={`Від 0 до 120${NBSP}хв`}
                  onSave={(n) => void save({ remindBefore: n })}
                />
              }
            />
            <Row
              label="Сповіщення на початку пари"
              htmlFor="s-remind-start"
              description="Ще одне нагадування, коли пара починається"
              control={<Switch id="s-remind-start" checked={settings.remindAtStart} onCheckedChange={(v) => void save({ remindAtStart: v })} />}
            />
            <Row
              label="Звук"
              htmlFor="s-sound"
              description="Короткий сигнал разом зі сповіщеннями"
              control={<Switch id="s-sound" checked={settings.sound} onCheckedChange={(v) => void save({ sound: v })} />}
            >
              <SoundTest />
            </Row>
          </Section>

          <Section id="weeks" title="Тижні" icon={Repeat2}>
            <Row
              label="Цей тиждень"
              description={
                <>
                  Тижні чергуються автоматично. Пари з позначкою «Чисельник» або «Знаменник» показуються лише у свої тижні.
                  <br />
                  Наступний тиждень ({weekRangeText(nextMonday)}) — {weekName(nextType)}.
                </>
              }
              control={
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={thisType}
                  aria-label="Цей тиждень"
                  onValueChange={(v) => v && void save({ weekAnchor: anchorFor(new Date(), v as 'odd' | 'even') })}
                >
                  <ToggleGroupItem value="odd" className="data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground">
                    Чисельник
                  </ToggleGroupItem>
                  <ToggleGroupItem value="even" className="data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground">
                    Знаменник
                  </ToggleGroupItem>
                </ToggleGroup>
              }
            />
          </Section>

          <Section id="alerts" title="Тривоги" icon={ShieldAlert}>
            <Row
              label="Регіон"
              htmlFor="s-region"
              description="Тривоги цього регіону показуються у віджеті, на значку в треї та в сповіщеннях"
              control={
                <Select value={settings.region} onValueChange={(v) => void save({ region: v })}>
                  <SelectTrigger id="s-region" className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-80">
                    <SelectGroup>
                      <SelectLabel>Міста</SelectLabel>
                      {CITIES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Області</SelectLabel>
                      {OBLASTS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              }
            />
            <Row
              label="Сповіщення про тривогу і відбій"
              htmlFor="s-alert-notif"
              description={
                <>
                  {settings.alertHours.enabled ? 'Лише в обрані години. ' : 'Цілодобово. '}
                  <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => go('alert-hours')}>
                    Налаштувати години
                  </button>
                </>
              }
              control={
                <Switch id="s-alert-notif" checked={settings.alertNotifications} onCheckedChange={(v) => void save({ alertNotifications: v })} />
              }
            />
            <Row
              label="Мапа у віджеті без тривоги"
              htmlFor="s-show-map"
              description="Під час тривоги мапа показується, якщо вміщується на екрані"
              control={<Switch id="s-show-map" checked={settings.showMap} onCheckedChange={(v) => void save({ showMap: v })} />}
            />
            <TokenRow rowRef={tokenRow} />
          </Section>

          <Section id="general" title="Загальне" icon={Settings2}>
            <Row
              label="Запускати разом з Windows"
              htmlFor="s-autostart"
              control={<Switch id="s-autostart" checked={settings.autostart} onCheckedChange={(v) => void save({ autostart: v })} />}
            />
            <Row
              label="Тривалість пари за замовчуванням"
              htmlFor="s-duration"
              description="Для нових пар і рядків CSV, де вказано лише час початку"
              control={
                <NumberSetting
                  id="s-duration"
                  value={settings.defaultDuration}
                  min={10}
                  max={300}
                  step={5}
                  error={`Від 10 до 300${NBSP}хв`}
                  onSave={(n) => void save({ defaultDuration: n })}
                />
              }
            />
            <Row
              label="Тема"
              control={
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={settings.theme}
                  aria-label="Тема"
                  onValueChange={(v) => v && void save({ theme: v as ThemeSetting })}
                >
                  {(
                    [
                      ['system', Monitor, 'Як у Windows'],
                      ['light', Sun, 'Світла'],
                      ['dark', Moon, 'Темна'],
                    ] as const
                  ).map(([v, Icon, label]) => (
                    <ToggleGroupItem
                      key={v}
                      value={v}
                      className="data-[state=on]:bg-primary-soft data-[state=on]:text-primary-soft-foreground"
                    >
                      <Icon />
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              }
            />
          </Section>

          <Section id="csv" title="Імпорт і експорт" icon={FileSpreadsheet}>
            <Row
              label="Файл CSV"
              description="Можна також перетягнути файл .csv у це вікно або вставити клітинки з Google Таблиць (Ctrl+V)."
            >
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => actions.importPick()}>
                  <FileInput />
                  Імпортувати CSV…
                </Button>
                <Button variant="outline" size="sm" onClick={() => actions.exportCsv()}>
                  <FileOutput />
                  Експортувати CSV…
                </Button>
              </div>
            </Row>
            <CsvHelp />
          </Section>
        </div>
      </ScrollArea>
    </div>
  )
}

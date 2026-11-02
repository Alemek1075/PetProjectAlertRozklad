import { Fragment, useMemo, useState, type KeyboardEvent } from 'react'
import { CircleAlert, CircleX, FileX2 } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Chip } from '@/components/app/Chip'
import { Spin } from '@/components/app/Spin'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ImportIssue, ImportPreview, ParsedLesson } from '@/lib/api'
import { DAY_SHORT, count, fmtRange, linkInfo, pairsCount, rowsCount, shortUrl } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EditorDialogContent } from './parts'

type Mode = 'replace' | 'append'

const WEEK_WORD = { all: 'щотижня', odd: 'чисельник', even: 'знаменник' } as const

interface Line {
  line: number
  lesson: ParsedLesson | null
  errors: ImportIssue[]
  warnings: ImportIssue[]
}

function buildLines(p: ImportPreview): Line[] {
  const map = new Map<number, Line>()
  const get = (line: number) => {
    let l = map.get(line)
    if (!l) map.set(line, (l = { line, lesson: null, errors: [], warnings: [] }))
    return l
  }
  for (const l of p.lessons) get(l.line).lesson = l
  for (const i of p.issues) (i.kind === 'error' ? get(i.line).errors : get(i.line).warnings).push(i)
  return [...map.values()].sort((a, b) => a.line - b.line)
}

const sourceText = (s: string) => (s === 'Буфер обміну' ? 'З буфера обміну' : s)

export function ImportDialog({
  preview,
  onClose,
  onApply,
  onFormatHelp,
}: {
  preview: ImportPreview | null
  onClose: () => void
  onApply: (p: ImportPreview, mode: Mode) => Promise<void>
  onFormatHelp: () => void
}) {
  return (
    <Dialog open={!!preview} onOpenChange={(o) => !o && onClose()}>
      {preview ? <ImportBody key={preview.source + preview.rows} preview={preview} onClose={onClose} onApply={onApply} onFormatHelp={onFormatHelp} /> : null}
    </Dialog>
  )
}

function ImportBody({
  preview,
  onClose,
  onApply,
  onFormatHelp,
}: {
  preview: ImportPreview
  onClose: () => void
  onApply: (p: ImportPreview, mode: Mode) => Promise<void>
  onFormatHelp: () => void
}) {
  const [tab, setTab] = useState<'all' | 'errors'>('all')
  const [mode, setMode] = useState<Mode>('replace')
  const [busy, setBusy] = useState(false)
  const lines = useMemo(() => buildLines(preview), [preview])
  const errorLines = lines.filter((l) => l.errors.length)
  const dup = useMemo(() => new Set(preview.duplicateLines), [preview])
  const found = preview.lessons.length
  const appendCount = preview.lessons.filter((l) => !dup.has(l.line)).length
  const dupCount = found - appendCount
  const existing = preview.existingCount
  const effectiveMode: Mode = existing ? mode : 'replace'
  const nothing = found === 0
  const shown = tab === 'errors' ? errorLines : lines

  const description =
    `${sourceText(preview.source)} · знайдено ${pairsCount(found)}` +
    (errorLines.length ? ` · ${rowsCount(errorLines.length)} пропущено` : '')

  const apply = async () => {
    if (busy || nothing) return
    setBusy(true)
    try {
      await onApply(preview, effectiveMode)
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey || e.altKey) return
    const t = e.target as HTMLElement
    if (t.closest('button') && !t.closest('[role="radio"]')) return
    e.preventDefault()
    if (nothing) onClose()
    else void apply()
  }

  const primaryLabel = effectiveMode === 'append' ? `Додати ${pairsCount(appendCount)}` : `Імпортувати ${pairsCount(found)}`

  return (
    <EditorDialogContent className="flex max-h-[calc(100dvh-48px)] flex-col gap-0 p-0 sm:max-w-[800px]" onKeyDown={onKey}>
      <div className="flex flex-col gap-1 px-6 pt-5 pb-4 pr-14">
        <DialogTitle className="text-title">Імпорт розкладу</DialogTitle>
        <DialogDescription className="text-body text-muted-foreground tabular-nums">{description}</DialogDescription>
      </div>

      {nothing ? (
        <div className="flex flex-col items-start gap-3 border-t px-6 py-6">
          <FileX2 className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Пар не знайдено</p>
            <p className="max-w-[560px] text-body text-muted-foreground text-pretty">
              {preview.source === 'Буфер обміну' ? 'У скопійованих клітинках' : `У файлі ${preview.source}`} не вдалося
              розпізнати жодної пари. Перевірте, що є колонки День і Час.
            </p>
          </div>
          {preview.issues.length ? (
            <ul className="flex max-h-40 w-full flex-col gap-1 overflow-auto text-caption">
              {preview.issues.slice(0, 20).map((i, n) => (
                <li key={n} className="flex items-start gap-1.5">
                  <span className="w-12 shrink-0 text-muted-foreground tabular-nums">Рядок {i.line}</span>
                  <span className={i.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{i.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onFormatHelp}>
            Формат CSV
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t px-6 pt-4 pb-4">
          {errorLines.length ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'errors')}>
              <TabsList>
                <TabsTrigger value="all" className="tabular-nums">
                  Усі {preview.rows}
                </TabsTrigger>
                <TabsTrigger value="errors" className="tabular-nums">
                  Помилки {errorLines.length}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
          <div className="max-h-80 min-h-24 overflow-auto overscroll-contain rounded-lg border">
            <table className="w-full table-fixed text-body">
              <colgroup>
                <col style={{ width: 64 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 104 }} />
                <col />
                <col style={{ width: 96 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 92 }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-popover">
                <tr className="h-8 border-b text-left text-caption text-muted-foreground">
                  <th scope="col" className="px-3 font-medium">Рядок</th>
                  <th scope="col" className="px-2 font-medium">День</th>
                  <th scope="col" className="px-2 font-medium">Час</th>
                  <th scope="col" className="px-2 font-medium">Предмет</th>
                  <th scope="col" className="px-2 font-medium">Посилання</th>
                  <th scope="col" className="px-2 font-medium">Тиждень</th>
                  <th scope="col" className="px-2 font-medium">Нагад.</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <PreviewLine
                    key={l.line}
                    line={l}
                    duplicate={effectiveMode === 'append' && dup.has(l.line)}
                    remindColumn={preview.hasRemindColumn}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!preview.hasRemindColumn ? (
            <p className="text-caption text-muted-foreground">Нагадування для пар, що вже є в розкладі, буде збережено.</p>
          ) : null}

          {existing ? (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-sm font-medium" id="import-mode">
                Що зробити з поточним розкладом ({pairsCount(existing)})?
              </p>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} aria-labelledby="import-mode" className="gap-2">
                <label className="flex items-start gap-2.5">
                  <RadioGroupItem value="replace" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body font-medium">Замінити розклад</span>
                    <span className="text-caption text-muted-foreground">
                      Поточні {count(existing, 'пару', 'пари', 'пар')} буде видалено. Нагадування збережуться для однакових пар. Можна
                      скасувати.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5">
                  <RadioGroupItem value="append" className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body font-medium">Додати до наявних</span>
                    <span className="text-caption text-muted-foreground">
                      {dupCount
                        ? `Нові пари додадуться, ${count(dupCount, 'однакову', 'однакові', 'однакових')} буде пропущено.`
                        : 'Нові пари додадуться до розкладу.'}
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 rounded-b-xl border-t bg-muted/50 px-6 py-3">
        {nothing ? (
          <DialogPrimitive.Close asChild>
            <Button variant="outline">Закрити</Button>
          </DialogPrimitive.Close>
        ) : (
          <>
            <DialogPrimitive.Close asChild>
              <Button variant="outline">Скасувати</Button>
            </DialogPrimitive.Close>
            <Button onClick={() => void apply()} disabled={busy || (effectiveMode === 'append' && !appendCount)}>
              {busy ? <Spin className="size-3.5 text-primary-foreground" /> : null}
              {primaryLabel}
              <Kbd className="ml-1 h-[18px] min-w-[18px] bg-primary-foreground/15 text-micro text-primary-foreground">↵</Kbd>
            </Button>
          </>
        )}
      </div>
    </EditorDialogContent>
  )
}

function PreviewLine({ line, duplicate, remindColumn }: { line: Line; duplicate: boolean; remindColumn: boolean }) {
  const lineCell = <td className="px-3 align-top leading-8 text-muted-foreground tabular-nums">{line.line}</td>
  if (line.errors.length || !line.lesson) {
    const e = line.errors[0]
    return (
      <tr className="border-b bg-destructive/5 last:border-b-0">
        {lineCell}
        <td colSpan={6} className="px-2 py-1.5">
          <p className="flex items-start gap-1.5 text-destructive">
            <CircleX className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 text-pretty">
              {e?.message ?? 'Рядок пропущено'}
              {e?.raw?.length ? (
                <span className="ml-2 font-mono text-caption text-muted-foreground">{e.raw.filter(Boolean).join(' · ')}</span>
              ) : null}
            </span>
          </p>
        </td>
      </tr>
    )
  }
  const l = line.lesson
  const svc = linkInfo(l.link)
  return (
    <Fragment>
      <tr className={cn('h-8', !line.warnings.length && 'border-b last:border-b-0', duplicate && 'text-muted-foreground')}>
        {lineCell}
        <td className="px-2">{DAY_SHORT[l.day]}</td>
        <td className="px-2 tabular-nums">{l.start ? fmtRange(l.start, l.end) : '—'}</td>
        <td className="truncate px-2" title={l.subject}>
          {l.subject}
        </td>
        <td className="truncate px-2" title={l.link || undefined}>
          {l.link ? (svc?.service ?? shortUrl(l.link, 14)) : '—'}
        </td>
        <td className="px-2">{WEEK_WORD[l.week]}</td>
        <td className="px-2">
          <span className="flex items-center gap-2">
            {remindColumn && l.remind ? 'так' : '—'}
            {duplicate ? <Chip className="ml-auto">вже є</Chip> : null}
          </span>
        </td>
      </tr>
      {line.warnings.length ? (
        <tr className="border-b last:border-b-0">
          <td />
          <td colSpan={6} className="px-2 pb-1.5">
            {line.warnings.map((w, i) => (
              <p key={i} className="flex items-start gap-1.5 text-caption text-muted-foreground">
                <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                {w.message}
              </p>
            ))}
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
}

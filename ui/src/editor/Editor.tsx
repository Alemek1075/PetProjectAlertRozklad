import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { hasAlternation, isoDow, weekType } from '@shared/schedule.mjs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import type { ImportPreview, Lesson, Week } from '@/lib/api'
import { NBSP, pairsCount } from '@/lib/format'
import { ipcErrorMessage } from '@/lib/ipc'
import { isArrow, isCtrl, isCtrlShift, isEditableTarget, isPlain } from '@/lib/keys'
import { addMin, isHHMM } from '@/lib/time'
import { useMinute } from '@/lib/useMinute'
import { AlertHoursView } from './AlertHoursView'
import { AppBar } from './AppBar'
import { EditorContext, fieldSelector, type EditorActions, type EditorCtx, type FocusField } from './context'
import { DropOverlay } from './DropOverlay'
import { EmptySchedule } from './EmptySchedule'
import { ImportDialog } from './ImportDialog'
import { Inspector } from './Inspector'
import {
  blankLesson,
  conflictMap,
  duplicateOf,
  lessonShort,
  nextStartIn,
  nudge as nudgeLesson,
  sortLessons,
  type WeekFilter,
} from './lessons'
import { ListView } from './ListView'
import { SettingsView } from './SettingsView'
import { ShortcutsDialog } from './ShortcutsDialog'
import { StatusBar } from './StatusBar'
import { Toolbar } from './Toolbar'
import { useLessons } from './useLessons'
import { useRoute } from './useRoute'
import { useWindowWidth } from './useWidth'
import { WeekGrid } from './WeekGrid'

const FRESH_MS = 1800

const basename = (p: string) => p.split(/[\\/]/).pop() || p

const focusedRowId = () =>
  ((document.activeElement as HTMLElement | null)?.closest?.('[data-row-id]') as HTMLElement | null)?.dataset.rowId ?? null
const focusedBlockId = () => {
  const el = document.activeElement as HTMLElement | null
  return el?.dataset?.field === 'block' ? (el.dataset.lid ?? null) : null
}
const focusedField = () => ((document.activeElement as HTMLElement | null)?.dataset?.field as FocusField | undefined) ?? null

export function EditorApp() {
  const ctl = useLessons()
  const width = useWindowWidth()
  const now = useMinute()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const [filter, setFilter] = useState<WeekFilter>('both')
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [shortcuts, setShortcuts] = useState(false)
  const importRef = useRef<() => void>(() => {})
  const { route, go, goSchedule, setView } = useRoute(() => importRef.current())

  const lessons = ctl.lessons ?? []
  const settings = ctl.state?.settings
  const conflicts = useMemo(() => conflictMap(lessons), [lessons])
  const alternation = useMemo(() => hasAlternation(lessons), [lessons])
  const thisWeek = weekType(now, settings?.weekAnchor)

  useEffect(() => {
    if (!alternation && filter !== 'both') setFilter('both')
  }, [alternation, filter])

  useEffect(() => {
    if (selectedId && ctl.lessons && !ctl.lessons.some((l) => l.id === selectedId)) setSelectedId(null)
  }, [ctl.lessons, selectedId])

  const latest = useRef({ ctl, route, selectedId, activeDay, settings, now, preview, shortcuts })
  latest.current = { ctl, route, selectedId, activeDay, settings, now, preview, shortcuts }

  const markFresh = useCallback((id: string) => {
    setFresh((s) => new Set(s).add(id))
    window.setTimeout(
      () =>
        setFresh((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        }),
      FRESH_MS,
    )
  }, [])

  const actions = useMemo<EditorActions>(() => {
    const L = () => latest.current
    const list = () => L().ctl.lessonsRef.current
    const find = (id: string) => list().find((l) => l.id === id)
    const dd = () => L().settings?.defaultDuration ?? 80

    const focusField = (id: string, field: FocusField, selectText = false) => {
      let tries = 0
      const run = () => {
        const el = document.querySelector(fieldSelector(id, field)) as HTMLElement | null
        if (el) {
          el.focus()
          el.scrollIntoView({ block: 'nearest' })
          if (selectText && el instanceof HTMLInputElement) el.select()
          return
        }
        if (++tries < 30) requestAnimationFrame(run)
      }
      requestAnimationFrame(run)
    }

    const targetDay = () => {
      const { route: r, selectedId: sel, activeDay: ad, now: n } = L()
      if (r.tab === 'schedule' && r.view === 'list') {
        const g = (document.activeElement as HTMLElement | null)?.closest?.('[data-day]') as HTMLElement | null
        if (g) return Number(g.dataset.day)
      }
      if (r.view === 'grid') {
        const s = sel ? find(sel) : null
        if (s) return s.day
        if (ad) return ad
      }
      return isoDow(n)
    }

    const insert = (l: Lesson, selectText = false) => {
      L().ctl.commit(sortLessons([...list(), l]), { structural: true, touched: [l.id] })
      setSelectedId(l.id)
      setActiveDay(l.day)
      markFresh(l.id)
      if (L().route.tab !== 'schedule') goSchedule()
      focusField(l.id, 'subject', selectText)
    }

    const move = (id: string, patch: (l: Lesson) => Lesson) => {
      const next = list().map((l) => (l.id === id ? patch(l) : l))
      L().ctl.commit(next, { structural: true, touched: [id] })
    }

    return {
      add(day, start) {
        const d = day ?? targetDay()
        insert(blankLesson(d, start ?? nextStartIn(list(), d), dd()))
      },
      addBelow(id) {
        const l = find(id)
        if (!l) return
        const start = isHHMM(l.end) ? addMin(l.end, 20) : nextStartIn(list(), l.day)
        insert(blankLesson(l.day, start, dd()))
      },
      duplicate(id) {
        const l = find(id)
        if (!l) return
        insert(duplicateOf(l), true)
      },
      remove(id) {
        const l = find(id)
        if (!l) return
        const flat = sortLessons(list())
        const i = flat.findIndex((x) => x.id === id)
        const neighbour = flat[i + 1]?.day === l.day ? flat[i + 1] : flat[i - 1]?.day === l.day ? flat[i - 1] : null
        const wasRow = focusedRowId() === id
        const field = focusedField()
        const snap = L().ctl.commit(list().filter((x) => x.id !== id), { structural: true })
        if (L().selectedId === id) setSelectedId(null)
        const tid = toast('Пару видалено', {
          description: lessonShort(l),
          action: { label: 'Скасувати', onClick: () => latest.current.ctl.undoIfTop(snap) },
        })
        L().ctl.registerUndoToast(tid)
        if (neighbour && wasRow) focusField(neighbour.id, field && field !== 'menu' ? field : 'subject')
        else if (neighbour && L().route.view === 'grid' && field === 'block') focusField(neighbour.id, 'block')
      },
      nudge(id, delta) {
        move(id, (l) => nudgeLesson(l, delta, dd()))
      },
      moveDay(id, to) {
        const l = find(id)
        if (!l) return
        const day = typeof to === 'number' ? to : ((l.day - 1 + to.by + 7) % 7) + 1
        if (day === l.day) return
        const field = focusedRowId() === id ? focusedField() : null
        move(id, (x) => ({ ...x, day }))
        setActiveDay(day)
        if (L().route.view === 'list') {
          markFresh(id)
          if (field) focusField(id, field)
        }
      },
      setWeek(id, week: Week) {
        const l = find(id)
        if (!l || l.week === week) return
        move(id, (x) => ({ ...x, week }))
      },
      setRemind(id, remind) {
        L().ctl.update(id, { remind })
      },
      remindAll(value) {
        L().ctl.commit(list().map((l) => ({ ...l, remind: value })), { structural: true })
      },
      async importPick() {
        if (L().route.tab !== 'schedule') goSchedule()
        try {
          const r = await window.api.pickCsv()
          if ('canceled' in r && r.canceled) return
          setPreview(r as ImportPreview)
        } catch (e) {
          toast.error('Не вдалося відкрити файл', { description: ipcErrorMessage(e) })
        }
      },
      async importText(text, source) {
        if (!text.trim()) return
        try {
          setPreview(await window.api.parseCsvText(text, source))
        } catch (e) {
          toast.error('Не вдалося прочитати дані', { description: ipcErrorMessage(e) })
        }
      },
      async exportCsv() {
        try {
          await L().ctl.settle()
          const r = await window.api.exportCsv()
          if ('canceled' in r && r.canceled) return
          const { path, count } = r as { path: string; count: number }
          toast.success(`Експортовано ${pairsCount(count)}`, {
            description: basename(path),
            action: { label: 'Показати в папці', onClick: () => window.api.revealInFolder(path) },
          })
        } catch (e) {
          toast.error('Не вдалося експортувати', { description: ipcErrorMessage(e) })
        }
      },
      openShortcuts() {
        setShortcuts(true)
      },
      focusField,
    }
  }, [markFresh, goSchedule])

  importRef.current = actions.importPick

  const applyImport = useCallback(async (p: ImportPreview, mode: 'replace' | 'append') => {
    const c = latest.current.ctl
    try {
      const snap = await c.beforeImport()
      const res = await window.api.applyImport(p.lessons, mode)
      setPreview(null)
      setSelectedId(null)
      const skipped = new Set(p.issues.filter((i) => i.kind === 'error').map((i) => i.line)).size
      const action = { label: 'Скасувати', onClick: () => latest.current.ctl.undoIfTop(snap) }
      const id =
        mode === 'replace'
          ? toast.success(`Розклад замінено: ${pairsCount(res.added)}`, {
              description: skipped ? `Пропущено рядків: ${skipped}` : undefined,
              action,
            })
          : toast.success(`Додано ${pairsCount(res.added)}`, {
              description: res.skippedDuplicates ? `${res.skippedDuplicates}${NBSP}вже були в розкладі` : undefined,
              action,
            })
      c.registerUndoToast(id)
    } catch (e) {
      toast.error('Не вдалося імпортувати', { description: ipcErrorMessage(e) })
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const { route: r, selectedId: sel, preview: pv, shortcuts: sc, ctl: c } = latest.current
      if (pv || sc) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('[role="menu"], [role="listbox"], [data-slot="select-content"]')) return
      const editable = isEditableTarget(e.target)
      const stop = () => {
        e.preventDefault()
        e.stopPropagation()
      }

      if (isCtrl(e, 'Digit1')) return stop(), goSchedule()
      if (isCtrl(e, 'Digit2')) return stop(), go('alert-hours')
      if (isCtrl(e, 'Digit3')) return stop(), go('settings')
      if (isCtrl(e, 'KeyO')) return stop(), actions.importPick()
      if (isCtrlShift(e, 'KeyS')) return stop(), actions.exportCsv()
      if (isCtrl(e, 'KeyS')) return stop(), void c.flush()
      if (!editable && isCtrl(e, 'KeyZ')) return stop(), c.undo()
      if (!editable && (isCtrlShift(e, 'KeyZ') || isCtrl(e, 'KeyY'))) return stop(), c.redo()
      if (!editable && e.code === 'Slash' && e.shiftKey && !e.ctrlKey && !e.altKey) return stop(), setShortcuts(true)
      if (r.tab !== 'schedule') return

      if (isCtrl(e, 'KeyN') || (!editable && isPlain(e, 'KeyN'))) return stop(), actions.add()

      const target = r.view === 'list' ? focusedRowId() : (focusedBlockId() ?? sel)
      if (target) {
        if (isCtrl(e, 'KeyD')) return stop(), actions.duplicate(target)
        if (e.altKey && !e.ctrlKey && !e.metaKey && isArrow(e.code)) {
          stop()
          if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            actions.nudge(target, (e.code === 'ArrowUp' ? -1 : 1) * (e.shiftKey ? 30 : 5))
          } else if (!e.shiftKey) {
            actions.moveDay(target, { by: e.code === 'ArrowLeft' ? -1 : 1 })
          }
          return
        }
        if (!editable && e.code === 'Delete' && !e.ctrlKey && !e.altKey && !e.shiftKey) return stop(), actions.remove(target)
      }
      if (e.code === 'Escape' && !editable && r.view === 'grid' && sel) {
        stop()
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, go, goSchedule])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const { preview: pv, shortcuts: sc } = latest.current
      if (pv || sc || isEditableTarget(e.target)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim()) return
      e.preventDefault()
      actions.importText(text, 'Буфер обміну')
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [actions])

  const select = useCallback((id: string | null) => setSelectedId(id), [])

  if (!ctl.state || !ctl.lessons || !settings) return <div className="h-screen bg-background" />

  const ctx: EditorCtx = {
    ctl,
    lessons,
    settings,
    alerts: ctl.state.alerts,
    route,
    go,
    setView,
    selectedId,
    select,
    activeDay,
    setActiveDay,
    filter,
    setFilter,
    fresh,
    conflicts,
    alternation,
    thisWeek,
    width,
    actions,
  }
  const empty = lessons.length === 0
  const grid = route.view === 'grid'

  return (
    <EditorContext.Provider value={ctx}>
      <Tabs
        value={route.tab}
        onValueChange={(v) => (v === 'schedule' ? goSchedule() : go(v))}
        className="flex h-screen flex-col gap-0 overflow-hidden bg-background"
      >
        <AppBar />
        <TabsContent value="schedule" className="flex min-h-0 flex-1 flex-col outline-none">
          <Toolbar />
          <div className="flex min-h-0 flex-1">
            {empty ? <EmptySchedule /> : grid ? <WeekGrid /> : <ListView />}
            {grid ? <Inspector /> : null}
          </div>
        </TabsContent>
        <TabsContent value="alert-hours" className="flex min-h-0 flex-1 flex-col outline-none">
          <AlertHoursView />
        </TabsContent>
        <TabsContent value="settings" className="flex min-h-0 flex-1 flex-col outline-none">
          <SettingsView />
        </TabsContent>
        <StatusBar />
      </Tabs>
      <ImportDialog
        preview={preview}
        onClose={() => setPreview(null)}
        onApply={applyImport}
        onFormatHelp={() => {
          setPreview(null)
          go('settings/csv')
        }}
      />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
      <DropOverlay onText={actions.importText} disabled={!!preview} />
    </EditorContext.Provider>
  )
}

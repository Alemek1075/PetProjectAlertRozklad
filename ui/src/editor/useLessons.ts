import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Lesson } from '@/lib/api'
import { ipcErrorMessage } from '@/lib/ipc'
import { useApiState } from '@/lib/useApiState'
import { hasStart } from './lessons'
import { useUndo } from './useUndo'

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error'

const DEBOUNCE = 400
const SAVED_VISIBLE = 2000

export function useLessons() {
  const pending = useRef(false)
  const { state, apply } = useApiState({
    acceptLessons: (origin, self) => !pending.current && (origin === null || origin !== self),
  })
  const [lessons, setLessonsState] = useState<Lesson[] | null>(null)
  const lessonsRef = useRef<Lesson[]>([])
  const seenRef = useRef<Lesson[] | null>(null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer = useRef<number | undefined>(undefined)
  const savedTimer = useRef<number | undefined>(undefined)
  const inFlight = useRef(0)
  const editedAt = useRef(new Map<string, number>())
  const undoToasts = useRef(new Set<string | number>())
  const undo = useUndo()
  const { push: undoPush, undo: undoPop, redo: redoPop, topId: undoTop } = undo

  const setLocal = useCallback((next: Lesson[]) => {
    lessonsRef.current = next
    setLessonsState(next)
  }, [])

  useEffect(() => {
    if (!state || state.lessons === seenRef.current) return
    seenRef.current = state.lessons
    if (!pending.current) setLocal(state.lessons.map((l) => ({ ...l })))
  }, [state, setLocal])

  const doSave = useCallback(async () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const seq = ++inFlight.current
    setStatus('pending')
    try {
      await window.api.saveLessons(lessonsRef.current.filter(hasStart))
      if (seq !== inFlight.current || timer.current !== undefined) return
      pending.current = false
      setStatus('saved')
      window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), SAVED_VISIBLE)
    } catch (e) {
      if (seq !== inFlight.current) return
      setStatus('error')
      console.warn('saveLessons failed:', ipcErrorMessage(e))
      toast.error('Не вдалося зберегти', {
        id: 'save-failed',
        description: 'Зміни залишились у вікні. Спробуємо ще раз.',
        action: { label: 'Повторити', onClick: () => void doSave() },
      })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void doSave(), 5000)
    }
  }, [])

  const schedule = useCallback(() => {
    pending.current = true
    setStatus('pending')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void doSave(), DEBOUNCE)
  }, [doSave])

  const flush = useCallback(async () => {
    if (pending.current) await doSave()
    else {
      setStatus('saved')
      window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), SAVED_VISIBLE)
    }
  }, [doSave])

  const settle = useCallback(async () => {
    if (pending.current) await doSave()
  }, [doSave])

  const dismissUndoToasts = useCallback(() => {
    for (const id of undoToasts.current) toast.dismiss(id)
    undoToasts.current.clear()
  }, [])

  const commit = useCallback(
    (next: Lesson[], opts: { structural?: boolean; touched?: string[] } = {}): number | null => {
      let snap: number | null = null
      if (opts.structural) {
        dismissUndoToasts()
        snap = undoPush(lessonsRef.current)
      }
      const now = Date.now()
      for (const id of opts.touched ?? []) editedAt.current.set(id, now)
      setLocal(next)
      schedule()
      return snap
    },
    [dismissUndoToasts, undoPush, setLocal, schedule],
  )

  const update = useCallback(
    (id: string, patch: Partial<Lesson>) => {
      const next = lessonsRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l))
      commit(next, { touched: [id] })
    },
    [commit],
  )

  const doUndo = useCallback(() => {
    const prev = undoPop(lessonsRef.current)
    if (!prev) return false
    dismissUndoToasts()
    setLocal(prev)
    schedule()
    return true
  }, [undoPop, setLocal, schedule, dismissUndoToasts])

  const doRedo = useCallback(() => {
    const next = redoPop(lessonsRef.current)
    if (!next) return false
    dismissUndoToasts()
    setLocal(next)
    schedule()
    return true
  }, [redoPop, setLocal, schedule, dismissUndoToasts])

  const undoIfTop = useCallback(
    (snap: number | null) => {
      if (snap !== null && undoTop() === snap) doUndo()
    },
    [undoTop, doUndo],
  )

  const registerUndoToast = useCallback((id: string | number) => {
    undoToasts.current.add(id)
  }, [])

  const beforeImport = useCallback(async () => {
    if (pending.current) await doSave()
    dismissUndoToasts()
    return undoPush(lessonsRef.current)
  }, [doSave, undoPush, dismissUndoToasts])

  useEffect(() => {
    const onUnload = () => {
      if (pending.current) void window.api.saveLessons(lessonsRef.current.filter(hasStart))
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  const lastEditedWithSubject = useCallback((key: (s: string) => string, subjectKeyValue: string) => {
    let best: Lesson | null = null
    let bestAt = -1
    for (const l of lessonsRef.current) {
      if (key(l.subject) !== subjectKeyValue || !l.link.trim()) continue
      const at = editedAt.current.get(l.id) ?? 0
      if (at >= bestAt) {
        best = l
        bestAt = at
      }
    }
    return best
  }, [])

  return useMemo(
    () => ({
      state,
      apply,
      lessons,
      lessonsRef,
      status,
      commit,
      update,
      flush,
      settle,
      undo: doUndo,
      redo: doRedo,
      undoIfTop,
      registerUndoToast,
      beforeImport,
      lastEditedWithSubject,
      canUndo: undo.canUndo,
      canRedo: undo.canRedo,
    }),
    [state, apply, lessons, status, commit, update, flush, settle, doUndo, doRedo, undoIfTop, registerUndoToast, beforeImport, lastEditedWithSubject, undo.canUndo, undo.canRedo],
  )
}

export type LessonsCtl = ReturnType<typeof useLessons>

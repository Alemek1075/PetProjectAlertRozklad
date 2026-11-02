import { useCallback, useMemo, useRef, useState } from 'react'
import type { Lesson } from '@/lib/api'

const LIMIT = 20

export interface Snapshot { id: number; lessons: Lesson[] }

export function useUndo() {
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const seq = useRef(0)
  const [version, setVersion] = useState(0)
  const touch = () => setVersion((v) => v + 1)

  const push = useCallback((current: Lesson[]) => {
    const snap = { id: ++seq.current, lessons: current }
    undoStack.current = [...undoStack.current, snap].slice(-LIMIT)
    redoStack.current = []
    touch()
    return snap.id
  }, [])

  const undo = useCallback((current: Lesson[]): Lesson[] | null => {
    const snap = undoStack.current.at(-1)
    if (!snap) return null
    undoStack.current = undoStack.current.slice(0, -1)
    redoStack.current = [...redoStack.current, { id: ++seq.current, lessons: current }].slice(-LIMIT)
    touch()
    return snap.lessons
  }, [])

  const redo = useCallback((current: Lesson[]): Lesson[] | null => {
    const snap = redoStack.current.at(-1)
    if (!snap) return null
    redoStack.current = redoStack.current.slice(0, -1)
    undoStack.current = [...undoStack.current, { id: ++seq.current, lessons: current }].slice(-LIMIT)
    touch()
    return snap.lessons
  }, [])

  const topId = useCallback(() => undoStack.current.at(-1)?.id ?? null, [])

  const canUndo = undoStack.current.length > 0
  const canRedo = redoStack.current.length > 0
  return useMemo(() => ({ push, undo, redo, topId, canUndo, canRedo }), [version])
}

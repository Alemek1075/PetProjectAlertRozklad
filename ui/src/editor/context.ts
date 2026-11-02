import { createContext, useContext } from 'react'
import type { Alerts, EditorTarget, Lesson, Settings, Week } from '@/lib/api'
import type { WeekFilter } from './lessons'
import type { LessonsCtl } from './useLessons'
import type { Route, View } from './useRoute'

export type FocusField = 'subject' | 'start' | 'end' | 'link' | 'day' | 'week' | 'remind' | 'menu' | 'block'

export interface EditorActions {
  add(day?: number, start?: string): void
  addBelow(id: string): void
  duplicate(id: string): void
  remove(id: string): void
  nudge(id: string, delta: number): void
  moveDay(id: string, to: number | { by: -1 | 1 }): void
  setWeek(id: string, week: Week): void
  setRemind(id: string, remind: boolean): void
  remindAll(value: boolean): void
  importPick(): void
  importText(text: string, source: string): void
  exportCsv(): void
  openShortcuts(): void
  focusField(id: string, field: FocusField, selectText?: boolean): void
}

export interface EditorCtx {
  ctl: LessonsCtl
  lessons: Lesson[]
  settings: Settings
  alerts: Alerts
  route: Route
  go(target: EditorTarget | string): void
  setView(v: View): void
  selectedId: string | null
  select(id: string | null): void
  activeDay: number | null
  setActiveDay(day: number | null): void
  filter: WeekFilter
  setFilter(f: WeekFilter): void
  fresh: Set<string>
  conflicts: Map<string, Lesson>
  alternation: boolean
  thisWeek: 'odd' | 'even'
  width: number
  actions: EditorActions
}

export const EditorContext = createContext<EditorCtx | null>(null)

export function useEditor(): EditorCtx {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor outside EditorContext')
  return ctx
}

export const fieldSelector = (id: string, field: FocusField) => `[data-lid="${CSS.escape(id)}"][data-field="${field}"]`

import type { Lesson, Week } from '@shared/schedule.mjs'
import type { AlertHours, AlertHoursDay, AlertHoursMode, AlertHoursRange } from '@shared/alert-hours.mjs'

export type { Lesson, Week, AlertHours, AlertHoursDay, AlertHoursMode, AlertHoursRange }

export type EditorTarget =
  | 'schedule' | 'schedule/list'
  | 'settings' | 'settings/reminders' | 'settings/weeks' | 'settings/alerts' | 'settings/token'
  | 'settings/general' | 'settings/csv'
  | 'alert-hours'
  | 'import'

export type AlertErrorCode = 'no-token' | 'bad-token' | 'forbidden' | 'rate-limit' | 'network' | 'api'
export type AlertLevel = 'red' | 'yellow'
export type SoundKind = 'lesson' | 'alert' | 'clear'
export type ThemeSetting = 'system' | 'light' | 'dark'

export interface Settings {
  region: string; remindBefore: number; remindAtStart: boolean; sound: boolean; alertNotifications: boolean
  alertHours: AlertHours
  defaultDuration: number; autostart: boolean; weekAnchor: string; theme: ThemeSetting
  showMap: boolean; hasToken: boolean; tokenFromSettings: boolean
  subjectColors: Record<string, number>
}

export interface RegionState { level: AlertLevel; full: boolean }

export interface FocusAlert {
  name: string; active: boolean; full?: boolean; level?: AlertLevel; startedAt?: string
  types?: string[]; threats?: string[]; places?: string[]
}

export interface LastClear { startedAt: string; endedAt: string; level: AlertLevel }

export interface Alerts {
  status: 'loading' | 'ok' | 'error'
  error: string | null
  errorCode: AlertErrorCode | null
  errorStatus: number | null
  updatedAt: string | null
  regions: Record<string, RegionState>
  focus: FocusAlert
  lastClear: LastClear | null
}

export interface State {
  lessons: Lesson[]
  settings: Settings
  alerts: Alerts
}

export interface ParsedLesson extends Omit<Lesson, 'id' | 'remind'> { remind?: boolean; line: number }
export interface ImportIssue { line: number; kind: 'error' | 'warning'; message: string; raw: string[] }
export interface ImportPreview {
  source: string
  lessons: ParsedLesson[]
  issues: ImportIssue[]
  rows: number
  existingCount: number
  duplicateLines: number[]
  hasRemindColumn: boolean
}
export interface ImportResult { added: number; skippedDuplicates: number; mode: 'replace' | 'append' }

export type Unsubscribe = () => void

export interface Api {
  getState(): Promise<State>
  whoami(): Promise<number>
  onState(cb: (state: State, origin: number | null) => void): Unsubscribe
  onShown(cb: () => void): Unsubscribe
  onHidden(cb: () => void): Unsubscribe
  onNavigate(cb: (target: EditorTarget) => void): Unsubscribe
  onPlaySound(cb: (kind: SoundKind) => void): Unsubscribe
  saveLessons(lessons: Lesson[]): Promise<State>
  setRemind(id: string, value: boolean): Promise<void>
  saveSettings(patch: Partial<Settings> & { token?: string }): Promise<State>
  pickCsv(): Promise<{ canceled: true } | ImportPreview>
  parseCsvText(text: string, source: string): Promise<ImportPreview>
  applyImport(lessons: ParsedLesson[], mode: 'replace' | 'append'): Promise<ImportResult>
  exportCsv(): Promise<{ canceled: true } | { path: string; count: number }>
  revealInFolder(path: string): void
  refreshAlerts(): Promise<void>
  openLink(url: string): void
  openEditor(target?: EditorTarget): void
  hidePopup(): void
  testSound(kind: SoundKind): void
  popupHeight(px: number): void
}

declare global { interface Window { api: Api } }

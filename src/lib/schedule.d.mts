export type Week = 'all' | 'odd' | 'even'

export interface Lesson {
  id: string
  day: number
  start: string
  end: string
  subject: string
  link: string
  week: Week
  remind: boolean
}

export interface Upcoming {
  lesson: Lesson
  current: boolean
  daysAhead: number
  date: Date
}

export const WEEK_LABELS: Record<Week, string>
export const WEEK_SHORT: Record<'odd' | 'even', string>
export function toMin(hhmm: string): number
export function isoDow(d: Date): number
export function isoDate(d: Date): string
export function mondayOf(date: Date): Date
export function defaultAnchor(now?: Date): string
export function weekType(date: Date, anchor?: string): 'odd' | 'even'
export function anchorFor(date: Date, type: 'odd' | 'even'): string
export function matchesWeek(lesson: Pick<Lesson, 'week'>, type: 'odd' | 'even'): boolean
export function hasAlternation(lessons: Pick<Lesson, 'week'>[]): boolean
export function lessonsOn<T extends Lesson>(lessons: T[], date: Date, anchor?: string): T[]
export function upcoming(lessons: Lesson[], anchor?: string, now?: Date): Upcoming | null

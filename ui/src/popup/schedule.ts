import { hasAlternation, isoDate, isoDow, lessonsOn, mondayOf, upcoming, weekType, type Lesson, type Upcoming } from '@shared/schedule.mjs'
import { toMin } from '@/lib/time'

export type WeekOffset = 0 | 1

export const GAP_MIN = 40
export const DUE_MIN = 15

export interface DayInfo {
  dow: number
  date: Date
  iso: string
  lessons: Lesson[]
  isToday: boolean
}

export interface WeekInfo {
  offset: WeekOffset
  monday: Date
  sunday: Date
  type: 'odd' | 'even'
  days: DayInfo[]
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export function buildWeek(lessons: Lesson[], anchor: string | undefined, now: Date, offset: WeekOffset): WeekInfo {
  const monday = addDays(mondayOf(now), offset * 7)
  const todayIso = isoDate(now)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    const iso = isoDate(date)
    return { dow: i + 1, date, iso, lessons: lessonsOn(lessons, date, anchor), isToday: iso === todayIso }
  })
  return { offset, monday, sunday: addDays(monday, 6), type: weekType(monday, anchor), days }
}

export { hasAlternation, upcoming, isoDow, weekType }
export type { Lesson, Upcoming }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type RowState = 'past' | 'current' | 'future' | 'other'

export type DayItem =
  | { kind: 'lesson'; lesson: Lesson; state: RowState; first: boolean; last: boolean }
  | { kind: 'now'; first: boolean; last: boolean }
  | { kind: 'gap'; minutes: number; untilNext: number | null; first: boolean; last: boolean }

export function dayItems(day: DayInfo, now: Date, showGaps: boolean): DayItem[] {
  const nowM = now.getHours() * 60 + now.getMinutes()
  const out: DistributiveOmit<DayItem, 'first' | 'last'>[] = []
  const list = day.lessons
  const anyCurrent = day.isToday && list.some((l) => toMin(l.start) <= nowM && nowM < toMin(l.end))
  const nextIdx = day.isToday && !anyCurrent ? list.findIndex((l) => toMin(l.start) > nowM) : -1
  let maxEnd = -1
  list.forEach((l, i) => {
    const start = toMin(l.start)
    const gap = i > 0 ? start - maxEnd : 0
    const nowHere = i === nextIdx
    if (i > 0 && showGaps && gap >= GAP_MIN) {
      if (nowHere) out.push({ kind: 'now' })
      out.push({ kind: 'gap', minutes: gap, untilNext: nowHere ? start - nowM : null })
    } else if (nowHere) out.push({ kind: 'now' })
    const end = toMin(l.end)
    const state: RowState = !day.isToday ? 'other' : end <= nowM ? 'past' : start <= nowM ? 'current' : 'future'
    out.push({ kind: 'lesson', lesson: l, state })
    maxEnd = Math.max(maxEnd, end)
  })
  return out.map((it, i) => ({ ...it, first: i === 0, last: i === out.length - 1 }) as DayItem)
}

export function nextDayWithLessons(
  weeks: WeekInfo[],
  from: { offset: WeekOffset; dow: number },
): { offset: WeekOffset; day: DayInfo } | null {
  for (const w of weeks) {
    if (w.offset < from.offset) continue
    for (const d of w.days) {
      if (w.offset === from.offset && d.dow <= from.dow) continue
      if (d.lessons.length) return { offset: w.offset, day: d }
    }
  }
  return null
}

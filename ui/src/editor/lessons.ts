import type { Lesson, Week } from '@/lib/api'
import { DAY_ACC_BARE, DAY_SHORT, NBSP, count, daysCount, fmtRange, pairsCount, quoted } from '@/lib/format'
import { addMin, durationOf, isHHMM, toMin } from '@/lib/time'

export type WeekFilter = 'both' | 'odd' | 'even'
export const DAYS = [1, 2, 3, 4, 5, 6, 7] as const

export const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')

export function sortLessons<T extends Lesson>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => a.day - b.day || (a.start || '99').localeCompare(b.start || '99') || a.id.localeCompare(b.id),
  )
}

export const hasStart = (l: Lesson) => isHHMM(l.start)
export const isInvalidRange = (l: Lesson) => hasStart(l) && isHHMM(l.end) && durationOf(l.start, l.end) <= 0

export const lengthOf = (l: Lesson, fallback: number) =>
  hasStart(l) && isHHMM(l.end) && durationOf(l.start, l.end) > 0 ? durationOf(l.start, l.end) : fallback

export function nextStartIn(lessons: Lesson[], day: number): string {
  const ends = lessons.filter((l) => l.day === day && hasStart(l) && isHHMM(l.end)).map((l) => toMin(l.end))
  if (!ends.length) return '08:30'
  const t = Math.max(...ends) + 20
  return t >= 24 * 60 ? '23:00' : addMin('00:00', t)
}

export function blankLesson(day: number, start: string, duration: number): Lesson {
  return { id: newId(), day, start, end: addMin(start, duration), subject: '', link: '', week: 'all', remind: false }
}

export function duplicateOf(l: Lesson): Lesson {
  const week: Week = l.week === 'odd' ? 'even' : l.week === 'even' ? 'odd' : 'all'
  return { ...l, id: newId(), week }
}

export function nudge(l: Lesson, delta: number, fallback: number): Lesson {
  if (!hasStart(l)) return l
  const len = lengthOf(l, fallback)
  const s = Math.min(Math.max(toMin(l.start) + delta, 0), 24 * 60 - 5)
  return { ...l, start: addMin('00:00', s), end: addMin('00:00', s + len) }
}

export const sameWeekPossible = (a: Week, b: Week) => a === 'all' || b === 'all' || a === b

const overlaps = (a: Lesson, b: Lesson) =>
  a.id !== b.id && a.day === b.day && hasStart(a) && hasStart(b) && isHHMM(a.end) && isHHMM(b.end) &&
  durationOf(a.start, a.end) > 0 && durationOf(b.start, b.end) > 0 &&
  toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end) && sameWeekPossible(a.week, b.week)

export function conflictMap(lessons: Lesson[]): Map<string, Lesson> {
  const out = new Map<string, Lesson>()
  const sorted = sortLessons(lessons)
  for (const a of sorted) {
    const b = sorted.find((x) => overlaps(a, x))
    if (b) out.set(a.id, b)
  }
  return out
}

export const conflictText = (other: Lesson) =>
  `Перетинається з ${quoted(other.subject.trim() || 'Без назви')} (${fmtRange(other.start, other.end)})`

export const matchesFilter = (l: Lesson, f: WeekFilter) => f === 'both' || l.week === 'all' || l.week === f

export function lanes(dayLessons: Lesson[], fallback: number): Map<string, { lane: number; of: number }> {
  const items = dayLessons
    .filter(hasStart)
    .map((l) => ({ id: l.id, s: toMin(l.start), e: toMin(l.start) + Math.max(lengthOf(l, fallback), 1) }))
    .sort((a, b) => a.s - b.s || b.e - a.e)
  const out = new Map<string, { lane: number; of: number }>()
  let cluster: { id: string; lane: number }[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const close = () => {
    for (const c of cluster) out.set(c.id, { lane: c.lane, of: laneEnds.length })
    cluster = []
    laneEnds = []
  }
  for (const it of items) {
    if (it.s >= clusterEnd && cluster.length) close()
    let lane = laneEnds.findIndex((end) => end <= it.s)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(it.e)
    } else laneEnds[lane] = it.e
    cluster.push({ id: it.id, lane })
    clusterEnd = Math.max(clusterEnd, it.e)
  }
  close()
  return out
}

export function summaryText(lessons: Lesson[]): string {
  if (!lessons.length) return 'Поки порожньо'
  const days = new Set(lessons.map((l) => l.day)).size
  const reminders = lessons.filter((l) => l.remind).length
  return `${pairsCount(lessons.length)} у${NBSP}${daysCount(days)} · з нагадуванням: ${reminders}`
}

export const unsavedText = (n: number) =>
  `${count(n, 'пару', 'пари', 'пар')} без часу початку не збережено`

export const lessonShort = (l: Lesson) =>
  `${l.subject.trim() || 'Без назви'}, ${DAY_SHORT[l.day].toLocaleLowerCase('uk')}${l.start ? ` ${l.start}` : ''}`

export const addInDayLabel = (day: number) => `Додати пару в ${DAY_ACC_BARE[day]}`

export const WEEK_OPTIONS: { value: Week; label: string }[] = [
  { value: 'all', label: 'Щотижня' },
  { value: 'odd', label: 'Чисельник' },
  { value: 'even', label: 'Знаменник' },
]

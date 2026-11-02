import { isoDow } from '@shared/schedule.mjs'

export const NBSP = ' '
export const APOS = '’'

export const pad2 = (n: number) => String(n).padStart(2, '0')

export const DAY_NAMES = ['', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота', 'Неділя'] as const
export const DAY_LOWER = ['', 'понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота', 'неділя'] as const
export const DAY_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] as const
export const DAY_ACC = ['', 'у понеділок', 'у вівторок', 'у середу', 'у четвер', 'у п’ятницю', 'у суботу', 'у неділю'] as const
export const DAY_ACC_BARE = ['', 'понеділок', 'вівторок', 'середу', 'четвер', 'п’ятницю', 'суботу', 'неділю'] as const
export const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'] as const

export const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase('uk') + s.slice(1) : s)
export const quoted = (s: string) => `«${s}»`

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b === 1) return one
  if (b >= 2 && b <= 4) return few
  return many
}

export const count = (n: number, one: string, few: string, many: string) => `${n}${NBSP}${plural(n, one, few, many)}`

export const pairsCount = (n: number) => count(n, 'пара', 'пари', 'пар')
export const daysCount = (n: number) => count(n, 'день', 'дні', 'днів')
export const rowsCount = (n: number) => count(n, 'рядок', 'рядки', 'рядків')
export const regionsCountLoc = (n: number) => count(n, 'регіоні', 'регіонах', 'регіонах')
export const oblastsCount = (n: number) => count(n, 'область', 'області', 'областей')

export const fmtClock = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
export const fmtIsoTime = (iso: string) => fmtClock(new Date(iso))

export function atTime(t: string | Date): string {
  const hhmm = t instanceof Date ? fmtClock(t) : /T/.test(t) ? fmtIsoTime(t) : t
  return `${hhmm.startsWith('11:') ? 'об' : 'о'}${NBSP}${hhmm}`
}

export const sinceTime = (t: string | Date) => `з${NBSP}${t instanceof Date ? fmtClock(t) : /T/.test(t) ? fmtIsoTime(t) : t}`

export const fmtRange = (start: string, end: string) => `${start}–${end}`

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m}${NBSP}хв`
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h >= 24) {
    const d = Math.floor(h / 24)
    const hh = h % 24
    return hh ? `${d}${NBSP}д${NBSP}${hh}${NBSP}год` : `${d}${NBSP}д`
  }
  return r ? `${h}${NBSP}год${NBSP}${r}${NBSP}хв` : `${h}${NBSP}год`
}

export const minutesUntil = (target: Date | number, now: Date | number = Date.now()) =>
  Math.max(0, Math.ceil((+target - +now) / 60_000))

export const minutesSince = (from: Date | number | string, now: Date | number = Date.now()) =>
  Math.max(0, Math.floor((+now - +new Date(from)) / 60_000))

export const inText = (min: number) => `через${NBSP}${fmtDuration(min)}`
export const leftText = (min: number) => `ще${NBSP}${fmtDuration(min)}`

export const fmtDayMonth = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`
export const fmtDateRange = (a: Date, b: Date) => `${fmtDayMonth(a)}–${fmtDayMonth(b)}`
export const fmtDayMonthLong = (d: Date) => `${d.getDate()}${NBSP}${MONTHS_GEN[d.getMonth()]}`
export const fmtLongDate = (d: Date) => `${DAY_NAMES[isoDow(d)]}, ${fmtDayMonthLong(d)}`
export const fmtDayDate = (d: Date) => `${DAY_LOWER[isoDow(d)]}, ${fmtDayMonthLong(d)}`

export function nextWhen(daysAhead: number, date: Date, start: string): string {
  if (daysAhead <= 0) return atTime(start)
  if (daysAhead === 1) return `завтра ${atTime(start)}`
  const dow = isoDow(date)
  if (daysAhead < 7) return `${DAY_ACC[dow]} ${atTime(start)}`
  return `${DAY_ACC[dow]}, ${fmtDayMonthLong(date)}, ${atTime(start)}`
}

export type Service = 'Zoom' | 'Meet' | 'Teams'
export interface LinkInfo {
  service: Service | null
  label: Service | 'Відкрити'
  video: boolean
}

function hostOf(url: string): string {
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

export function linkInfo(url: string | null | undefined): LinkInfo | null {
  const u = String(url || '').trim()
  if (!u) return null
  const host = hostOf(u)
  const service: Service | null = /(^|\.)zoom\.us$/.test(host) || /^zoom(mtg|us):/i.test(u) ? 'Zoom'
    : host === 'meet.google.com' ? 'Meet'
    : /(^|\.)teams\.(microsoft\.com|live\.com)$/.test(host) || /^msteams:/i.test(u) ? 'Teams'
    : null
  return { service, label: service ?? 'Відкрити', video: service !== null }
}

export function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s
  const keep = max - 1
  const head = Math.ceil(keep * 0.6)
  return `${s.slice(0, head)}…${s.slice(s.length - (keep - head))}`
}

export function shortUrl(url: string, max = 40): string {
  const s = String(url || '').trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  return truncateMiddle(s, max)
}

export function joinTooltip(url: string): string {
  const info = linkInfo(url)
  return `${info?.service ? `Відкрити ${info.service}` : 'Відкрити посилання'} · ${shortUrl(url)}`
}

export function joinLabel(subject: string, url: string): string {
  const info = linkInfo(url)
  return info?.service ? `Приєднатися до ${quoted(subject)} у ${info.service}` : `Відкрити посилання для ${quoted(subject)}`
}

export const linkLooksWrong = (url: string) => {
  const u = String(url || '').trim()
  return Boolean(u) && (/\s/.test(u) || !u.includes('.'))
}
export const LINK_WARNING = 'Схоже, це не посилання. Перевірте адресу.'

export const weekName = (t: 'odd' | 'even') => (t === 'odd' ? 'чисельник' : 'знаменник')
export const weekChip = (t: 'odd' | 'even') =>
  t === 'odd' ? { text: 'чис', label: 'лише чисельник' } : { text: 'знам', label: 'лише знаменник' }

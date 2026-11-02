import { pad2 } from './format'

export const toMin = (hhmm: string) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}
export const addMin = (hhmm: string, delta: number) => fromMin(toMin(hhmm) + delta)
export const durationOf = (start: string, end: string) => toMin(end) - toMin(start)
export const nowMin = (d: Date = new Date()) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60

export const isHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

export const TIME_ERROR = 'Час у форматі гг:хх, наприклад 08:30'

function fromParts(h: number, m: number): string | null {
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${pad2(h)}:${pad2(m)}`
}

export function parseTime(raw: string): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  let m = /^(\d{1,2})$/.exec(s)
  if (m) return fromParts(Number(m[1]), 0)
  m = /^(\d{1,2})(\d{2})$/.exec(s)
  if (m) return fromParts(Number(m[1]), Number(m[2]))
  m = /^(\d{1,2})\s*[:.,\s]\s*(\d{2})$/.exec(s)
  if (m) return fromParts(Number(m[1]), Number(m[2]))
  return null
}

export function parseTimeRange(raw: string): { start: string; end: string } | null {
  const s = String(raw ?? '').trim()
  let parts: string[] | null = null
  if (/[-–—]/.test(s)) parts = s.split(/\s*[-–—]+\s*/)
  else {
    const tokens = s.split(/\s+/)
    if (tokens.length === 2 && tokens.every((t) => /^\d{3,4}$/.test(t) || /^\d{1,2}[:.,]\d{2}$/.test(t))) parts = tokens
  }
  if (!parts || parts.length !== 2) return null
  const start = parseTime(parts[0])
  const end = parseTime(parts[1])
  return start && end ? { start, end } : null
}

export function stepTime(hhmm: string, dir: 1 | -1, step = 5): string {
  const t = toMin(hhmm)
  if (step !== 5) return fromMin(t + dir * step)
  const r = t % 5
  if (r === 0) return fromMin(t + dir * 5)
  return fromMin(dir > 0 ? t + (5 - r) : t - r)
}

export function moveStartKeepLength(start: string, end: string, newStart: string, defaultDuration: number) {
  const len = isHHMM(start) && isHHMM(end) && durationOf(start, end) > 0 ? durationOf(start, end) : defaultDuration
  return { start: newStart, end: addMin(newStart, len) }
}

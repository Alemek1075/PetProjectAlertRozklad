export const subjectKey = (subject: string) => String(subject ?? '').trim().toLocaleLowerCase('uk').replace(/\s+/g, ' ')

const UNNAMED = 'без назви'

export function subjectIndex(subject: string, colors: Record<string, number> | undefined): number {
  const key = subjectKey(subject)
  if (!key || key === UNNAMED) return 10
  const n = colors?.[key]
  return Number.isInteger(n) && n! >= 1 && n! <= 10 ? n! : 10
}

export const SUBJECT_COLOR_NAMES = ['', 'небесний', 'теракотовий', 'бірюзовий', 'сливовий', 'оливковий', 'фіалковий', 'пісочний', 'рожевий', 'трав’яний', 'сірий'] as const

export const SUBJECT_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function subjectStats(lessons: { subject: string }[]): { subject: string; key: string; count: number }[] {
  const map = new Map<string, { subject: string; key: string; count: number }>()
  for (const l of lessons) {
    const key = subjectKey(l.subject)
    if (!key || key === UNNAMED) continue
    const e = map.get(key)
    if (e) e.count++
    else map.set(key, { subject: l.subject.trim(), key, count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject, 'uk'))
}

import { CloudOff, Hourglass, KeyRound, WifiOff, type LucideIcon } from 'lucide-react'
import type { AlertLevel, Alerts, EditorTarget, FocusAlert, LastClear, RegionState } from './api'
import { NBSP, atTime, fmtDuration, fmtIsoTime, minutesSince, regionsCountLoc, sinceTime } from './format'

export const CLEAR_BAND_MIN = 10
export const CLEAR_LINE_MIN = 60
export const STALE_MIN = 3

export const TYPE_TITLES: Record<string, string> = {
  air_raid: 'Повітряна тривога',
  artillery_shelling: 'Загроза артобстрілу',
  urban_fights: 'Загроза вуличних боїв',
  chemical: 'Хімічна загроза',
  nuclear: 'Радіаційна загроза',
}

export const THREAT_LABELS: Record<string, string> = {
  tactic_aircraft_activity: 'тактична авіація',
  strategic_aircraft_activity: 'стратегічна авіація',
  mig31k_departure: 'зліт МіГ-31К',
  ballistic_missiles: 'балістика',
  cruise_missiles: 'крилаті ракети',
  unspecified_missiles: 'ракети',
  drones: 'ударні дрони',
  guided_aerial_bombs: 'КАБи',
  air_defense: 'робота ППО',
  unknown: 'невідома загроза',
}

export const CITIES = ['м. Київ', 'м. Севастополь'] as const
export const OBLASTS = [
  'Автономна Республіка Крим', 'Вінницька область', 'Волинська область', 'Дніпропетровська область',
  'Донецька область', 'Житомирська область', 'Закарпатська область', 'Запорізька область',
  'Івано-Франківська область', 'Київська область', 'Кіровоградська область', 'Луганська область',
  'Львівська область', 'Миколаївська область', 'Одеська область', 'Полтавська область', 'Рівненська область',
  'Сумська область', 'Тернопільська область', 'Харківська область', 'Херсонська область',
  'Хмельницька область', 'Черкаська область', 'Чернівецька область', 'Чернігівська область',
].sort((a, b) => a.localeCompare(b, 'uk'))
export const REGIONS: readonly string[] = [...CITIES, ...OBLASTS]

export const isCity = (name: string) => name.startsWith('м. ')

export function shortRegion(name: string): string {
  if (name === 'Автономна Республіка Крим') return 'АР Крим'
  if (isCity(name)) return name.slice(3)
  return name.replace(/ область$/, '')
}

export const sortRegions = (names: string[]) =>
  [...names].sort((a, b) => Number(isCity(b)) - Number(isCity(a)) || a.localeCompare(b, 'uk'))

export function whereText(region: string): string {
  if (region === 'м. Київ') return 'у Києві'
  if (region === 'м. Севастополь') return 'у Севастополі'
  return `— ${region}`
}

export function withWhere(title: string, region: string): string {
  const w = whereText(region)
  return w.startsWith('—') ? `${title}${NBSP}${w}` : `${title} ${w}`
}

export function quietTitle(region: string): string {
  if (region === 'м. Київ') return 'У Києві тривоги немає'
  if (region === 'м. Севастополь') return 'У Севастополі тривоги немає'
  return `${region}: тривоги немає`
}

export function alertTitle(focus: FocusAlert): string {
  const types = focus.types ?? []
  const main = !types.length || types.includes('air_raid') ? 'air_raid' : types[0]
  return withWhere(TYPE_TITLES[main] ?? TYPE_TITLES.air_raid, focus.name)
}

export function otherTypesText(focus: FocusAlert): string {
  const types = focus.types ?? []
  const main = !types.length || types.includes('air_raid') ? 'air_raid' : types[0]
  return types.filter((t) => t !== main).map((t) => (TYPE_TITLES[t] ?? t).toLocaleLowerCase('uk')).join(', ')
}

export const threatsText = (threats: string[] | undefined) =>
  (threats ?? []).map((t) => THREAT_LABELS[t] ?? THREAT_LABELS.unknown).filter((v, i, a) => a.indexOf(v) === i).join(', ')

export const levelWord = (level: AlertLevel) => (level === 'red' ? 'Червоний рівень' : 'Жовтий рівень')
export const levelAdj = (level: AlertLevel) => (level === 'red' ? 'червона' : 'жовта')

export function alertMeta(focus: FocusAlert, now: Date = new Date()) {
  return {
    level: levelWord(focus.level ?? 'red'),
    since: focus.startedAt ? sinceTime(focus.startedAt) : '',
    lasting: focus.startedAt ? `триває${NBSP}${fmtDuration(minutesSince(focus.startedAt, now))}` : '',
  }
}

export function placesSummary(places: string[] | undefined, max = 2): { text: string; full: string } {
  const list = places ?? []
  const short = list.slice(0, max).map((p) => p.replace(/ район$/, ' р-н').replace(/ територіальна громада$/, ' громада'))
  const rest = list.length - short.length
  return {
    text: short.join(', ') + (rest > 0 ? ` і${NBSP}ще${NBSP}${rest}` : ''),
    full: list.join(', '),
  }
}

export const announceText = (focus: FocusAlert) => `${alertTitle(focus)}, ${levelWord(focus.level ?? 'red').toLocaleLowerCase('uk')}`

export const alertShort = (focus: FocusAlert, now: Date = new Date()) =>
  `${alertTitle(focus)}${focus.startedAt ? ` · ${fmtDuration(minutesSince(focus.startedAt, now))}` : ''}`

export const clearTitle = (region: string) => withWhere('Відбій тривоги', region)

export const clearAge = (lastClear: LastClear | null | undefined, now: Date = new Date()) =>
  lastClear ? minutesSince(lastClear.endedAt, now) : null

const clearDuration = (c: LastClear) => fmtDuration(Math.round((+new Date(c.endedAt) - +new Date(c.startedAt)) / 60_000))

export const clearBandMeta = (c: LastClear) => `${atTime(c.endedAt)} · тривала ${clearDuration(c)}`
export const clearLine = (c: LastClear) => `Відбій ${atTime(c.endedAt)} · тривала ${clearDuration(c)}`

export const updatedText = (iso: string) => `оновлено ${atTime(iso)}`
export const staleQuietLine = (iso: string) => `Дані від ${fmtIsoTime(iso)} · оновлюємо…`
export const staleBandLine = (iso: string) => `Дані від ${fmtIsoTime(iso)} могли змінитися`
export const isStale = (alerts: Alerts, now: Date = new Date()) =>
  alerts.status === 'ok' && !!alerts.updatedAt && minutesSince(alerts.updatedAt, now) > STALE_MIN

export interface ErrorCopy {
  icon: LucideIcon
  title: string
  detail: string
  action: { label: string; target: EditorTarget } | { label: string; retry: true } | null
}

export function errorCopy(alerts: Alerts): ErrorCopy {
  const last = alerts.updatedAt ? `Останні дані ${atTime(alerts.updatedAt)}` : 'Даних ще не було'
  const retryLine = `${last} · повтор кожні 30${NBSP}с`
  switch (alerts.errorCode) {
    case 'no-token':
      return { icon: KeyRound, title: 'Тривоги не відстежуються', detail: 'Потрібен токен alerts.in.ua', action: { label: 'Додати токен', target: 'settings/token' } }
    case 'bad-token':
      return { icon: KeyRound, title: 'Токен alerts.in.ua не прийнято', detail: 'Перевірте його в налаштуваннях', action: { label: 'Налаштування', target: 'settings/token' } }
    case 'forbidden':
      return { icon: KeyRound, title: 'Доступ до alerts.in.ua заборонено', detail: 'Можливо, токен відкликано', action: { label: 'Налаштування', target: 'settings/token' } }
    case 'rate-limit':
      return { icon: Hourglass, title: 'Забагато запитів до alerts.in.ua', detail: 'Спробуємо знову за хвилину', action: null }
    case 'api':
      return {
        icon: CloudOff,
        title: alerts.errorStatus ? `alerts.in.ua не відповідає (помилка ${alerts.errorStatus})` : 'alerts.in.ua не відповідає',
        detail: retryLine,
        action: { label: 'Повторити', retry: true },
      }
    case 'network':
    default:
      return { icon: WifiOff, title: 'Немає зв’язку з alerts.in.ua', detail: retryLine, action: { label: 'Повторити', retry: true } }
  }
}

export type StatusKind = 'loading' | 'alert' | 'alert-stale' | 'clear-band' | 'error' | 'quiet'

export function statusKind(alerts: Alerts, now: Date = new Date()): StatusKind {
  if (alerts.status === 'loading') return 'loading'
  if (alerts.focus?.active) return alerts.status === 'error' ? 'alert-stale' : 'alert'
  const age = clearAge(alerts.lastClear, now)
  if (age !== null && age < CLEAR_BAND_MIN) return 'clear-band'
  if (alerts.status === 'error') return 'error'
  return 'quiet'
}

export function regionsAlertText(regions: Record<string, RegionState>): string {
  const n = Object.keys(regions).length
  return n ? `тривога в${NBSP}${regionsCountLoc(n)}` : 'тривог немає'
}

export function regionReadout(name: string, st: RegionState | undefined): string {
  if (!st) return `${name} · тривоги немає`
  return `${name} · ${levelAdj(st.level)}${st.full ? '' : ', частково'}`
}

export function regionListLines(regions: Record<string, RegionState>): { level: AlertLevel; label: string; names: string }[] {
  const out: { level: AlertLevel; label: string; names: string }[] = []
  for (const level of ['red', 'yellow'] as const) {
    const names = sortRegions(Object.keys(regions).filter((n) => regions[n].level === level))
    if (!names.length) continue
    out.push({
      level,
      label: level === 'red' ? 'Червона' : 'Жовта',
      names: names.map((n) => `${shortRegion(n)}${regions[n].full ? '' : `${NBSP}(частково)`}`).join(', '),
    })
  }
  return out
}

export function mapAriaLabel(regions: Record<string, RegionState>, focusName: string): string {
  const st = regions[focusName]
  const where = isCity(focusName) ? whereText(focusName) : `${focusName}:`
  const focusPart = st ? `${where} ${levelAdj(st.level)}${st.full ? '' : ', частково'}` : `${where} тривоги немає`
  return `Мапа тривог: ${regionsAlertText(regions)}, ${focusPart}`
}

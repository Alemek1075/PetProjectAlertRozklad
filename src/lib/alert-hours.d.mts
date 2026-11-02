export type AlertHoursMode = 'all' | 'off' | 'hours'

export interface AlertHoursRange {
  start: string
  end: string
}

export interface AlertHoursDay {
  mode: AlertHoursMode
  ranges: AlertHoursRange[]
}

export interface AlertHours {
  enabled: boolean
  days: AlertHoursDay[]
}

export function defaultAlertHours(): AlertHours
export function normalizeAlertHours(v: unknown): AlertHours
export function alertHoursOpen(ah: AlertHours | null | undefined, now?: Date): boolean

import { useSyncExternalStore } from 'react'

let now = new Date()
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  now = new Date()
  for (const l of listeners) l()
}

function schedule() {
  clearTimeout(timer)
  const d = new Date()
  const ms = 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50
  timer = setTimeout(() => {
    emit()
    schedule()
  }, ms)
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (listeners.size === 1) {
    now = new Date()
    schedule()
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size) clearTimeout(timer)
  }
}

const getSnapshot = () => now

export function useMinute(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function tickNow() {
  emit()
  if (listeners.size) schedule()
}

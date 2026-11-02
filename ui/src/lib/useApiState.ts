import { useCallback, useEffect, useRef, useState } from 'react'
import type { State } from './api'

let selfPromise: Promise<number> | null = null
export const whoami = () => (selfPromise ??= window.api.whoami())

export interface ApiStateOptions {
  acceptLessons?: (origin: number | null, self: number | null) => boolean
}

export interface ApiState {
  state: State | null
  self: number | null
  apply: (next: State) => void
}

const defaultAccept = (origin: number | null, self: number | null) => origin === null || origin !== self

export function useApiState(opts: ApiStateOptions = {}): ApiState {
  const [state, setState] = useState<State | null>(null)
  const [self, setSelf] = useState<number | null>(null)
  const selfRef = useRef<number | null>(null)
  const acceptRef = useRef(opts.acceptLessons ?? defaultAccept)
  acceptRef.current = opts.acceptLessons ?? defaultAccept

  useEffect(() => {
    if (!window.api) return
    let alive = true
    let pushed = false
    whoami().then((id) => {
      if (!alive) return
      selfRef.current = id
      setSelf(id)
    })
    const off = window.api.onState((next, origin) => {
      pushed = true
      setState((prev) => {
        if (!prev || acceptRef.current(origin ?? null, selfRef.current)) return next
        return { ...next, lessons: prev.lessons }
      })
    })
    window.api.getState().then((s) => {
      if (alive && !pushed) setState(s)
    })
    return () => {
      alive = false
      off?.()
    }
  }, [])

  const apply = useCallback((next: State) => setState(next), [])
  return { state, self, apply }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorTarget } from '@/lib/api'

export type Tab = 'schedule' | 'alert-hours' | 'settings'
export type View = 'grid' | 'list'
export type SettingsSection = 'reminders' | 'weeks' | 'alerts' | 'general' | 'csv' | 'token'

export interface Route {
  tab: Tab
  view: View
  section: SettingsSection | null
  nonce: number
}

const VIEW_KEY = 'editor.view'
const SECTIONS: SettingsSection[] = ['reminders', 'weeks', 'alerts', 'general', 'csv', 'token']

function storedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}
function storeView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
  }
}

function parse(hash: string, fallbackView: View, nonce: number): Route {
  const h = hash.replace(/^#\/?/, '')
  const [head, sub] = h.split('/')
  if (head === 'settings') {
    const section = SECTIONS.includes(sub as SettingsSection) ? (sub as SettingsSection) : null
    return { tab: 'settings', view: fallbackView, section, nonce }
  }
  if (head === 'alert-hours') return { tab: 'alert-hours', view: fallbackView, section: null, nonce }
  if (head === 'schedule') return { tab: 'schedule', view: sub === 'list' ? 'list' : 'grid', section: null, nonce }
  return { tab: 'schedule', view: fallbackView, section: null, nonce }
}

export function useRoute(onImport: () => void) {
  const nonce = useRef(0)
  const [route, setRoute] = useState<Route>(() => parse(location.hash, storedView(), 0))
  const viewRef = useRef<View>(route.view)
  const importRef = useRef(onImport)
  importRef.current = onImport

  const handle = useCallback((hash: string) => {
    const r = parse(hash, viewRef.current, ++nonce.current)
    if (r.tab === 'schedule') {
      viewRef.current = r.view
      storeView(r.view)
    }
    setRoute(r)
  }, [])

  const go = useCallback(
    (target: EditorTarget | string) => {
      if (target === 'import') {
        go(viewRef.current === 'list' ? 'schedule/list' : 'schedule')
        importRef.current()
        return
      }
      const hash = `#${target}`
      if (location.hash === hash) handle(hash)
      else location.hash = hash
    },
    [handle],
  )

  useEffect(() => {
    if (location.hash === '#import') go('import')
  }, [go])

  useEffect(() => {
    const onHash = () => handle(location.hash)
    window.addEventListener('hashchange', onHash)
    const off = window.api?.onNavigate?.((t) => go(t))
    return () => {
      window.removeEventListener('hashchange', onHash)
      off?.()
    }
  }, [handle, go])

  const goSchedule = useCallback(() => go(viewRef.current === 'list' ? 'schedule/list' : 'schedule'), [go])
  const setView = useCallback((v: View) => go(v === 'list' ? 'schedule/list' : 'schedule'), [go])

  return { route, go, goSchedule, setView }
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { ScrollBar } from '@/components/ui/scroll-area'
import type { Lesson } from '@/lib/api'
import { announceText } from '@/lib/alerts-copy'
import { dayFromCode, hasModifier } from '@/lib/keys'
import { POPUP_SLIDE, appear, spring } from '@/lib/motion'
import { playSound } from '@/lib/sound'
import { useApiState } from '@/lib/useApiState'
import { tickNow, useMinute } from '@/lib/useMinute'
import { AlertStatus } from './AlertStatus'
import { DayPicker } from './DayPicker'
import { EmptySchedule } from './EmptySchedule'
import { FocusLesson, focusInfo } from './FocusLesson'
import { Header } from './Header'
import { MapSection } from './MapSection'
import { Timeline } from './Timeline'
import { WeekSwitch } from './WeekSwitch'
import { buildWeek, hasAlternation, isoDow, nextDayWithLessons, upcoming, weekType, type WeekOffset } from './schedule'
import { naturalHeight, useReportHeight } from './useReportHeight'

const MAP_OPEN_EXTRA = 326
const GAP_SCREEN_MIN = 760
const maxH = () => window.screen.availHeight - 24

export function App() {
  const { state, apply } = useApiState()
  const now = useMinute()
  const reduced = useReducedMotion()

  const rootRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const reportNow = useReportHeight(headerRef, contentRef)

  const settings = state?.settings
  const alerts = state?.alerts ?? null
  const lessons = state?.lessons
  const inAlert = !!alerts?.focus.active

  const [view, setView] = useState<{ offset: WeekOffset; dow: number }>(() => ({ offset: 0, dow: isoDow(new Date()) }))
  const alternation = !!lessons && hasAlternation(lessons)
  const offset: WeekOffset = alternation ? view.offset : 0

  const weeks = useMemo(() => {
    if (!lessons || !settings) return null
    const w0 = buildWeek(lessons, settings.weekAnchor, now, 0)
    return alternation ? [w0, buildWeek(lessons, settings.weekAnchor, now, 1)] : [w0]
  }, [lessons, settings, now, alternation])
  const week = weeks?.[offset] ?? null

  const [remindOverride, setRemindOverride] = useState<Record<string, boolean>>({})
  useEffect(() => setRemindOverride({}), [lessons])
  const remindOf = useCallback((l: Lesson) => remindOverride[l.id] ?? l.remind, [remindOverride])
  const onRemind = useCallback((l: Lesson, next: boolean) => {
    setRemindOverride((o) => ({ ...o, [l.id]: next }))
    window.api.setRemind(l.id, next).catch(() =>
      setRemindOverride((o) => {
        const rest = { ...o }
        delete rest[l.id]
        return rest
      }),
    )
  }, [])

  const [retrying, setRetrying] = useState(false)
  useEffect(() => setRetrying(false), [alerts])
  const retry = useCallback(() => {
    setRetrying(true)
    window.api.refreshAlerts().finally(() => setRetrying(false))
  }, [])

  const [quietOpen, setQuietOpen] = useState(false)
  useEffect(() => setQuietOpen(!!settings?.showMap), [settings?.showMap])
  const [alertOpen, setAlertOpen] = useState<boolean | 'pending'>('pending')
  const [listOpen, setListOpen] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)
  const mapOpen = inAlert ? alertOpen === true : quietOpen

  const wasAlert = useRef(false)
  useLayoutEffect(() => {
    const started = inAlert && !wasAlert.current
    wasAlert.current = inAlert
    if (started) setPulseKey((k) => k + 1)
    if (!inAlert) return
    if (started && alertOpen !== 'pending') {
      setAlertOpen('pending')
      return
    }
    if (alertOpen === 'pending') {
      const mapBody = contentRef.current?.querySelector<HTMLElement>('[data-map-body]')
      const collapsed = naturalHeight(headerRef.current, contentRef.current) - (mapBody?.offsetHeight ?? 0)
      setAlertOpen(collapsed + MAP_OPEN_EXTRA <= maxH())
    }
  }, [inAlert, alertOpen])

  const setMapOpen = useCallback(
    (open: boolean) => {
      if (inAlert) {
        setAlertOpen(open)
        return
      }
      setQuietOpen(open)
      window.api.saveSettings({ showMap: open }).then(apply, () => setQuietOpen(!open))
    },
    [inAlert, apply],
  )

  const visible = useRef(document.visibilityState === 'visible')
  const [announce, setAnnounce] = useState('')
  const inAlertRef = useRef(inAlert)
  inAlertRef.current = inAlert

  useLayoutEffect(() => {
    const el = shellRef.current
    if (!el) return
    if (document.visibilityState === 'hidden') el.style.opacity = '0'
    let t: ReturnType<typeof setTimeout> | undefined
    const onVis = () => {
      clearTimeout(t)
      if (document.visibilityState === 'visible') t = setTimeout(() => el.style.opacity === '0' && (el.style.opacity = '1'), 400)
    }
    document.addEventListener('visibilitychange', onVis)
    onVis()
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const offs = [
      window.api.onPlaySound(playSound),
      window.api.onShown(() => {
        visible.current = true
        tickNow()
        rootRef.current?.focus({ preventScroll: true })
        if (inAlertRef.current) setPulseKey((k) => k + 1)
        const el = shellRef.current
        if (el) {
          const scr = window.screen as Screen & { availTop?: number }
          const fromBelow = window.screenY + window.innerHeight / 2 > (scr.availTop ?? 0) + scr.availHeight / 2
          if (reducedRef.current) animate(el, { opacity: [0, 1] }, { duration: 0.08 })
          else if (!POPUP_SLIDE) animate(el, { opacity: [0, 1] }, { duration: 0.12 })
          else animate(el, { opacity: [0, 1], y: [fromBelow ? 6 : -6, 0] }, { y: spring.enter, opacity: { duration: 0.12 } })
        }
      }),
      window.api.onHidden(() => {
        visible.current = false
        setView({ offset: 0, dow: isoDow(new Date()) })
        setListOpen(false)
        setAlertOpen('pending')
        setAnnounce('')
        if (viewportRef.current) viewportRef.current.scrollTop = 0
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        document.dispatchEvent(new globalThis.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        if (shellRef.current) shellRef.current.style.opacity = '0'
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [])
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  useLayoutEffect(() => {
    if (!visible.current) reportNow()
  })

  const prevActive = useRef<boolean | null>(null)
  useEffect(() => {
    if (!alerts) return
    if (prevActive.current === false && inAlert && visible.current) setAnnounce(announceText(alerts.focus))
    prevActive.current = inAlert
  }, [inAlert, alerts])

  const today = weeks?.[0].days[isoDow(now) - 1] ?? null
  const up = lessons && settings ? upcoming(lessons, settings.weekAnchor, now) : null
  const focus = today ? focusInfo(up, today.lessons, now) : null
  const showGaps = !inAlert && window.screen.availHeight >= GAP_SCREEN_MIN
  const empty = !!lessons && lessons.length === 0
  const jump = weeks && week ? nextDayWithLessons(weeks, { offset, dow: view.dow }) : null
  const realWeek = alternation && settings ? weekType(now, settings.weekAnchor) : null

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (hasModifier(e)) return
    const code = e.code
    const done = () => {
      e.preventDefault()
      e.stopPropagation()
    }
    if (code === 'Escape') {
      done()
      window.api.hidePopup()
      return
    }
    if (e.shiftKey) return
    const day = dayFromCode(code)
    if (day) {
      if (empty) return
      done()
      setView((v) => ({ ...v, dow: day }))
      return
    }
    switch (code) {
      case 'KeyT':
        done()
        setView({ offset: 0, dow: isoDow(now) })
        break
      case 'KeyW':
        if (!alternation) return
        done()
        setView((v) => ({ ...v, offset: v.offset === 0 ? 1 : 0 }))
        break
      case 'KeyJ':
        done()
        if (focus?.due && focus.up.lesson.link) window.api.openLink(focus.up.lesson.link)
        break
      case 'KeyM':
        if (!alerts?.updatedAt) return
        done()
        setMapOpen(!mapOpen)
        break
      case 'KeyR':
      case 'F5':
        done()
        retry()
        break
      case 'KeyE':
        done()
        window.api.openEditor()
        break
    }
  }

  return (
    <main
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ outline: 'none' }}
      className="flyout flex max-h-screen flex-col overflow-hidden outline-none select-none"
    >
      <div ref={shellRef} className="flex min-h-0 flex-1 flex-col">
        <Header ref={headerRef} now={now} week={realWeek} />
        <ScrollAreaPrimitive.Root type="scroll" className="relative min-h-0 flex-1 overflow-hidden">
          <ScrollAreaPrimitive.Viewport
            ref={viewportRef}
            className="max-h-[calc(100vh-40px)] w-full [&>div]:!block"
          >
            <div ref={contentRef}>
              <AlertStatus alerts={alerts} now={now} retry={{ retrying, retry }} />

              {settings && focus && !empty ? (
                <FocusLesson info={focus} now={now} settings={settings} remindOf={remindOf} onRemind={onRemind} />
              ) : null}

              {alerts?.updatedAt ? (
                <MapSection
                  alerts={alerts}
                  open={mapOpen}
                  onOpenChange={setMapOpen}
                  listOpen={listOpen}
                  onListOpenChange={setListOpen}
                  pulseKey={pulseKey}
                />
              ) : null}

              {empty ? (
                <EmptySchedule />
              ) : week && settings && weeks ? (
                <>
                  {alternation ? (
                    <WeekSwitch week={week} onChange={(o) => setView((v) => ({ ...v, offset: o }))} />
                  ) : null}
                  <div className={alternation ? '' : 'pt-2'}>
                    <DayPicker week={week} selected={view.dow} onSelect={(dow) => setView((v) => ({ ...v, dow }))} />
                  </div>
                  <Timeline
                    week={week}
                    selected={view.dow}
                    now={now}
                    showGaps={showGaps}
                    settings={settings}
                    remindOf={remindOf}
                    onRemind={onRemind}
                    jump={jump}
                    onJump={(t) => setView({ offset: t.offset, dow: t.day.dow })}
                  />
                </>
              ) : null}
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollBar />
        </ScrollAreaPrimitive.Root>
      </div>
      <div className="sr-only" aria-live="assertive">
        <AnimatePresence>{announce ? <motion.span key={announce} {...appear}>{announce}</motion.span> : null}</AnimatePresence>
      </div>
    </main>
  )
}

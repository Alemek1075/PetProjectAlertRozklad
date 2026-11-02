import { Check, CircleX, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { LevelIcon } from '@/components/app/LevelIcon'
import { Spin } from '@/components/app/Spin'
import { Tip } from '@/components/app/Tip'
import { Button } from '@/components/ui/button'
import { alertShort, clearTitle, errorCopy, quietTitle, statusKind } from '@/lib/alerts-copy'
import { weekName } from '@/lib/format'
import { iconSwap, tween } from '@/lib/motion'
import { useMinute } from '@/lib/useMinute'
import { cn } from '@/lib/utils'
import { useEditor } from './context'
import { hasStart, summaryText, unsavedText } from './lessons'

const LEVEL_TEXT = { red: 'text-alert-red-foreground', yellow: 'text-alert-yellow-foreground' } as const

function SaveState() {
  const { ctl } = useEditor()
  const s = ctl.status
  return (
    <span aria-live="polite" className="flex min-w-0 items-center">
      <AnimatePresence mode="wait" initial={false}>
        {s === 'pending' ? (
          <motion.span key="p" className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: tween.fadeOut }}>
            <Spin className="size-3" />
            Збереження…
          </motion.span>
        ) : s === 'saved' ? (
          <motion.span key="s" className="flex items-center gap-1.5" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
            <motion.span {...iconSwap} className="flex">
              <Check className="size-3" aria-hidden />
            </motion.span>
            Збережено
          </motion.span>
        ) : s === 'error' ? (
          <motion.span key="e" className="flex items-center gap-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CircleX className="size-3 text-destructive" aria-hidden />
            Не збережено
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  )
}

function AlertMini() {
  const { alerts, settings, go } = useEditor()
  const now = useMinute()
  const kind = statusKind(alerts, now)
  let body
  if (kind === 'loading') {
    body = (
      <>
        <Spin className="size-3.5" />
        Завантаження…
      </>
    )
  } else if (kind === 'alert' || kind === 'alert-stale') {
    const level = alerts.focus.level ?? 'red'
    body = (
      <span className={cn('flex items-center gap-1.5', LEVEL_TEXT[level])}>
        <LevelIcon level={level} size={14} />
        <span className="truncate">{alertShort(alerts.focus, now)}</span>
      </span>
    )
  } else if (kind === 'error') {
    const c = errorCopy(alerts)
    const Icon = c.icon
    body = (
      <>
        <Icon className="size-3.5" aria-hidden />
        <span className="truncate">{c.title}</span>
      </>
    )
  } else {
    body = (
      <>
        <ShieldCheck className="size-3.5 text-alert-clear" aria-hidden />
        <span className="truncate">{kind === 'clear-band' ? clearTitle(settings.region) : quietTitle(settings.region)}</span>
      </>
    )
  }
  return (
    <Tip label="Налаштування тривог" side="top" align="end">
      <Button
        variant="ghost"
        size="xs"
        className="-mr-2 min-w-0 gap-1.5 font-normal text-muted-foreground"
        onClick={() => go('settings/alerts')}
      >
        {body}
      </Button>
    </Tip>
  )
}

export function StatusBar() {
  const { lessons, alternation, thisWeek } = useEditor()
  const unsaved = lessons.filter((l) => !hasStart(l)).length
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t bg-sidebar px-4 text-caption text-muted-foreground">
      <span className="min-w-0 truncate tabular-nums">
        {summaryText(lessons)}
        {unsaved ? <span className="text-destructive"> · {unsavedText(unsaved)}</span> : null}
      </span>
      {alternation ? <span className="shrink-0">Цей тиждень: {weekName(thisWeek)}</span> : null}
      <span className="flex-1" />
      <SaveState />
      <span aria-hidden className="h-3 w-px shrink-0 bg-border" />
      <AlertMini />
    </footer>
  )
}

import { AnimatePresence, motion } from 'motion/react'
import { Bell, BellRing } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Tip } from '@/components/app/Tip'
import { fmtDuration } from '@/lib/format'
import { iconSwap } from '@/lib/motion'
import type { Settings } from '@/lib/api'
import { cn } from '@/lib/utils'

export function bellTooltip(on: boolean, settings: Pick<Settings, 'remindBefore' | 'remindAtStart'>): string {
  const before = settings.remindBefore > 0
  const atStart = settings.remindAtStart
  if (!before && !atStart) return 'Нагадування вимкнені в налаштуваннях'
  if (!on) return 'Нагадати про початок'
  if (before && atStart) return `Нагадування за ${fmtDuration(settings.remindBefore)} і на початку пари`
  if (before) return `Нагадування за ${fmtDuration(settings.remindBefore)}`
  return 'Нагадування на початку пари'
}

export function BellToggle({
  on,
  subject,
  settings,
  onToggle,
  className,
}: {
  on: boolean
  subject: string
  settings: Pick<Settings, 'remindBefore' | 'remindAtStart'>
  onToggle: (next: boolean) => void
  className?: string
}) {
  return (
    <Tip label={bellTooltip(on, settings)} side="bottom" align="end">
      <Toggle
        size="sm"
        pressed={on}
        onPressedChange={onToggle}
        aria-label={`Нагадування: ${subject}`}
        className={cn(
          'size-7 min-w-7 px-0 text-muted-foreground hover:bg-accent hover:text-foreground',
          'data-[state=on]:bg-transparent aria-pressed:bg-transparent data-[state=on]:hover:bg-accent',
          className,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={on ? 'on' : 'off'} className="inline-flex" {...iconSwap}>
            {on ? <BellRing aria-hidden className="size-4 text-primary" /> : <Bell aria-hidden className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </Toggle>
    </Tip>
  )
}

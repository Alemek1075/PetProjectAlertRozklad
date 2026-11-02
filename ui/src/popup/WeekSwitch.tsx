import { AnimatePresence, motion } from 'motion/react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fmtDateRange, weekName } from '@/lib/format'
import { spring, tween } from '@/lib/motion'
import type { WeekInfo, WeekOffset } from './schedule'

const TRIGGER =
  'relative isolate h-full flex-none px-2 text-caption font-medium text-muted-foreground hover:text-foreground ' +
  'data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none ' +
  'data-active:bg-transparent data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent ' +
  'dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent'

export function WeekSwitch({ week, onChange }: { week: WeekInfo; onChange: (offset: WeekOffset) => void }) {
  const value = week.offset === 0 ? 'this' : 'next'
  const label = `${weekName(week.type)}, ${fmtDateRange(week.monday, week.sunday)}`
  return (
    <div className="flex h-9 items-center justify-between gap-2 px-3">
      <Tabs value={value} onValueChange={(v) => onChange(v === 'next' ? 1 : 0)} className="gap-0">
        <TabsList aria-label="Тиждень" className="h-7 p-0.5">
          {(['this', 'next'] as const).map((v) => (
            <TabsTrigger key={v} value={v} className={TRIGGER} aria-keyshortcuts="W">
              {value === v ? (
                <motion.span
                  layoutId="week-pill"
                  transition={spring.snappy}
                  className="absolute inset-0 -z-10 rounded-md bg-background ring-1 ring-border dark:bg-accent"
                />
              ) : null}
              {v === 'this' ? 'Цей тиждень' : 'Наступний'}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <span className="relative min-w-0 truncate text-right text-caption text-muted-foreground tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={label}
            className="inline-block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: tween.fade }}
            exit={{ opacity: 0, transition: tween.fadeOut }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  )
}

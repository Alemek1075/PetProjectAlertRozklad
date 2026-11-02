import { motion } from 'motion/react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tip } from '@/components/app/Tip'
import { DAY_SHORT, fmtLongDate, pairsCount } from '@/lib/format'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { WeekInfo } from './schedule'

const ITEM =
  'relative isolate h-12 min-w-0 flex-col gap-0.5 px-0 font-normal ' +
  'group-data-[spacing=0]/toggle-group:rounded-lg group-data-[spacing=0]/toggle-group:px-0 ' +
  'data-[state=on]:bg-transparent aria-pressed:bg-transparent hover:bg-accent aria-checked:hover:bg-transparent'

export function DayPicker({ week, selected, onSelect }: { week: WeekInfo; selected: number; onSelect: (dow: number) => void }) {
  return (
    <ToggleGroup
      type="single"
      spacing={0}
      value={String(selected)}
      onValueChange={(v) => v && onSelect(Number(v))}
      aria-label="День тижня"
      className="grid h-[52px] w-full grid-cols-7 items-start px-3"
    >
      {week.days.map((d) => {
        const n = d.lessons.length
        const today = d.isToday && week.offset === 0
        const label = `${fmtLongDate(d.date)}, ${n ? pairsCount(n) : 'пар немає'}`
        return (
          <Tip key={d.iso} label={`${fmtLongDate(d.date)} · ${n ? pairsCount(n) : 'пар немає'}`} side="bottom">
            <ToggleGroupItem
              value={String(d.dow)}
              aria-label={label}
              aria-current={today ? 'date' : undefined}
              onFocus={() => d.dow !== selected && onSelect(d.dow)}
              className={ITEM}
            >
              {d.dow === selected ? (
                <motion.span
                  layoutId="day-pill"
                  transition={spring.snappy}
                  className="absolute inset-0 -z-10 rounded-lg bg-secondary ring-1 ring-border dark:ring-input"
                />
              ) : null}
              <span className={cn('text-micro', today ? 'text-primary' : 'text-muted-foreground')}>{DAY_SHORT[d.dow]}</span>
              <span
                className={cn(
                  'flex size-[22px] items-center justify-center rounded-full tabular-nums',
                  'text-subject-title',
                  today ? 'bg-primary text-primary-foreground' : n ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {d.date.getDate()}
              </span>
              <span aria-hidden className={cn('size-1 rounded-full', n ? 'bg-faint' : 'bg-transparent')} />
            </ToggleGroupItem>
          </Tip>
        )
      })}
    </ToggleGroup>
  )
}

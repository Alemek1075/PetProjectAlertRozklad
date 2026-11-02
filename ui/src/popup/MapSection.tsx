import { useCallback, useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HatchSwatch } from '@/components/app/HatchSwatch'
import { LevelIcon } from '@/components/app/LevelIcon'
import type { Alerts } from '@/lib/api'
import { regionReadout, regionListLines, regionsAlertText, updatedText } from '@/lib/alerts-copy'
import { appear } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { UaMap } from './UaMap'

export function MapSection({
  alerts,
  open,
  onOpenChange,
  listOpen,
  onListOpenChange,
  pulseKey,
}: {
  alerts: Alerts
  open: boolean
  onOpenChange: (open: boolean) => void
  listOpen: boolean
  onListOpenChange: (open: boolean) => void
  pulseKey: number
}) {
  const contentId = useId()
  return (
    <section aria-label="Мапа тривог" className="border-b">
      <Button
          type="button"
          variant="ghost"
          data-focus-inset
          aria-expanded={open}
          aria-controls={contentId}
          aria-keyshortcuts="M"
          onClick={() => onOpenChange(!open)}
          className={cn(
            'h-9 w-full justify-between rounded-none px-3 font-normal',
            'hover:bg-accent aria-expanded:bg-transparent aria-expanded:hover:bg-accent dark:hover:bg-accent',
          )}
        >
          <span className="min-w-0 truncate text-body">
            <span className="font-medium">Мапа тривог</span>
            <span className="text-muted-foreground"> · {regionsAlertText(alerts.regions)}</span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn('size-4 text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
          />
      </Button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="map" id={contentId} data-map-body {...appear} className="pb-2">
            <MapBody alerts={alerts} listOpen={listOpen} onListOpenChange={onListOpenChange} pulseKey={pulseKey} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function MapBody({
  alerts,
  listOpen,
  onListOpenChange,
  pulseKey,
}: {
  alerts: Alerts
  listOpen: boolean
  onListOpenChange: (open: boolean) => void
  pulseKey: number
}) {
  const [hover, setHover] = useState<string | null>(null)
  const onHover = useCallback((name: string | null) => setHover(name), [])
  const lines = regionListLines(alerts.regions)
  const count = Object.keys(alerts.regions).length
  const listId = useId()
  return (
    <>
      <UaMap regions={alerts.regions} focusName={alerts.focus.name} pulseKey={pulseKey} onHover={onHover} />
      <div className="relative flex h-7 items-center gap-3 px-3 text-micro text-muted-foreground">
        <div className={cn('flex items-center gap-3', hover && 'invisible')}>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="legend-swatch size-2 rounded-sm bg-map-red" />
            Червона
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="legend-swatch size-2 rounded-sm bg-map-yellow" />
            Жовта
          </span>
          <span className="flex items-center gap-1.5">
            <HatchSwatch level="red" size={8} />
            Частково
          </span>
        </div>
        {hover ? (
          <span className="absolute inset-x-3 truncate text-right">{regionReadout(hover, alerts.regions[hover])}</span>
        ) : (
          <span className="ml-auto min-w-0 truncate tabular-nums">{alerts.updatedAt ? updatedText(alerts.updatedAt) : ''}</span>
        )}
      </div>
      {lines.length ? (
        <div>
          <div className="flex h-7 items-center">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-expanded={listOpen}
              aria-controls={listId}
              onClick={() => onListOpenChange(!listOpen)}
              className="mx-1.5 justify-start gap-1.5 px-1.5 font-normal text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-accent aria-expanded:hover:text-foreground dark:hover:bg-accent"
            >
              <ChevronRight aria-hidden className={cn('size-3.5 transition-transform duration-150', listOpen && 'rotate-90')} />
              <span className="text-caption">Області з тривогою · {count}</span>
            </Button>
          </div>
          <AnimatePresence initial={false}>
            {listOpen ? (
              <motion.ul key="list" id={listId} {...appear} className="flex flex-col gap-1 px-3 pt-1 text-caption">
                {lines.map((ln) => (
                  <li key={ln.level} className="grid grid-cols-[12px_minmax(0,1fr)] items-start gap-x-2">
                    <span className="flex h-4 items-center">
                      <LevelIcon level={ln.level} size={12} />
                    </span>
                    <span className="text-pretty select-text">
                      <span className="text-muted-foreground">{ln.label}: </span>
                      {ln.names}
                    </span>
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </>
  )
}

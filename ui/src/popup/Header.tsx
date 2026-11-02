import type { Ref } from 'react'
import { SquarePen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/app/Tip'
import { fmtClock, fmtLongDate, weekName } from '@/lib/format'

const ICON_BTN = 'text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-accent'

export function Header({
  ref,
  now,
  week,
}: {
  ref: Ref<HTMLElement>
  now: Date
  week: 'odd' | 'even' | null
}) {
  return (
    <header ref={ref} className="flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3">
      <span className="min-w-0 truncate text-body font-medium">
        {fmtLongDate(now)}
        {week ? <span className="font-normal text-muted-foreground"> · {weekName(week)}</span> : null}
      </span>
      <time dateTime={now.toISOString()} className="ml-auto text-body text-muted-foreground tabular-nums">
        {fmtClock(now)}
      </time>
      <div className="flex items-center gap-0.5">
        <Tip label="Редактор розкладу" kbd="E">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Редактор розкладу"
            aria-keyshortcuts="E"
            className={ICON_BTN}
            onClick={() => window.api.openEditor()}
          >
            <SquarePen aria-hidden />
          </Button>
        </Tip>
        <Tip label="Сховати" kbd="Esc" align="end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Сховати"
            aria-keyshortcuts="Escape"
            className={ICON_BTN}
            onClick={() => window.api.hidePopup()}
          >
            <X aria-hidden />
          </Button>
        </Tip>
      </div>
    </header>
  )
}

import { CalendarRange, List } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tip } from '@/components/app/Tip'
import { useEditor } from './context'
import type { WeekFilter } from './lessons'
import { TogglePill, TriCheckbox } from './parts'

const ITEM = 'relative isolate data-[state=on]:bg-transparent aria-pressed:bg-transparent'

export function Toolbar() {
  const { route, setView, filter, setFilter, alternation, lessons, actions, width } = useEditor()
  const withRemind = lessons.filter((l) => l.remind).length
  const all: boolean | 'indeterminate' = !lessons.length || withRemind === 0 ? false : withRemind === lessons.length ? true : 'indeterminate'
  const compact = width < 960
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b px-6">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={route.view}
        onValueChange={(v) => v && setView(v as 'grid' | 'list')}
        aria-label="Вигляд"
      >
        <ToggleGroupItem value="grid" className={ITEM}>
          {route.view === 'grid' ? <TogglePill id="view-pill" /> : null}
          <CalendarRange />
          Тиждень
        </ToggleGroupItem>
        <ToggleGroupItem value="list" className={ITEM}>
          {route.view === 'list' ? <TogglePill id="view-pill" /> : null}
          <List />
          Список
        </ToggleGroupItem>
      </ToggleGroup>

      {alternation ? (
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted-foreground" id="week-filter-label">
            Показати:
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={filter}
            onValueChange={(v) => v && setFilter(v as WeekFilter)}
            aria-labelledby="week-filter-label"
          >
            <ToggleGroupItem value="both" className={ITEM}>
              {filter === 'both' ? <TogglePill id="filter-pill" /> : null}
              {compact ? 'Обидва' : 'Обидва тижні'}
            </ToggleGroupItem>
            <ToggleGroupItem value="odd" className={ITEM}>
              {filter === 'odd' ? <TogglePill id="filter-pill" /> : null}
              Чисельник
            </ToggleGroupItem>
            <ToggleGroupItem value="even" className={ITEM}>
              {filter === 'even' ? <TogglePill id="filter-pill" /> : null}
              Знаменник
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}

      <div className="flex-1" />

      <Tip label="Сповіщення перед кожною парою" side="bottom" align="end">
        <label className="flex items-center gap-2 text-body select-none">
          <TriCheckbox
            checked={all}
            disabled={!lessons.length}
            onCheckedChange={() => actions.remindAll(all !== true)}
          />
          Нагадувати про всі
        </label>
      </Tip>
    </div>
  )
}

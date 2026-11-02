import { CalendarPlus, FileInput, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useEditor } from './context'

export function EmptySchedule() {
  const { actions, go } = useEditor()
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-card">
      <div className="flex max-w-[560px] flex-col items-start gap-4 px-6 pt-12 pl-[80px]">
        <CalendarPlus className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-title">Розклад порожній</h2>
          <p className="text-body text-muted-foreground text-pretty">
            Додайте першу пару або імпортуйте CSV. Клітинки з Google Таблиць можна просто вставити — Ctrl+V.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => actions.add()}>
            <Plus />
            Додати пару
            <Kbd className="ml-1 h-[18px] min-w-[18px] bg-primary-foreground/15 text-micro text-primary-foreground">N</Kbd>
          </Button>
          <Button variant="outline" onClick={() => actions.importPick()}>
            <FileInput />
            Імпортувати CSV…
          </Button>
        </div>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => go('settings/csv')}>
          Формат CSV
        </Button>
      </div>
    </div>
  )
}

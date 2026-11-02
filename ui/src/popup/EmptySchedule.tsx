import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'

export function EmptySchedule() {
  return (
    <Empty className="items-start gap-4 rounded-none border-0 px-3 py-6 text-left">
      <EmptyHeader className="items-start gap-1">
        <EmptyTitle className="text-title">Розклад порожній</EmptyTitle>
        <EmptyDescription className="max-w-[34ch] text-body text-pretty text-muted-foreground">
          Додайте пари в редакторі або імпортуйте CSV, наприклад з Google Таблиць.
        </EmptyDescription>
      </EmptyHeader>
      <div className="flex gap-2">
        <Button type="button" className="hover:bg-primary/90" onClick={() => window.api.openEditor('schedule')}>
          Відкрити редактор
        </Button>
        <Button type="button" variant="outline" onClick={() => window.api.openEditor('import')}>
          Імпортувати CSV…
        </Button>
      </div>
    </Empty>
  )
}

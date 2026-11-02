import { Fragment } from 'react'
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { EditorDialogContent } from './parts'

const GROUPS: { title: string; items: [string[][], string][] }[] = [
  {
    title: 'Загальні',
    items: [
      [[['Ctrl', '1']], 'Розклад'],
      [[['Ctrl', '2']], 'Години сповіщень про тривоги'],
      [[['Ctrl', '3']], 'Налаштування'],
      [[['Ctrl', 'O']], 'Імпорт CSV'],
      [[['Ctrl', 'Shift', 'S']], 'Експорт CSV'],
      [[['Ctrl', 'V']], 'Вставити клітинки з Google Таблиць'],
      [[['Ctrl', 'S']], 'Зберегти зараз'],
      [[['Ctrl', 'Z']], 'Скасувати'],
      [[['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']], 'Повторити'],
      [[['Ctrl', '+'], ['Ctrl', '−'], ['Ctrl', '0']], 'Масштаб'],
      [[['?']], 'Ця довідка'],
    ],
  },
  {
    title: 'Пари',
    items: [
      [[['N'], ['Ctrl', 'N']], 'Нова пара'],
      [[['Ctrl', 'D']], 'Дублювати (тиждень міняється)'],
      [[['Del']], 'Видалити'],
      [[['Alt', '↑'], ['Alt', '↓']], 'На 5 хв раніше / пізніше'],
      [[['Shift', 'Alt', '↑'], ['Shift', 'Alt', '↓']], 'На 30 хв раніше / пізніше'],
      [[['Alt', '←'], ['Alt', '→']], 'Попередній / наступний день'],
    ],
  },
  {
    title: 'Тиждень',
    items: [
      [[['←'], ['↑'], ['↓'], ['→']], 'Між парами'],
      [[['↵']], 'До назви в панелі пари'],
      [[['Esc']], 'Назад до сітки / зняти виділення'],
    ],
  },
  {
    title: 'Список',
    items: [
      [[['↵'], ['Shift', '↵']], 'Та сама колонка в наступному / попередньому рядку'],
      [[['Ctrl', '↵']], 'Нова пара нижче'],
      [[['↑'], ['↓']], 'У полі часу: ±5 хв (Shift — ±1 год)'],
    ],
  },
]

function Keys({ combos }: { combos: string[][] }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {combos.map((c, i) => (
        <Fragment key={i}>
          {i ? <span className="text-micro text-muted-foreground">/</span> : null}
          <span className="inline-flex items-center gap-0.5">
            {c.map((k) => (
              <Kbd key={k} className="h-5 min-w-5 border bg-background text-micro">
                {k}
              </Kbd>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditorDialogContent className="gap-5 sm:max-w-[760px]">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="text-title">Клавіші</DialogTitle>
          <DialogDescription className="text-body text-muted-foreground">
            Працюють на будь-якій розкладці клавіатури.
          </DialogDescription>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 overflow-auto md:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title} className="flex flex-col gap-2">
              <h3 className="text-caption font-medium text-muted-foreground">{g.title}</h3>
              <table className="w-full text-body">
                <tbody>
                  {g.items.map(([combos, label]) => (
                    <tr key={label} className="align-top">
                      <td className="w-px py-1 pr-4">
                        <Keys combos={combos} />
                      </td>
                      <td className="py-1 text-pretty">{label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </EditorDialogContent>
    </Dialog>
  )
}

import { BellRing, CalendarDays, ClipboardPaste, Ellipsis, FileInput, FileOutput, Plus, Settings2 } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Tip } from '@/components/app/Tip'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { spring } from '@/lib/motion'
import { useEditor } from './context'
import { BP } from './useWidth'

export function AppMark({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={className}>
      <defs>
        <clipPath id="app-mark-body">
          <rect x="1" y="2" width="14" height="13" rx="3" />
        </clipPath>
      </defs>
      <g fill="currentColor">
        <path
          fillRule="evenodd"
          d="M4 2h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm-1 3v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5Z"
        />
        <rect x="1" y="2" width="14" height="3" clipPath="url(#app-mark-body)" />
        <rect x="4" y="1" width="2" height="3" />
        <rect x="10" y="1" width="2" height="3" />
        <rect x="4" y="7" width="8" height="2" />
        <rect x="4" y="10" width="5" height="2" />
      </g>
    </svg>
  )
}

async function pasteFromClipboard(importText: (t: string, s: string) => void) {
  try {
    const text = await navigator.clipboard.readText()
    if (text.trim()) importText(text, 'Буфер обміну')
    else toast('Буфер обміну порожній', { description: 'Скопіюйте клітинки з Google Таблиць і спробуйте ще раз.' })
  } catch {
    toast.error('Не вдалося прочитати буфер обміну', { description: 'Натисніть Ctrl+V у вікні редактора.' })
  }
}

function TabLine() {
  return (
    <motion.span
      layoutId="tab-line"
      transition={spring.snappy}
      aria-hidden
      className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary"
    />
  )
}

export function AppBar() {
  const { route, width, actions } = useEditor()
  const compact = width < BP.wide
  const onSchedule = route.tab === 'schedule'
  return (
    <header className="editor-appbar flex h-11 shrink-0 items-center gap-3 border-b bg-background pl-3">
      <div className="flex items-center gap-2 pr-2">
        <AppMark className="text-primary" />
        <span className="text-body font-semibold whitespace-nowrap">Розклад і тривоги</span>
      </div>
      <TabsList variant="line" className="h-full gap-1 self-stretch p-0 group-data-horizontal/tabs:h-full" aria-label="Розділи редактора">
        <Tip label="Розклад" kbd={['Ctrl', '1']}>
          <TabsTrigger
            value="schedule"
            className="h-full flex-none rounded-none px-2 after:hidden data-active:text-foreground"
          >
            <CalendarDays />
            Розклад
            {onSchedule ? <TabLine /> : null}
          </TabsTrigger>
        </Tip>
        <Tip label="Коли сповіщати про тривоги" kbd={['Ctrl', '2']}>
          <TabsTrigger
            value="alert-hours"
            className="h-full flex-none rounded-none px-2 after:hidden data-active:text-foreground"
          >
            <BellRing />
            Тривоги
            {route.tab === 'alert-hours' ? <TabLine /> : null}
          </TabsTrigger>
        </Tip>
        <Tip label="Налаштування" kbd={['Ctrl', '3']}>
          <TabsTrigger
            value="settings"
            className="h-full flex-none rounded-none px-2 after:hidden data-active:text-foreground"
          >
            <Settings2 />
            Налаштування
            {route.tab === 'settings' ? <TabLine /> : null}
          </TabsTrigger>
        </Tip>
      </TabsList>

      <div className="min-w-4 flex-1 self-stretch" aria-hidden />

      {compact ? (
        <DropdownMenu>
          <Tip label="CSV">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="CSV">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end" className="w-auto min-w-52">
            <DropdownMenuItem onSelect={() => actions.importPick()}>
              <FileInput />
              Імпорт CSV
              <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.exportCsv()}>
              <FileOutput />
              Експорт CSV
              <DropdownMenuShortcut>Ctrl+Shift+S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void pasteFromClipboard(actions.importText)}>
              <ClipboardPaste />
              Вставити з буфера
              <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Tip label="Імпортувати розклад з CSV" kbd={['Ctrl', 'O']}>
            <Button variant="outline" size="sm" onClick={() => actions.importPick()}>
              <FileInput />
              Імпорт CSV
            </Button>
          </Tip>
          <Tip label="Зберегти розклад у CSV" kbd={['Ctrl', 'Shift', 'S']}>
            <Button variant="outline" size="sm" onClick={() => actions.exportCsv()}>
              <FileOutput />
              Експорт CSV
            </Button>
          </Tip>
        </div>
      )}

      {onSchedule ? (
        <Tip label="Нова пара" kbd="N">
          <Button size="sm" onClick={() => actions.add()}>
            <Plus />
            Додати пару
          </Button>
        </Tip>
      ) : null}
      <div className="w-1" aria-hidden />
    </header>
  )
}

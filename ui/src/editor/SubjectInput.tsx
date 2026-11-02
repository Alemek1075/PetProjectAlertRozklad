import { useId, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { SubjectDot } from '@/components/app/SubjectDot'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { pairsCount } from '@/lib/format'
import { subjectIndex, subjectKey } from '@/lib/subjects'
import { cn } from '@/lib/utils'

export interface SubjectStat { subject: string; key: string; count: number }

export interface SubjectInputProps
  extends Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size'> {
  value: string
  onValueChange: (value: string) => void
  suggestions: SubjectStat[]
  colors: Record<string, number>
  onAccept?: (subject: string) => void
}

const matches = (key: string, q: string) => key.startsWith(q) || key.split(/[\s\-–—(]+/).some((w) => w.startsWith(q))

export function SubjectInput({
  value,
  onValueChange,
  suggestions,
  colors,
  onAccept,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  ...props
}: SubjectInputProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const focusValue = useRef(value)
  const anchorRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const q = subjectKey(value)
  const items = useMemo(
    () => (q ? suggestions.filter((s) => s.key !== q && matches(s.key, q)).slice(0, 6) : []),
    [q, suggestions],
  )
  const show = open && items.length > 0
  const activeIdx = Math.min(active, items.length - 1)

  const accept = (s: SubjectStat) => {
    setOpen(false)
    onValueChange(s.subject)
    onAccept?.(s.subject)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (show && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        setActive((activeIdx + d + items.length) % items.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        accept(items[activeIdx])
        return
      }
      if (e.key === 'Tab' && !e.shiftKey) {
        accept(items[activeIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        return
      }
    }
    if (e.key === 'Escape' && value !== focusValue.current) {
      e.preventDefault()
      e.stopPropagation()
      onValueChange(focusValue.current)
      return
    }
    onKeyDown?.(e)
  }

  return (
    <Popover open={show}>
      <PopoverAnchor asChild>
        <Input
          ref={anchorRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Назва предмета"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={show}
          aria-controls={show ? listId : undefined}
          aria-activedescendant={show ? `${listId}-${activeIdx}` : undefined}
          {...props}
          value={value}
          className={className}
          onChange={(e) => {
            setOpen(true)
            setActive(0)
            onValueChange(e.target.value)
          }}
          onFocus={(e) => {
            focusValue.current = value
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setOpen(false)
            onBlur?.(e)
          }}
          onKeyDown={handleKey}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault()
        }}
        className="w-(--radix-popover-trigger-width) min-w-60 gap-0 p-1"
      >
        <div role="listbox" id={listId} aria-label="Предмети з розкладу">
          {items.map((s, i) => (
            <div
              key={s.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => accept(s)}
              className={cn(
                'flex h-8 items-center gap-2 rounded-md px-2 text-body',
                i === activeIdx && 'bg-accent text-accent-foreground',
              )}
            >
              <SubjectDot index={subjectIndex(s.subject, colors)} size={6} />
              <span className="min-w-0 flex-1 truncate">{s.subject}</span>
              <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{pairsCount(s.count)}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { TIME_ERROR, parseTime, parseTimeRange, stepTime } from '@/lib/time'

export interface TimeInputProps
  extends Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size'> {
  value: string
  onValueChange: (value: string) => void
  onRange?: (start: string, end: string) => void
  onInvalidChange?: (message: string | null) => void
  onEscapeBlur?: () => void
  variant?: 'list' | 'inspector'
}

export function TimeInput({
  value,
  onValueChange,
  onRange,
  onInvalidChange,
  onEscapeBlur,
  variant = 'list',
  className,
  onBlur,
  onFocus,
  onKeyDown,
  'aria-invalid': ariaInvalid,
  ...props
}: TimeInputProps) {
  const [draft, setDraft] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const focusValue = useRef(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
    setInvalid(false)
  }, [value])

  const report = (bad: boolean) => {
    setInvalid(bad)
    onInvalidChange?.(bad ? TIME_ERROR : null)
  }

  const commit = () => {
    const t = draft.trim()
    if (!t) {
      report(false)
      if (value !== '') onValueChange('')
      return
    }
    if (onRange) {
      const r = parseTimeRange(t)
      if (r) {
        report(false)
        setDraft(r.start)
        onRange(r.start, r.end)
        return
      }
    }
    const p = parseTime(t)
    if (p) {
      report(false)
      setDraft(p)
      if (p !== value) onValueChange(p)
    } else {
      report(true)
    }
  }

  const step = (dir: 1 | -1, size: number) => {
    const base = parseTime(draft) ?? (value || '08:00')
    const next = stepTime(base, dir, size)
    report(false)
    setDraft(next)
    if (next !== value) onValueChange(next)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    switch (e.key) {
      case 'Enter':
        commit()
        return
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault()
        step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 60 : 5)
        return
      case 'PageUp':
      case 'PageDown':
        e.preventDefault()
        step(e.key === 'PageUp' ? 1 : -1, 60)
        return
      case 'Escape': {
        const dirty = invalid || draft !== focusValue.current || value !== focusValue.current
        if (dirty) {
          e.preventDefault()
          e.stopPropagation()
          report(false)
          setDraft(focusValue.current)
          if (value !== focusValue.current) onValueChange(focusValue.current)
        } else {
          e.preventDefault()
          e.stopPropagation()
          ref.current?.blur()
          onEscapeBlur?.()
        }
        return
      }
    }
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder="гг:хх"
      {...props}
      value={draft}
      aria-invalid={invalid || ariaInvalid === true || ariaInvalid === 'true' || undefined}
      className={cn('tabular-nums', variant === 'list' ? 'w-[76px]' : 'w-[88px]', className)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        focusValue.current = value
        onFocus?.(e)
      }}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
      onKeyDown={handleKey}
    />
  )
}

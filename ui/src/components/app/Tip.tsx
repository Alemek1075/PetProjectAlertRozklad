import { Fragment, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { Slot } from 'radix-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

type Side = 'top' | 'right' | 'bottom' | 'left'

function KeepChildState({ 'data-state': _tooltipState, ...props }: ComponentProps<typeof Slot.Root> & { 'data-state'?: string }) {
  return <Slot.Root {...props} />
}

const KBD_IN_TIP =
  'in-data-[slot=tooltip-content]:bg-muted in-data-[slot=tooltip-content]:text-muted-foreground dark:in-data-[slot=tooltip-content]:bg-muted h-[18px] min-w-[18px] text-micro'

export function TipKbd({ keys, className }: { keys: string | string[]; className?: string }) {
  const list = Array.isArray(keys) ? keys : [keys]
  return (
    <span className="ml-1 inline-flex items-center gap-0.5">
      {list.map((k, i) => (
        <Fragment key={i}>
          <Kbd className={cn(KBD_IN_TIP, className)}>{k}</Kbd>
        </Fragment>
      ))}
    </span>
  )
}

export function Tip({
  label,
  kbd,
  side = 'bottom',
  align,
  disabled,
  children,
  className,
}: {
  label: ReactNode
  kbd?: string | string[]
  side?: Side
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  children: ReactElement
  className?: string
}) {
  if (disabled || label === null || label === undefined || label === '') return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <KeepChildState>{children}</KeepChildState>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={6} className={className}>
        <span>{label}</span>
        {kbd ? <TipKbd keys={kbd} /> : null}
      </TooltipContent>
    </Tooltip>
  )
}

export function TruncateTip({
  label,
  side = 'top',
  children,
}: {
  label: ReactNode
  side?: Side
  children: ReactElement
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const truncated = () => {
    const el = ref.current
    return !!el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
  }
  return (
    <Tooltip open={open} onOpenChange={(o) => setOpen(o && truncated())}>
      <TooltipTrigger asChild ref={ref as never}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="max-w-[320px] text-pretty">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

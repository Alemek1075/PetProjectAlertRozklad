import { OctagonAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LevelIconLevel = 'red' | 'yellow' | 'clear'

const ICON = { red: OctagonAlert, yellow: TriangleAlert, clear: ShieldCheck } as const
const COLOR = { red: 'text-alert-red', yellow: 'text-alert-yellow-foreground', clear: 'text-alert-clear' } as const

export function LevelIcon({
  level,
  size = 16,
  label,
  className,
}: {
  level: LevelIconLevel
  size?: 12 | 14 | 16 | 20
  label?: string
  className?: string
}) {
  const Icon = ICON[level]
  return (
    <Icon
      width={size}
      height={size}
      strokeWidth={size >= 20 ? 1.75 : 2}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={cn('shrink-0', COLOR[level], className)}
    />
  )
}

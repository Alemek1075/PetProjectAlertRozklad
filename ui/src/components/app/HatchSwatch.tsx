import { useId } from 'react'
import { cn } from '@/lib/utils'

const STRIPE = { red: 'var(--map-red)', yellow: 'var(--map-yellow)' } as const

export function HatchSwatch({ level = 'red', size = 10, className }: { level?: 'red' | 'yellow'; size?: 8 | 10; className?: string }) {
  const id = `hatch-${useId().replace(/:/g, '')}`
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 10 10"
      className={cn('legend-swatch shrink-0 overflow-hidden rounded-sm', className)}
    >
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--map-idle)" />
          <rect width="1.75" height="4" fill={STRIPE[level]} />
        </pattern>
      </defs>
      <rect width="10" height="10" fill={`url(#${id})`} />
    </svg>
  )
}

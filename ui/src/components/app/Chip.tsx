import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { weekChip } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Chip({ week, children, className }: { week?: 'odd' | 'even'; children?: ReactNode; className?: string }) {
  const w = week ? weekChip(week) : null
  return (
    <Badge variant="outline" className={cn('h-[18px] shrink-0 px-1.5 text-micro', className)}>
      {w ? (
        <>
          <span aria-hidden>{w.text}</span>
          <span className="sr-only">{w.label}</span>
        </>
      ) : (
        children
      )}
    </Badge>
  )
}

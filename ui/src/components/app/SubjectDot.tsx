import { cn } from '@/lib/utils'

const SIZE = { 6: 'size-1.5', 8: 'size-2', 10: 'size-2.5', 16: 'size-4' } as const

export function SubjectDot({ index, size = 8, className }: { index?: number; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      aria-hidden
      data-subject={index}
      className={cn('inline-block shrink-0 rounded-full bg-subject', SIZE[size], className)}
    />
  )
}

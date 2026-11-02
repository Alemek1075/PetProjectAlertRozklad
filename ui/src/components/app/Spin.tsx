import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

export function Spin({ label, className }: { label?: string; className?: string }) {
  return label ? (
    <Spinner aria-label={label} className={cn('text-muted-foreground', className)} />
  ) : (
    <Spinner role={undefined} aria-label={undefined} aria-hidden className={cn('text-muted-foreground', className)} />
  )
}

import { ExternalLink, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/app/Tip'
import { joinLabel, joinTooltip, linkInfo } from '@/lib/format'
import { cn } from '@/lib/utils'

export function JoinButton({
  url,
  subject,
  variant,
  size,
  className,
}: {
  url: string
  subject: string
  variant: 'default' | 'outline' | 'ghost'
  size: 'sm' | 'xs'
  className?: string
}) {
  const info = linkInfo(url)
  if (!info) return null
  const Icon = info.video ? Video : ExternalLink
  const filled = variant === 'default'
  return (
    <Tip label={joinTooltip(url)} kbd={filled ? 'J' : undefined} side="bottom" align="end">
      <Button
        type="button"
        variant={variant}
        size={size}
        data-external
        aria-label={joinLabel(subject, url)}
        aria-keyshortcuts={filled ? 'J' : undefined}
        onClick={() => window.api.openLink(url)}
        className={cn(
          filled && 'hover:bg-primary/90',
          variant === 'ghost' && 'text-muted-foreground hover:text-foreground dark:hover:bg-muted',
          className,
        )}
      >
        <Icon aria-hidden />
        {info.label}
      </Button>
    </Tip>
  )
}

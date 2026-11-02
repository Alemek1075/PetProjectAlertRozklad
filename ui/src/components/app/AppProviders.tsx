import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppProviders({ tooltipDelay, children }: { tooltipDelay: 500 | 700; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={tooltipDelay} skipDelayDuration={300}>
        {children}
      </TooltipProvider>
    </MotionConfig>
  )
}

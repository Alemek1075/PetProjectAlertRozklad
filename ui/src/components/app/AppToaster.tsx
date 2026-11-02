import type { ComponentProps } from 'react'
import { Toaster } from '@/components/ui/sonner'

export function AppToaster(props: ComponentProps<typeof Toaster>) {
  return (
    <Toaster
      position="bottom-right"
      offset={{ bottom: 44, right: 16 }}
      gap={8}
      visibleToasts={3}
      duration={5000}
      closeButton
      toastOptions={{
        classNames: {
          toast: 'cn-toast !shadow-md',
          title: '!text-body !font-medium',
          description: '!text-caption !text-muted-foreground',
          actionButton:
            '!h-6 !rounded-md !border !border-border !bg-background !px-2 !text-caption !font-medium !text-foreground hover:!bg-muted',
          cancelButton: '!h-6 !rounded-md !px-2 !text-caption',
        },
      }}
      {...props}
    />
  )
}

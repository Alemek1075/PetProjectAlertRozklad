import type { ComponentProps, ReactNode } from 'react'
import { CheckIcon, MinusIcon, XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Checkbox as CheckboxPrimitive, Dialog as DialogPrimitive } from 'radix-ui'
import { Tip } from '@/components/app/Tip'
import { Button } from '@/components/ui/button'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function EditorDialogContent({
  className,
  children,
  closeLabel = 'Закрити',
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { closeLabel?: string | null }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 dark:bg-black/60" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        tabIndex={-1}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus()
        }}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100vh-48px)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-popover p-6 text-sm text-popover-foreground shadow-e3 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        {closeLabel ? (
          <Tip label={closeLabel} kbd="Esc">
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" className="absolute top-4 right-4" aria-label={closeLabel}>
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </Tip>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function TriCheckbox({ className, checked, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:data-[state=checked]:bg-primary dark:data-[state=indeterminate]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center text-current [&>svg]:size-3.5">
        {checked === 'indeterminate' ? <MinusIcon /> : <CheckIcon />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export function TogglePill({ id }: { id: string }) {
  return (
    <motion.span
      layoutId={id}
      transition={spring.snappy}
      aria-hidden
      className="absolute inset-0 -z-10 rounded-[inherit] bg-muted"
    />
  )
}

export function Helper({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <p id={id} className={cn('text-caption text-muted-foreground text-pretty', className)}>
      {children}
    </p>
  )
}

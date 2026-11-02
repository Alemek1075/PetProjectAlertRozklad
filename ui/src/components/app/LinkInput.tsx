import { useId, type ComponentProps } from 'react'
import { CircleAlert, ExternalLink } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Tip } from './Tip'
import { LINK_WARNING, linkInfo, linkLooksWrong } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface LinkInputProps
  extends Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size'> {
  value: string
  onValueChange: (value: string) => void
  showService?: boolean
  revealButton?: boolean
  showWarning?: boolean
  groupClassName?: string
}

export function LinkInput({
  value,
  onValueChange,
  showService = true,
  revealButton = false,
  showWarning = true,
  groupClassName,
  className,
  ...props
}: LinkInputProps) {
  const info = linkInfo(value)
  const warn = showWarning && linkLooksWrong(value)
  const warnId = useId()
  return (
    <InputGroup className={groupClassName}>
      <InputGroupInput
        type="url"
        placeholder="https://zoom.us/j/…"
        spellCheck={false}
        autoComplete="off"
        {...props}
        aria-describedby={cn(props['aria-describedby'], warn && warnId) || undefined}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn('text-body', className)}
      />
      <InputGroupAddon align="inline-end" className="gap-1.5">
        {warn ? (
          <Tip label={LINK_WARNING} side="top">
            <span className="inline-flex text-muted-foreground">
              <CircleAlert className="size-3.5" aria-hidden />
              <span id={warnId} className="sr-only">{LINK_WARNING}</span>
            </span>
          </Tip>
        ) : null}
        {showService && info?.service ? (
          <span className="text-caption font-normal text-muted-foreground">{info.service}</span>
        ) : null}
        <Tip label="Відкрити посилання" side="top" disabled={!value.trim()}>
          <InputGroupButton
            size="icon-xs"
            aria-label="Відкрити посилання"
            disabled={!value.trim()}
            data-external
            onClick={() => window.api.openLink(value.trim())}
            className={cn(
              'text-muted-foreground',
              revealButton &&
                'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100',
            )}
          >
            <ExternalLink className="size-3.5" />
          </InputGroupButton>
        </Tip>
      </InputGroupAddon>
    </InputGroup>
  )
}

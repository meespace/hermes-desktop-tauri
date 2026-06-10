import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import * as React from 'react'

import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer grid size-[1.125rem] shrink-0 place-items-center rounded-[calc(var(--radius)*0.75)] border border-[var(--field-border)] bg-[var(--field-background)] text-[var(--accent-foreground)] shadow-[var(--field-shadow)] outline-none transition-[background-color,border-color,box-shadow,transform] duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)] focus-visible:border-[var(--focus)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--focus)_22%,transparent)] disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity,0.5)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)] data-[state=checked]:shadow-none',
        className
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-current"
        data-slot="checkbox-indicator"
      >
        <Codicon name="check" size="0.8125rem" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

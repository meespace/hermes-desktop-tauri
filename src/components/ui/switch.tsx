import { Switch as SwitchPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-[var(--field-border)] bg-[var(--default)] p-[0.125rem] shadow-[var(--field-shadow)] outline-none transition-[background-color,border-color,box-shadow,transform] duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)] focus-visible:border-[var(--focus)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--focus)_22%,transparent)] disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity,0.5)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]',
        className
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-[var(--surface)] shadow-[0_0.0625rem_0.375rem_color-mix(in_srgb,#000_18%,transparent)] ring-0 transition-transform duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)] data-[state=checked]:translate-x-4 data-[state=checked]:bg-[var(--accent-foreground)] data-[state=unchecked]:translate-x-0'
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

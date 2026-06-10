import { Tabs as TabsPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-2', className)} data-slot="tabs" {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex min-h-10 items-center justify-center rounded-[calc(var(--radius)*1.75)] border border-[var(--border)] bg-[var(--default-soft)] p-1 text-[var(--muted)] shadow-[var(--field-shadow)]',
        className
      )}
      data-slot="tabs-list"
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-[calc(var(--radius)*1.25)] px-3 text-sm font-medium whitespace-nowrap text-[var(--muted)] transition-[background-color,color,box-shadow,transform] duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)] outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--focus)_22%,transparent)] disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity,0.5)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-[var(--surface-shadow)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger }

import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn(
        'relative overflow-hidden rounded-[calc(var(--radius)*1.5)] border border-transparent',
        className
      )}
      data-slot="scroll-area"
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="size-full outline-none" data-slot="scroll-area-viewport">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      className={cn(
        'flex touch-none select-none p-1 transition-colors',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent',
        className
      )}
      data-slot="scroll-area-scrollbar"
      forceMount
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className="relative flex-1 rounded-full bg-[var(--default-soft)] transition-colors hover:bg-[var(--default-soft-hover)]"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }

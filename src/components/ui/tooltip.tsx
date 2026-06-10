import { Tooltip as TooltipPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

function TooltipProvider({ delayDuration = 0, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          'tooltip z-50 w-fit text-balance text-foreground',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-90',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
          className
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        style={
          {
            ...style,
            '--trigger-anchor-point': 'var(--radix-tooltip-content-transform-origin)'
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className="z-50 size-2.5 fill-[var(--overlay)] stroke-[color-mix(in_srgb,var(--border)_40%,transparent)]"
          data-slot="overlay-arrow"
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }

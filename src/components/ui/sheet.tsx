'use client'

import { Dialog as SheetPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        'drawer__backdrop drawer__backdrop--opaque z-50',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <div
        className={cn(
          'drawer__content fixed inset-0 z-50',
          side === 'right' && 'drawer__content--right',
          side === 'left' && 'drawer__content--left',
          side === 'top' && 'drawer__content--top',
          side === 'bottom' && 'drawer__content--bottom'
        )}
      >
        <SheetPrimitive.Content
          className={cn(
            'drawer__dialog flex flex-col gap-4 border border-[var(--border)] text-sm text-foreground',
            side === 'right' && 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            side === 'left' && 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
            side === 'top' && 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
            side === 'bottom' && 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300',
            className
          )}
          data-placement={side}
          data-slot="sheet-content"
          {...props}
        >
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close className="drawer__close-trigger close-button close-button--default">
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Content>
      </div>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('drawer__header', className)} data-slot="sheet-header" {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('drawer__footer mt-auto', className)} data-slot="sheet-footer" {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn('drawer__heading text-[0.9375rem]', className)}
      data-slot="sheet-title"
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn('text-sm text-muted', className)}
      data-slot="sheet-description"
      {...props}
    />
  )
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }

import { Dialog as DialogPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'modal__backdrop modal__backdrop--opaque z-[120] pointer-events-auto',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-10">
        <DialogPrimitive.Content
          className={cn(
            'modal__dialog modal__dialog--md modal__dialog--scroll-inside grid w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto border border-[var(--border)] text-sm text-foreground',
            'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-5rem)] sm:max-w-lg',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            className
          )}
          data-slot="dialog-content"
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              className="modal__close-trigger close-button close-button--default"
              data-slot="dialog-close-button"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('modal__header text-center sm:text-left', className)}
      data-slot="dialog-header"
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('modal__footer flex-col-reverse sm:flex-row', className)}
      data-slot="dialog-footer"
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('modal__heading text-lg leading-none tracking-tight', className)}
      data-slot="dialog-title"
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted', className)}
      data-slot="dialog-description"
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
}

import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import * as React from 'react'

import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'

function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuPortal({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
}

function ContextMenuTrigger({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuGroup({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          'dropdown__popover dropdown__menu z-50 max-h-(--radix-context-menu-content-available-height) min-w-40 origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-[0.9rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_98%,transparent)] p-1 outline-none shadow-[0_18px_52px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        data-slot="context-menu-content"
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'menu-item min-h-7 gap-2 rounded-[0.58rem] px-2 py-0.5 text-[0.74rem] leading-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--disabled-opacity)]',
        'data-[highlighted]:bg-[var(--workbench-hover)] data-[highlighted]:text-[var(--foreground)] data-[highlighted]:outline-none',
        'data-[inset]:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-3.5',
        variant === 'destructive'
          ? 'menu-item--danger text-[var(--danger)] data-[highlighted]:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] data-[highlighted]:text-[var(--danger)]'
          : 'menu-item--default',
        className
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.Label
      className={cn('px-2 py-1 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-muted data-[inset]:pl-7', className)}
      data-inset={inset}
      data-slot="context-menu-label"
      {...props}
    />
  )
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--workbench-divider)]', className)}
      data-slot="context-menu-separator"
      {...props}
    />
  )
}

function ContextMenuSub({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(
        'menu-item menu-item--default min-h-7 rounded-[0.58rem] px-2 py-0.5 text-[0.74rem]',
        'data-[inset]:pl-7 data-[state=open]:bg-[var(--workbench-hover)] data-[state=open]:text-[var(--foreground)]',
        'data-[highlighted]:bg-[var(--workbench-hover)] data-[highlighted]:text-[var(--foreground)] data-[highlighted]:outline-none',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-3.5',
        className
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <span className="menu-item__indicator menu-item__indicator--submenu" data-slot="context-menu-sub-indicator">
        <Codicon className="ml-auto text-muted" name="chevron-right" size="0.875rem" />
      </span>
    </ContextMenuPrimitive.SubTrigger>
  )
}

function ContextMenuSubContent({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      className={cn(
        'dropdown__popover dropdown__menu z-50 min-w-40 overflow-hidden rounded-[0.9rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_98%,transparent)] p-1 outline-none shadow-[0_18px_52px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className
      )}
      data-slot="context-menu-sub-content"
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
}

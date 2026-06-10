import { Command as CommandPrimitive } from 'cmdk'
import * as React from 'react'

import { SearchIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-[1rem] border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-[var(--overlay)] text-[var(--overlay-foreground)] shadow-[0_1.5rem_4rem_-2.75rem_color-mix(in_srgb,#0f172a_35%,transparent)]',
        className
      )}
      data-slot="command"
      {...props}
    />
  )
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      className="flex min-h-10 items-center gap-2 border-b border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] px-3"
      data-slot="command-input-wrapper"
    >
      <SearchIcon className="size-3.5 shrink-0 text-muted" />
      <CommandPrimitive.Input
        className={cn(
          'flex h-9 w-full rounded-[var(--field-radius)] bg-transparent py-2 text-[0.8125rem] outline-none placeholder:text-field-placeholder disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        data-slot="command-input"
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn('max-h-[26rem] overflow-y-auto overflow-x-hidden p-1', className)}
      data-slot="command-list"
      {...props}
    />
  )
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className="rounded-[0.75rem] py-6 text-center text-[0.8125rem] text-muted"
      data-slot="command-empty"
      {...props}
    />
  )
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'overflow-hidden py-0.5 text-foreground **:[[cmdk-group-heading]]:sticky **:[[cmdk-group-heading]]:top-0 **:[[cmdk-group-heading]]:z-10 **:[[cmdk-group-heading]]:bg-[var(--overlay)] **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.1em] **:[[cmdk-group-heading]]:text-[color-mix(in_srgb,var(--foreground)_46%,transparent)]',
        className
      )}
      data-slot="command-group"
      {...props}
    />
  )
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn('-mx-1 my-1.5 h-px bg-separator', className)}
      data-slot="command-separator"
      {...props}
    />
  )
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'menu-item menu-item--default min-h-8 rounded-[0.65rem] px-2.5 py-1 text-[0.8125rem]',
        'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-[var(--disabled-opacity)]',
        'data-[selected=true]:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] data-[selected=true]:text-[var(--foreground)]',
        className
      )}
      data-slot="command-item"
      {...props}
    />
  )
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-muted', className)}
      data-slot="command-shortcut"
      {...props}
    />
  )
}

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
}

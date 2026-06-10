import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import * as React from 'react'
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// Shared class tokens for edge-to-edge menus (use with `p-0` content): rows go
// full-width, square, and compact so the highlight spans the whole surface.
// Reuse these instead of re-deriving per menu so every searchable/compact menu
// reads identically.
export const dropdownMenuRow = 'gap-2 rounded-[0.55rem] px-2 py-1 text-[0.78rem]'
export const dropdownMenuSectionLabel = 'px-2 pt-1 pb-0.5 text-[0.62rem] font-medium uppercase tracking-[0.12em]'

// Keys that must reach Radix's menu handler (navigation/close). Everything else
// is a filter keystroke and is stopped so the menu's typeahead doesn't hijack it.
const DROPDOWN_NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'])

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

/**
 * Borderless filter input for a searchable dropdown. Autofocuses, keeps the
 * menu's typeahead from eating keystrokes, and still lets arrow/enter/escape
 * drive the list. Drop it in as the first child of a `DropdownMenuContent`.
 */
function DropdownMenuSearch({
  className,
  onChange,
  onKeyDown,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & {
  onValueChange?: (value: string) => void
}) {
  return (
    <div className="px-2.5 py-1.5" data-slot="dropdown-menu-search">
      <input
        autoFocus
        className={cn(
          'min-h-8 w-full rounded-field border border-[var(--field-border)] bg-[var(--field-background)] px-2.5 text-xs leading-none text-foreground shadow-[var(--field-shadow)] outline-none transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-smooth)]',
          'placeholder:text-field-placeholder focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
        onChange={event => {
          onChange?.(event)
          onValueChange?.(event.target.value)
        }}
        onKeyDown={event => {
          if (!DROPDOWN_NAV_KEYS.has(event.key)) {
            event.stopPropagation()
          }

          onKeyDown?.(event)
        }}
        type="text"
        {...props}
      />
    </div>
  )
}

function DropdownMenuContent({
  className,
  collisionPadding = 8,
  sideOffset = 4,
  style,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn(
          'dropdown__popover dropdown__menu z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-[0.9rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_98%,transparent)] p-1 outline-none shadow-[0_18px_52px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        // Keep the menu inside the viewport: Radix flips/shifts away from edges
        // (avoidCollisions defaults on); the padding stops it kissing the edge.
        collisionPadding={collisionPadding}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        style={
          {
            ...style,
            '--trigger-anchor-point': 'var(--radix-dropdown-menu-content-transform-origin)'
          } as React.CSSProperties
        }
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <DropdownMenuPrimitive.Item
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
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        'menu-item menu-item--default min-h-7 rounded-[0.58rem] py-0.5 pr-2 pl-7 text-[0.74rem]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--disabled-opacity)]',
        'data-[highlighted]:bg-[var(--workbench-hover)] data-[highlighted]:text-[var(--foreground)] data-[highlighted]:outline-none',
        className
      )}
      data-selection-mode="multiple"
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    >
      <span className="menu-item__indicator" data-slot="menu-item-indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5" data-slot="menu-item-indicator--checkmark" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        'menu-item menu-item--default min-h-7 rounded-[0.58rem] py-0.5 pr-2 pl-7 text-[0.74rem]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--disabled-opacity)]',
        'data-[highlighted]:bg-[var(--workbench-hover)] data-[highlighted]:text-[var(--foreground)] data-[highlighted]:outline-none',
        className
      )}
      data-selection-mode="single"
      data-slot="dropdown-menu-radio-item"
      {...props}
    >
      <span className="menu-item__indicator" data-slot="menu-item-indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" data-slot="menu-item-indicator--dot" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-2 py-1 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-muted data-[inset]:pl-7', className)}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--workbench-divider)]', className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  )
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-muted', className)}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  hideChevron = false,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
  /** Suppress the trailing caret — for triggers that own their right-side affordance. */
  hideChevron?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        'menu-item menu-item--default min-h-7 rounded-[0.58rem] px-2 py-0.5 text-[0.74rem]',
        'data-[inset]:pl-7 data-[state=open]:bg-[var(--workbench-hover)] data-[state=open]:text-[var(--foreground)]',
        'data-[highlighted]:bg-[var(--workbench-hover)] data-[highlighted]:text-[var(--foreground)] data-[highlighted]:outline-none',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-3.5',
        className
      )}
      data-has-submenu="true"
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      {children}
      {!hideChevron && (
        <span className="menu-item__indicator menu-item__indicator--submenu" data-slot="submenu-indicator">
          <ChevronRightIcon className="size-3.5 text-muted" />
        </span>
      )}
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    // Portal the submenu out of the parent Content so it escapes that Content's
    // `overflow` clip. Without this, a submenu opening from a scrollable menu
    // gets visually cut off at the parent's edges. Radix Popper still anchors
    // it to the SubTrigger and handles collision/flip, so portaling is safe.
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          'dropdown__popover dropdown__menu z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-[0.9rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_98%,transparent)] p-1 shadow-[0_18px_52px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98',
          className
        )}
        // Flip to the other side / shift vertically when near a viewport edge
        // (e.g. the status bar menu opening from the bottom-right corner) so
        // the submenu never gets clipped.
        collisionPadding={collisionPadding}
        data-slot="dropdown-menu-content"
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSearch,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
}

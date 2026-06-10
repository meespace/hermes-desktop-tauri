import { Select as SelectPrimitive } from 'radix-ui'
import * as React from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type SelectVisualContextValue = {
  fullWidth: boolean
  variant: 'primary' | 'secondary'
}

const SelectVisualContext = React.createContext<SelectVisualContextValue>({
  fullWidth: true,
  variant: 'secondary'
})

function Select({
  children,
  fullWidth = true,
  variant = 'secondary',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root> & {
  fullWidth?: boolean
  variant?: 'primary' | 'secondary'
}) {
  return (
    <SelectVisualContext.Provider value={{ fullWidth, variant }}>
      <SelectPrimitive.Root data-slot="select" {...props}>
        {children}
      </SelectPrimitive.Root>
    </SelectVisualContext.Provider>
  )
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  const { fullWidth, variant } = React.useContext(SelectVisualContext)

  return (
    <SelectPrimitive.Trigger
      className={cn(
        'select__trigger relative justify-between whitespace-nowrap rounded-field',
        'data-[placeholder]:text-field-placeholder data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--disabled-opacity)]',
        'data-[state=open]:[&_[data-slot=select-indicator]]:rotate-180',
        fullWidth && 'w-full',
        variant === 'secondary' && 'bg-[var(--default)] shadow-none hover:bg-[var(--default-hover)] focus:bg-[var(--default)]',
        className
      )}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon
          className="size-4 shrink-0 text-field-placeholder transition-transform duration-150 ease-[var(--ease-smooth)]"
          data-slot="select-indicator"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectContent({
  className,
  children,
  position = 'popper',
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'select__popover z-50 max-h-72 overflow-hidden border border-[var(--border)] outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=top]:slide-in-from-bottom-1 data-[side=right]:slide-in-from-left-1',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className
        )}
        data-slot="select-content"
        position={position}
        style={
          {
            ...style,
            '--trigger-anchor-point': 'var(--radix-select-content-transform-origin)',
            '--trigger-width': 'var(--radix-select-trigger-width)'
          } as React.CSSProperties
        }
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            'list-box p-1.5',
            position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]'
          )}
          data-slot="list-box"
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'list-box-item cursor-default pr-8 text-sm text-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--disabled-opacity)]',
        'data-[highlighted]:bg-[var(--default)] data-[highlighted]:text-[var(--foreground)]',
        className
      )}
      data-slot="list-box-item"
      {...props}
    >
      <span className="list-box-item__indicator" data-slot="list-box-item-indicator">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5" data-slot="list-box-item-indicator--checkmark" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>
        <span data-slot="label">{children}</span>
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }

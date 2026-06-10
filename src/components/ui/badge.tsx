import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-[var(--field-radius)] border px-1.5 py-0.5 text-[0.65rem] font-medium leading-none whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[var(--accent-soft)] text-[var(--accent)]',
        muted: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]',
        warn: 'border-[color-mix(in_srgb,var(--warning)_24%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]',
        destructive: 'border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]',
        outline: 'border-[var(--border)] bg-transparent text-[var(--muted)]'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export interface BadgeProps extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  asChild?: boolean
}

export function Badge({ asChild = false, className, variant, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : 'span'

  return <Comp className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />
}

export { badgeVariants }

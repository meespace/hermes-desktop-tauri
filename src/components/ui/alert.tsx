import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-[calc(var(--radius)*1.75)] border px-4 py-3 text-sm shadow-[var(--surface-shadow)] has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'border-[var(--border)] bg-[var(--surface)] text-[var(--surface-foreground)]',
        destructive:
          'border-[color-mix(in_srgb,var(--danger)_20%,var(--border))] bg-[var(--danger-soft)] text-[var(--surface-foreground)] *:data-[slot=alert-description]:text-[var(--danger-soft-foreground)] [&>svg]:text-[var(--danger)]',
        warning:
          'border-[color-mix(in_srgb,var(--warning)_24%,var(--border))] bg-[var(--warning-soft)] text-[var(--surface-foreground)] [&>svg]:text-[var(--warning)]',
        success:
          'border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] text-[var(--surface-foreground)] [&>svg]:text-[var(--success)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div className={cn(alertVariants({ variant }), className)} data-slot="alert" role="alert" {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight text-foreground', className)}
      data-slot="alert-title"
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-[var(--muted)] [&_p]:leading-relaxed',
        className
      )}
      data-slot="alert-description"
      {...props}
    />
  )
}

export { Alert, AlertDescription, AlertTitle }

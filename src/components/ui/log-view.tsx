import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function LogView({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'overflow-auto rounded-[var(--field-radius)] border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 font-mono text-[0.6875rem] leading-[1.5] whitespace-pre-wrap break-words text-[var(--muted)] [scrollbar-width:thin]',
        className
      )}
      {...props}
    />
  )
}

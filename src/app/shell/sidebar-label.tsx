import type * as React from 'react'

import { cn } from '@/lib/utils'

interface SidebarPanelLabelProps extends React.ComponentProps<'span'> {
  dotClassName?: string
}

export function SidebarPanelLabel({ children, className, dotClassName, ...props }: SidebarPanelLabelProps) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--foreground)_46%,transparent)]',
        className
      )}
      {...props}
    >
      {dotClassName ? <span aria-hidden="true" className={cn('inline-block size-1 shrink-0 rounded-full', dotClassName)} /> : null}
      <span className="min-w-0 truncate leading-none">{children}</span>
    </span>
  )
}

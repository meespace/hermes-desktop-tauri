import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'ui-text-14 flex field-sizing-content min-h-16 w-full rounded-[8px] border border-input bg-card/86 px-3 py-2.5 text-foreground shadow-none transition-[color,box-shadow,border-color,background-color] duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-card focus-visible:ring-[2px] focus-visible:ring-ring/18 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-secondary/44 dark:aria-invalid:ring-destructive/40',
        className
      )}
      data-slot="textarea"
      {...props}
    />
  )
}

export { Textarea }

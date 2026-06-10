import { textAreaVariants } from '@heroui/styles/components/textarea'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        textAreaVariants({ fullWidth: true, variant: 'secondary' }),
        'ui-text-14 field-sizing-content min-h-16 rounded-[var(--field-radius)] px-3 py-2.5 text-sm shadow-none transition-[color,box-shadow,border-color,background-color] duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)]',
        className
      )}
      data-slot="textarea"
      {...props}
    />
  )
}

export { Textarea }

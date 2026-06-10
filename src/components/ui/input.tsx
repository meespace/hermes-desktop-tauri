import { inputVariants } from '@heroui/styles/components/input'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        inputVariants({ fullWidth: true, variant: 'secondary' }),
        'min-h-9 rounded-[var(--field-radius)] text-sm shadow-none transition-[color,box-shadow,border-color,background-color] duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)]',
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  )
}

export { Input }

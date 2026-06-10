import * as React from 'react'

import { cn } from '@/lib/utils'

function TextTabMeta({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('text-[0.72em] font-normal text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]', className)}
      {...props}
    />
  )
}

interface TextTabProps extends React.ComponentProps<'button'> {
  active?: boolean
}

function TextTab({ active = false, children, className, type = 'button', ...props }: TextTabProps) {
  return (
    <button
      className={cn(
        'group/text-tab inline-flex min-h-[1.7rem] items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--workbench-divider)_86%,transparent)] bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] px-2.5 text-[0.68rem] font-medium text-[var(--muted)] transition-[background-color,border-color,color,box-shadow] hover:border-[color-mix(in_srgb,var(--workbench-divider)_96%,transparent)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)] disabled:pointer-events-none disabled:opacity-50',
        active &&
          'border-[color-mix(in_srgb,var(--accent)_16%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,white_92%)] text-[var(--foreground)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_8%,transparent)]',
        className
      )}
      data-active={active}
      type={type}
      {...props}
    >
      {React.Children.map(children, child =>
        React.isValidElement(child) && child.type === TextTabMeta ? (
          child
        ) : (
          <span
            className={cn(
              'underline-offset-4 decoration-current/25'
            )}
          >
            {child}
          </span>
        )
      )}
    </button>
  )
}

export { TextTab, TextTabMeta }

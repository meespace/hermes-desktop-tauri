import type { ReactNode } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'

export function ErrorIcon({ className, size = '1.75rem' }: { className?: string; size?: string }) {
  return <Codicon className={cn('text-[var(--danger)]', className)} name="error" size={size} />
}

export interface ErrorStateProps {
  children?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ReactNode
  title: ReactNode
}

export function ErrorState({ children, className, description, icon, title }: ErrorStateProps) {
  return (
    <div className={cn('grid gap-5', className)}>
      <div className="flex flex-col items-center gap-3 text-center">
        {icon ?? <ErrorIcon />}
        {typeof title === 'string' ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : title}
        {typeof description === 'string' ? (
          <p className="max-w-prose text-sm leading-5 text-[var(--muted)]">{description}</p>
        ) : (
          description
        )}
      </div>

      {children ? <div className="grid gap-2">{children}</div> : null}
    </div>
  )
}

import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const overlayCardClass =
  'rounded-[min(28px,var(--radius-3xl))] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--surface-shadow)]'

interface OverlayCardProps extends ComponentProps<'div'> {
  children: ReactNode
}

interface OverlayActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'danger' | 'subtle'
}

export function OverlayCard({ children, className, ...props }: OverlayCardProps) {
  return (
    <div className={cn(overlayCardClass, className)} data-slot="overlay-card" {...props}>
      {children}
    </div>
  )
}

export function OverlayActionButton({
  children,
  className,
  tone = 'default',
  type = 'button',
  ...props
}: OverlayActionButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-8 items-center rounded-[calc(var(--radius)*1.25)] border px-3 text-xs font-medium transition-[background-color,color,border-color,box-shadow] disabled:cursor-default disabled:opacity-45',
        tone === 'default' &&
          'border-[var(--field-border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--field-shadow)] hover:bg-[var(--surface-hover)]',
        tone === 'subtle' &&
          'h-7 border-transparent px-2 text-[var(--muted)] hover:border-[var(--separator-secondary)] hover:bg-[var(--default)] hover:text-[var(--foreground)]',
        tone === 'danger' &&
          'h-7 border-transparent px-2 text-[var(--danger)] hover:border-[var(--danger-soft)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]',
        className
      )}
      data-slot="overlay-action-button"
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}

interface OverlayIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function OverlayIconButton({ children, className, type = 'button', ...props }: OverlayIconButtonProps) {
  return (
    <OverlayActionButton
      className={cn('h-7 w-7 justify-center rounded-xl px-0 [&_svg]:size-4', className)}
      data-slot="overlay-icon-button"
      tone="subtle"
      type={type}
      {...props}
    >
      {children}
    </OverlayActionButton>
  )
}

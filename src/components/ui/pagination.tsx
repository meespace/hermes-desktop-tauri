import * as React from 'react'

import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="pagination"
      className={cn('pagination pagination--sm mx-auto w-full', className)}
      data-slot="pagination"
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul className={cn('pagination__content', className)} data-slot="pagination-content" {...props} />
  )
}

function PaginationItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('pagination__item', className)} data-slot="pagination-item" {...props} />
}

interface PaginationButtonProps extends React.ComponentProps<'button'> {
  isActive?: boolean
}

function PaginationButton({ className, isActive, ...props }: PaginationButtonProps) {
  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'pagination__link',
        className
      )}
      data-active={isActive}
      data-slot="pagination-button"
      type="button"
      {...props}
    />
  )
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      aria-label="Go to previous page"
      className={cn(
        'pagination__link pagination__link--nav',
        className
      )}
      data-slot="pagination-previous"
      type="button"
      {...props}
    >
      <Codicon name="chevron-left" size="0.75rem" />
      <span>Prev</span>
    </button>
  )
}

function PaginationNext({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      aria-label="Go to next page"
      className={cn(
        'pagination__link pagination__link--nav',
        className
      )}
      data-slot="pagination-next"
      type="button"
      {...props}
    >
      <span>Next</span>
      <Codicon name="chevron-right" size="0.75rem" />
    </button>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      className={cn('pagination__ellipsis', className)}
      data-slot="pagination-ellipsis"
      {...props}
    >
      <Codicon name="ellipsis" size="0.75rem" />
    </span>
  )
}

export {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
}

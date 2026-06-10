import type { ComponentProps, ElementType, FC } from 'react'
import { Streamdown } from 'streamdown'

import { ExternalLink, ExternalLinkIcon } from '@/lib/external-link'
import { cn } from '@/lib/utils'

// Compact markdown renderer for tool detail bodies. Same Streamdown pipeline
// as the file preview pane, with tighter typography and external-link routing
// so tools that emit markdown (tables, headings, links) render properly
// instead of being dumped as raw text.

const TAG_CLASSES = {
  blockquote:
    'mt-2 mb-2 rounded-r-[calc(var(--radius)*1.25)] border-l-2 border-[var(--border)] pl-2.5 italic text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]',
  h1: 'mt-3 mb-1.5 text-sm font-semibold tracking-tight text-foreground first:mt-0',
  h2: 'mt-3 mb-1.5 text-[0.82rem] font-semibold tracking-tight text-foreground first:mt-0',
  h3: 'mt-2.5 mb-1 text-[0.78rem] font-semibold text-foreground first:mt-0',
  h4: 'mt-2 mb-1 text-[0.74rem] font-semibold text-foreground first:mt-0',
  hr: 'my-2 border-[var(--separator)]',
  li: 'marker:text-[color-mix(in_srgb,var(--foreground)_52%,transparent)]',
  ol: 'mb-2 list-decimal pl-5 last:mb-0',
  p: 'mb-1.5 leading-relaxed last:mb-0',
  pre: 'mb-2 overflow-x-auto rounded-[calc(var(--radius)*1.5)] border border-[var(--border)] bg-[var(--surface-secondary)] p-2 font-mono text-[0.7rem] leading-[1.55] shadow-[var(--field-shadow)] last:mb-0',
  td: 'px-2 py-1 align-top leading-snug',
  th: 'px-2 py-1 text-left text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]',
  thead: 'bg-[var(--surface-secondary)]',
  ul: 'mb-2 list-disc pl-5 last:mb-0'
} as const

function tagged<T extends keyof typeof TAG_CLASSES>(Tag: T) {
  const Component = (({ className, ...rest }: ComponentProps<T>) => {
    const Element = Tag as ElementType

    return <Element className={cn(TAG_CLASSES[Tag], className)} {...rest} />
  }) as FC<ComponentProps<T>>

  Component.displayName = `Md.${Tag}`

  return Component
}

function MarkdownAnchor({ children, className, href, ...rest }: ComponentProps<'a'>) {
  if (!href || !/^https?:\/\//i.test(href)) {
    return (
      <a
        className={cn('font-medium underline underline-offset-4 decoration-current/20', className)}
        href={href}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <ExternalLink className={cn('decoration-current/20', className)} href={href} showExternalIcon={false}>
      {children}
      <ExternalLinkIcon />
    </ExternalLink>
  )
}

function MarkdownCode({ className, ...rest }: ComponentProps<'code'>) {
  return (
    <code
      className={cn(
        'rounded-[calc(var(--radius)*0.85)] bg-[var(--default-soft)] px-1 py-px font-mono text-[0.86em] text-[var(--default-soft-foreground)]',
        className
      )}
      {...rest}
    />
  )
}

function MarkdownTable({ className, ...rest }: ComponentProps<'table'>) {
  return (
    <div className="mb-2 max-w-full overflow-x-auto rounded-[calc(var(--radius)*1.5)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--field-shadow)] last:mb-0">
      <table
        className={cn(
          'w-full border-collapse text-[0.72rem] [&_tr]:border-b [&_tr]:border-[var(--separator)] last:[&_tr]:border-0',
          className
        )}
        {...rest}
      />
    </div>
  )
}

const COMPONENTS = {
  a: MarkdownAnchor,
  blockquote: tagged('blockquote'),
  code: MarkdownCode,
  h1: tagged('h1'),
  h2: tagged('h2'),
  h3: tagged('h3'),
  h4: tagged('h4'),
  hr: tagged('hr'),
  li: tagged('li'),
  ol: tagged('ol'),
  p: tagged('p'),
  pre: tagged('pre'),
  table: MarkdownTable,
  td: tagged('td'),
  th: tagged('th'),
  thead: tagged('thead'),
  ul: tagged('ul')
}

export function CompactMarkdown({ className, text }: { className?: string; text: string }) {
  return (
    <div
      className={cn(
        'max-w-full text-xs leading-relaxed text-[color-mix(in_srgb,var(--foreground)_72%,transparent)] wrap-anywhere',
        className
      )}
    >
      <Streamdown components={COMPONENTS as any} controls={false} mode="static" parseIncompleteMarkdown={false}>
        {text}
      </Streamdown>
    </div>
  )
}

import type { ReactNode, RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { Loader2, Search } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface SearchFieldProps {
  placeholder: string
  value: string
  onChange: (value: string) => void
  containerClassName?: string
  inputClassName?: string
  loading?: boolean
  onClear?: () => void
  inputRef?: RefObject<HTMLInputElement | null>
  trailingAction?: ReactNode
  'aria-label'?: string
}

export function SearchField({
  placeholder,
  value,
  onChange,
  containerClassName,
  inputClassName,
  loading = false,
  onClear,
  inputRef,
  trailingAction,
  'aria-label': ariaLabel
}: SearchFieldProps) {
  const { t } = useI18n()
  const clear = onClear ?? (() => onChange(''))

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 border-b border-transparent px-0.5 transition-colors focus-within:border-[var(--border-strong)]',
        containerClassName
      )}
    >
      <Search className="pointer-events-none size-3.5 shrink-0 text-[var(--muted)]" />
      <input
        aria-label={ariaLabel}
        className={cn(
          'h-7 max-w-full bg-transparent text-sm text-foreground [field-sizing:content] placeholder:text-[var(--muted)] focus:outline-none',
          inputClassName
        )}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        ref={inputRef}
        type="text"
        value={value}
      />
      {trailingAction}
      {loading ? (
        <Loader2 className="pointer-events-none size-3.5 shrink-0 animate-spin text-[var(--muted)]" />
      ) : value ? (
        <Button
          aria-label={t.sidebar.clearSearch}
          className="shrink-0 text-[var(--muted)] hover:text-foreground"
          onClick={clear}
          size="icon-xs"
          variant="ghost"
        >
          <Codicon name="close" size="0.875rem" />
        </Button>
      ) : null}
    </div>
  )
}

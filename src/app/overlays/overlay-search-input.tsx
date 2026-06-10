import type { ReactNode, RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { Loader2, Search } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface OverlaySearchInputProps {
  placeholder: string
  value: string
  onChange: (value: string) => void
  containerClassName?: string
  inputClassName?: string
  loading?: boolean
  onClear?: () => void
  inputRef?: RefObject<HTMLInputElement | null>
  trailingAction?: ReactNode
}

export function OverlaySearchInput({
  placeholder,
  value,
  onChange,
  containerClassName,
  inputClassName,
  loading = false,
  onClear,
  inputRef,
  trailingAction
}: OverlaySearchInputProps) {
  const { t } = useI18n()
  const clear = onClear ?? (() => onChange(''))
  const hasTrailing = Boolean(trailingAction)

  return (
    <div className={cn('relative', containerClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 z-1 size-3.5 -translate-y-1/2 text-[var(--muted)]" />
      <Input
        className={cn(
          'relative z-0 h-8 rounded-[0.62rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] py-2 pl-8 text-[length:var(--conversation-text-font-size)] shadow-none',
          hasTrailing || loading || value ? 'pr-16' : 'pr-8',
          inputClassName
        )}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
      />
      <div className="absolute right-1.5 top-1/2 z-1 flex -translate-y-1/2 items-center gap-0.5">
        {trailingAction}
        {loading ? (
          <Loader2 className="pointer-events-none size-3.5 animate-spin text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]" />
        ) : value ? (
          <Button
            aria-label={t.sidebar.clearSearch}
            className="rounded-[0.65rem] border border-transparent text-[var(--muted)] hover:border-[var(--workbench-divider)] hover:bg-[var(--workbench-hover)] hover:text-[var(--foreground)]"
            onClick={clear}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name="close" size="0.875rem" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function PageSearchInput(props: OverlaySearchInputProps) {
  return (
    <OverlaySearchInput
      {...props}
      containerClassName={cn('mx-auto w-[min(36rem,calc(100%-2rem))] min-w-0', props.containerClassName)}
      inputClassName={cn('h-[1.8rem] rounded-[0.58rem] py-2 pl-8', props.inputClassName)}
    />
  )
}

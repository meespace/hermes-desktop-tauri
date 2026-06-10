import * as React from 'react'

import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Check, Copy, X } from '@/lib/icons'
import { cn } from '@/lib/utils'

type CopyPayload = string | (() => Promise<string> | string)
type CopyButtonAppearance = 'button' | 'icon' | 'inline' | 'menu-item' | 'tool-row'
type CopyStatus = 'copied' | 'error' | 'idle'
const COPIED_RESET_MS = 1_500

export async function writeClipboardText(text: string) {
  if (!text) {
    return
  }

  if (window.hermesDesktop?.writeClipboard) {
    await window.hermesDesktop.writeClipboard(text)

    return
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)

    return
  }

  throw new Error('Clipboard API is unavailable')
}

export interface CopyButtonProps {
  appearance?: CopyButtonAppearance
  buttonSize?: React.ComponentProps<typeof Button>['size']
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  errorMessage?: string
  haptic?: boolean
  iconClassName?: string
  label?: string
  onCopied?: () => void
  onCopyError?: (error: unknown) => void
  preventDefault?: boolean
  showLabel?: boolean
  stopPropagation?: boolean
  text: CopyPayload
  title?: string
}

export function CopyButton({
  appearance = 'button',
  buttonSize,
  buttonVariant = 'ghost',
  children,
  className,
  disabled = false,
  errorMessage,
  haptic = true,
  iconClassName,
  label,
  onCopied,
  onCopyError,
  preventDefault = false,
  showLabel,
  stopPropagation = false,
  text,
  title
}: CopyButtonProps) {
  const { t } = useI18n()
  const resolvedErrorMessage = errorMessage ?? t.common.copyFailed
  const resolvedLabel = label ?? t.common.copy
  const [status, setStatus] = React.useState<CopyStatus>('idle')
  const resetRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (resetRef.current !== null) {
        window.clearTimeout(resetRef.current)
      }
    }
  }, [])

  const copy = React.useCallback(
    async (event?: Event | React.MouseEvent<HTMLElement>) => {
      if (preventDefault) {
        event?.preventDefault()
      }

      if (stopPropagation) {
        event?.stopPropagation()
      }

      try {
        const value = typeof text === 'function' ? await text() : text

        if (!value) {
          return
        }

        await writeClipboardText(value)

        if (haptic) {
          triggerHaptic('selection')
        }

        if (resetRef.current !== null) {
          window.clearTimeout(resetRef.current)
        }

        setStatus('copied')
        resetRef.current = window.setTimeout(() => {
          setStatus('idle')
          resetRef.current = null
        }, COPIED_RESET_MS)
        onCopied?.()
      } catch (error) {
        onCopyError?.(error)

        if (resetRef.current !== null) {
          window.clearTimeout(resetRef.current)
        }

        setStatus('error')
        resetRef.current = window.setTimeout(() => {
          setStatus('idle')
          resetRef.current = null
        }, COPIED_RESET_MS)
      }
    },
    [haptic, onCopied, onCopyError, preventDefault, stopPropagation, text]
  )

  const Icon = status === 'copied' ? Check : status === 'error' ? X : Copy
  const icon = <Icon className={cn('size-3.5', iconClassName)} />

  const visibleChildren =
    (showLabel ?? (appearance !== 'icon' && appearance !== 'tool-row'))
      ? status === 'copied'
        ? t.common.copied
        : status === 'error'
          ? t.common.failed
          : (children ?? resolvedLabel)
      : null

  const content = (
    <>
      {icon}
      {visibleChildren}
    </>
  )

  const feedbackLabel =
    status === 'copied' ? t.common.copied : status === 'error' ? resolvedErrorMessage : (title ?? resolvedLabel)
  const ariaLabel = status === 'idle' ? resolvedLabel : feedbackLabel

  if (appearance === 'menu-item') {
    return (
      <DropdownMenuItem
        className={className}
        disabled={disabled}
        onSelect={event => {
          event.preventDefault()
          void copy(event)
        }}
      >
        {content}
      </DropdownMenuItem>
    )
  }

  if (appearance === 'inline') {
    return (
      <button
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.75rem] text-[var(--muted)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-foreground disabled:opacity-40',
          className
        )}
        disabled={disabled}
        onClick={event => void copy(event)}
        title={feedbackLabel}
        type="button"
      >
        {content}
      </button>
    )
  }

  if (appearance === 'tool-row') {
    return (
      <button
        aria-label={ariaLabel}
        className={cn(
          'grid size-6 place-items-center rounded-[calc(var(--radius)*1.25)] border border-transparent text-[var(--muted)] opacity-0 transition-[opacity,background-color,border-color,color] hover:border-[var(--border)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] focus-visible:opacity-100 group-hover/tool-row:opacity-100 disabled:opacity-40',
          className
        )}
        disabled={disabled}
        onClick={event => void copy(event)}
        title={feedbackLabel}
        type="button"
      >
        {icon}
      </button>
    )
  }

  return (
    <Button
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      onClick={event => void copy(event)}
      size={buttonSize ?? (appearance === 'icon' ? 'icon' : 'default')}
      title={feedbackLabel}
      type="button"
      variant={buttonVariant}
    >
      {content}
    </Button>
  )
}

import { type ReactNode, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

interface OverlayViewProps {
  children: ReactNode
  onClose: () => void
  closeLabel?: string
  contentClassName?: string
  headerContent?: ReactNode
  rootClassName?: string
}

export function OverlayView({
  children,
  onClose,
  closeLabel = 'Close',
  contentClassName,
  headerContent,
  rootClassName
}: OverlayViewProps) {
  const closeOverlay = () => {
    triggerHaptic('close')
    onClose()
  }

  // Esc dismisses every OverlayView-based overlay. Nested Radix dialogs
  // stop propagation themselves, so opening (e.g.) the model picker inside
  // Settings still closes the picker first instead of the underlying overlay.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return
      }

      event.preventDefault()
      triggerHaptic('close')
      onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      data-slot="overlay-view-backdrop"
      className="fixed inset-0 z-[1200] bg-backdrop p-2 backdrop-blur-xl sm:p-4 lg:p-6"
      onClick={event => {
        if (event.target === event.currentTarget) {
          closeOverlay()
        }
      }}
      role="presentation"
    >
      <div
        data-slot="overlay-view-root"
        className={cn(
          'relative mx-auto flex h-full min-h-0 w-full max-w-[min(96rem,100%)] flex-col overflow-hidden rounded-[min(34px,var(--radius-3xl))] border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-[color-mix(in_srgb,var(--overlay)_95%,white_5%)] text-[var(--foreground)] shadow-[var(--overlay-shadow)]',
          rootClassName
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_color-mix(in_srgb,white_78%,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_8%,white_10%),transparent)]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[calc(var(--titlebar-height)+0.1875rem)] [-webkit-app-region:drag]">
          {headerContent && (
            <div className="pointer-events-auto absolute left-1/2 top-[calc(1rem+var(--titlebar-height)/2)] -translate-x-1/2 -translate-y-1/2 [-webkit-app-region:no-drag]">
              {headerContent}
            </div>
          )}

          <Button
            aria-label={closeLabel}
            className="pointer-events-auto absolute right-3 top-[calc(0.1875rem+var(--titlebar-height)/2)] -translate-y-1/2 rounded-[calc(var(--radius)*1.5)] border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] text-muted shadow-[var(--field-shadow)] [-webkit-app-region:no-drag]"
            data-slot="overlay-view-close"
            onClick={closeOverlay}
            size="icon-xs"
            variant="secondary"
          >
            <Codicon name="close" size="1rem" />
          </Button>
        </div>

        <div className={cn('min-h-0 flex flex-1 flex-col pt-(--titlebar-height)', contentClassName)}>{children}</div>
      </div>
    </div>
  )
}

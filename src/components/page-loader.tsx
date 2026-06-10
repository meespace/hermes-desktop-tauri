import type { ComponentProps } from 'react'

import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

interface PageLoaderProps extends Omit<ComponentProps<'div'>, 'children'> {
  label?: string
}

export function PageLoader({
  'aria-label': ariaLabel,
  className,
  label,
  role = 'status',
  ...props
}: PageLoaderProps) {
  const { t } = useI18n()
  const displayLabel = label ?? t.appLoader.label

  return (
    <div
      {...props}
      aria-label={ariaLabel ?? displayLabel}
      className={cn('grid h-full min-h-0 place-items-center px-4 py-6', className)}
      role={role}
    >
      <div className="flex w-full max-w-[18rem] flex-col items-center rounded-[0.95rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_88%,white_12%)] px-4 py-3.5 text-center shadow-[var(--field-shadow)]">
        <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_12%,transparent)] bg-[color-mix(in_srgb,var(--surface)_86%,white_14%)] px-3 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent)]" />
          {t.appLoader.label}
        </span>
        <Loader
          aria-hidden="true"
          className="mt-3 size-9 text-primary/70"
          pathSteps={220}
          role="presentation"
          strokeScale={0.72}
          type="rose-curve"
        />
        <div className="mt-3 text-[0.8rem] font-medium tracking-[-0.02em] text-[var(--foreground)]">{displayLabel}</div>
        <div className="mt-1 text-[0.68rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]">
          {t.appLoader.description}
        </div>
      </div>
    </div>
  )
}

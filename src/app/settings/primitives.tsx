import type { ReactNode } from 'react'

import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import type { IconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'

export function SettingsContent({ children }: { children: ReactNode }) {
  return (
    <section className="h-full min-h-0 overflow-hidden" data-slot="settings-content">
      <div className="scrollbar-dt h-full min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-2.5 pb-16 sm:px-5 sm:pt-3 sm:pb-18">
        <div className="mx-auto grid min-h-full w-full max-w-[66rem] content-start gap-4">{children}</div>
      </div>
    </section>
  )
}

export function Pill({ tone = 'muted', children }: { tone?: 'danger' | 'muted' | 'primary'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-5 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.64rem] font-medium tracking-[0.01em]',
        tone === 'primary'
          ? 'border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-[var(--workbench-active)] text-[var(--accent-soft-foreground)]'
          : tone === 'danger'
            ? 'border-[color-mix(in_srgb,var(--danger)_18%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)]'
          : 'border-[var(--workbench-divider)] bg-[var(--surface-secondary)] text-[var(--default-soft-foreground)]'
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeading({ icon: Icon, title, meta }: { icon: IconComponent; title: string; meta?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3 pt-0.5 text-[var(--foreground)]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[0.6rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--surface-secondary)] text-[var(--muted)]">
        <Icon className="size-[0.95rem]" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.93rem] font-semibold tracking-[-0.025em] text-[var(--foreground)]">{title}</span>
          {meta && <Pill>{meta}</Pill>}
        </span>
      </span>
    </div>
  )
}

export function NavLink({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: IconComponent
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      className={cn(
        'flex min-h-[2.125rem] w-full justify-start gap-2 rounded-[0.66rem] border px-2.5 text-left text-[0.8rem] transition-[background-color,color,box-shadow,border-color]',
        active
          ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--field-shadow)]'
          : 'border-transparent text-[var(--muted)] hover:bg-[var(--workbench-hover)] hover:text-[var(--foreground)]'
      )}
      data-slot="settings-nav-link"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Button>
  )
}

export function ListRow({
  title,
  description,
  hint,
  action,
  below,
  wide = false
}: {
  title: ReactNode
  description?: ReactNode
  hint?: ReactNode
  action?: ReactNode
  below?: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-3 rounded-[0.7rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,21rem)] sm:items-center',
        wide && 'sm:grid-cols-1 sm:items-start'
      )}
      data-slot="settings-list-row"
    >
      <div className="min-w-0">
        <div className="text-[0.84rem] font-medium tracking-[-0.018em] text-[var(--foreground)]">{title}</div>
        {description && (
          <div className="mt-1 text-[0.71rem] leading-5.5 text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
            {description}
          </div>
        )}
        {hint && (
          <div className="mt-1 block font-mono text-[0.63rem] text-[color-mix(in_srgb,var(--foreground)_44%,transparent)]">
            {hint}
          </div>
        )}
        {below}
      </div>
      {action && <div className={cn('min-w-0', !wide && 'sm:justify-self-end')}>{action}</div>}
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return <PageLoader label={label} />
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-48 place-items-center text-center">
      <div>
        <div className="text-sm font-medium text-[var(--foreground)]">{title}</div>
        <div className="mt-1 text-xs text-[var(--muted)]">{description}</div>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

import type { IconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface OverlaySplitLayoutProps {
  children: ReactNode
  className?: string
}

interface OverlaySidebarProps {
  children: ReactNode
  className?: string
}

interface OverlayMainProps {
  children: ReactNode
  className?: string
}

interface OverlayNavItemProps {
  active: boolean
  icon: IconComponent
  label: string
  onClick: () => void
  trailing?: ReactNode
}

export function OverlaySplitLayout({ children, className }: OverlaySplitLayoutProps) {
  return (
    <div
      data-slot="overlay-split-layout"
      className={cn(
        'grid h-full min-h-0 flex-1 grid-cols-[15.75rem_minmax(0,1fr)] overflow-hidden bg-transparent max-[52rem]:grid-cols-1',
        className
      )}
    >
      {children}
    </div>
  )
}

export function OverlaySidebar({ children, className }: OverlaySidebarProps) {
  return (
    <aside
      data-slot="overlay-sidebar"
      className={cn(
        'scrollbar-dt flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_94%,white_6%),color-mix(in_srgb,var(--background-secondary)_90%,white_10%))] px-3.5 py-3.5 shadow-[inset_-0.0625rem_0_0_color-mix(in_srgb,var(--foreground)_4%,transparent)]',
        className
      )}
    >
      {children}
    </aside>
  )
}

export function OverlayMain({ children, className }: OverlayMainProps) {
  return (
    <main
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background-secondary)_94%,white_6%),color-mix(in_srgb,var(--background)_98%,var(--accent-soft)_2%))] p-4',
        className
      )}
      data-slot="overlay-main"
    >
      {children}
    </main>
  )
}

export function OverlayNavItem({ active, icon: Icon, label, onClick, trailing }: OverlayNavItemProps) {
  return (
    <button
      data-slot="overlay-nav-item"
      className={cn(
        'flex min-h-10 w-full items-center justify-start gap-2.5 rounded-[calc(var(--radius)*1.7)] border px-2.5 py-1.5 text-left text-sm font-medium transition-[background-color,color,box-shadow,border-color]',
        active
          ? 'border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_10%,white_90%)] text-[var(--foreground)] shadow-[var(--field-shadow)]'
          : 'border-transparent bg-transparent text-[color-mix(in_srgb,var(--foreground)_74%,transparent)] hover:border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] hover:text-[var(--foreground)]'
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)*1.3)] border transition-[background-color,border-color,color]',
          active
            ? 'border-[color-mix(in_srgb,var(--accent)_14%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,white_90%)] text-[var(--accent)]'
            : 'border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[color-mix(in_srgb,var(--surface)_76%,transparent)] text-[var(--muted)]'
        )}
      >
        <Icon className="size-4 shrink-0" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  )
}

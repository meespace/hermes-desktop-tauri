import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { $sidebarOpen, setSidebarOpen } from '@/store/layout'

import { PageSearchInput } from './overlays/overlay-search-input'

interface PageSearchShellProps extends React.ComponentProps<'section'> {
  children: ReactNode
  filters?: ReactNode
  headerTitle?: ReactNode
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  showSidebarRestoreButton?: boolean
  searchTrailingAction?: ReactNode
  searchValue: string
}

export function PageSearchShell({
  children,
  className,
  filters,
  headerTitle,
  onSearchChange,
  searchPlaceholder,
  showSidebarRestoreButton = false,
  searchTrailingAction,
  searchValue,
  ...props
}: PageSearchShellProps) {
  const { t } = useI18n()
  const sidebarOpen = useStore($sidebarOpen)
  const showSidebarButton = showSidebarRestoreButton && !sidebarOpen

  return (
    <section
      {...props}
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden bg-[var(--workbench-shell-bg)] p-1 pt-1',
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--workbench-panel-radius)] border border-[var(--workbench-panel-stroke)] bg-[var(--workbench-panel-bg)] shadow-[var(--workbench-shadow)]">
        {/*
          This header sits under fixed titlebar controls and still overlaps the
          shell drag region, so it must stay no-drag for reliable input focus.
        */}
        <div className="relative z-10 grid gap-2.5 border-b border-[var(--workbench-divider)] bg-[var(--workbench-panel-muted-bg)] px-3 py-3 [-webkit-app-region:no-drag]">
          {headerTitle ? (
            <div
              className="min-h-8"
              style={{
                paddingRight:
                  'max(0px, calc(var(--titlebar-tools-right, 0px) + var(--titlebar-tools-width, 0px) - 0.75rem))'
              }}
            >
              <div className="mx-auto flex w-full max-w-[70rem] items-center gap-2 px-0.5">
                {showSidebarButton ? (
                  <button
                    aria-label={t.shell.showSidebar}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-[0.75rem] border border-[var(--workbench-divider)] bg-[var(--workbench-panel-bg)] text-[color-mix(in_srgb,var(--foreground)_68%,transparent)] shadow-[var(--field-shadow)] transition-[background-color,border-color,color] hover:border-[color-mix(in_srgb,var(--accent)_20%,transparent)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)]"
                    onClick={() => {
                      triggerHaptic('tap')
                      setSidebarOpen(true)
                    }}
                    title={t.shell.showSidebar}
                    type="button"
                  >
                    <Codicon name="layout-sidebar-left" size="0.95rem" />
                  </button>
                ) : null}
                <h1 className="truncate text-[1.02rem] font-semibold leading-6 tracking-[-0.024em] text-[var(--foreground)]">
                  {headerTitle}
                </h1>
              </div>
            </div>
          ) : null}
          <div
            style={{
              paddingRight:
                'max(0px, calc(var(--titlebar-tools-right, 0px) + var(--titlebar-tools-width, 0px) - 0.75rem))'
            }}
          >
            <div className="mx-auto w-full max-w-[70rem]">
              <PageSearchInput
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                trailingAction={searchTrailingAction}
                value={searchValue}
              />
            </div>
          </div>
          {filters ? <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-2">{filters}</div> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--workbench-canvas-bg)]">{children}</div>
      </div>
    </section>
  )
}

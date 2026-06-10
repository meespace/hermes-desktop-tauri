import type * as React from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import type { SessionInfo } from '@/hermes'
import { useI18n } from '@/i18n'
import { sessionTitle } from '@/lib/chat-runtime'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

import { SessionActionsMenu, SessionContextMenu } from './session-actions-menu'

interface SidebarSessionRowProps extends React.ComponentProps<'div'> {
  session: SessionInfo
  isPinned: boolean
  isSelected: boolean
  isWorking: boolean
  onArchive: () => void
  onDelete: () => void
  onPin: () => void
  onResume: () => void
  reorderable?: boolean
  dragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
}

const AGE_TICKS: ReadonlyArray<[number, string]> = [
  [86_400_000, 'd'],
  [3_600_000, 'h'],
  [60_000, 'm']
]

function formatAge(seconds: number): string {
  const delta = Math.max(0, Date.now() - seconds * 1000)

  for (const [ms, suffix] of AGE_TICKS) {
    if (delta >= ms) {
      return `${Math.floor(delta / ms)}${suffix}`
    }
  }

  return 'now'
}

export function SidebarSessionRow({
  session,
  isPinned,
  isSelected,
  isWorking,
  onArchive,
  onDelete,
  onPin,
  onResume,
  reorderable = false,
  dragging = false,
  dragHandleProps,
  className,
  style,
  ref,
  ...rest
}: SidebarSessionRowProps) {
  const { t } = useI18n()
  const title = sessionTitle(session)
  const age = formatAge(session.last_active || session.started_at)
  const handleLabel = t.sessionActions.actionsFor(title)

  return (
    <SessionContextMenu
      onArchive={onArchive}
      onDelete={onDelete}
      onPin={onPin}
      pinned={isPinned}
      profile={session.profile}
      sessionId={session.id}
      title={title}
    >
      <div
        className={cn(
          'heroui-session-row group',
          isSelected && 'is-selected',
          isWorking && 'is-working',
          dragging && 'is-dragging',
          className
        )}
        data-working={isWorking ? 'true' : undefined}
        ref={ref}
        style={style}
        {...rest}
      >
        {isWorking && <span aria-hidden="true" className="arc-border" />}
        <button
          className="heroui-session-row-main"
          onClick={event => {
            if (event.shiftKey) {
              event.preventDefault()
              event.stopPropagation()
              triggerHaptic('selection')
              onPin()

              return
            }

            if (event.metaKey || event.ctrlKey) {
              event.preventDefault()
              event.stopPropagation()
              triggerHaptic('selection')
              onArchive()

              return
            }

            onResume()
          }}
          type="button"
        >
          {reorderable ? (
            <span
              {...dragHandleProps}
              aria-label={handleLabel}
              className="relative -my-0.5 grid w-4 shrink-0 cursor-grab touch-none place-items-center self-stretch overflow-hidden active:cursor-grabbing"
              onClick={event => event.stopPropagation()}
            >
              <SidebarRowDot
                className="transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
                isWorking={isWorking}
              />
              <Codicon
                className={cn(
                  'absolute text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-75 group-focus-within:opacity-75 hover:text-foreground',
                  dragging && 'text-foreground opacity-100'
                )}
                name="grabber"
                size="0.75rem"
              />
            </span>
          ) : (
            <span className="grid w-4 shrink-0 place-items-center overflow-hidden">
              <SidebarRowDot isWorking={isWorking} />
            </span>
          )}
          <span className="heroui-session-title group-data-[working=true]:text-foreground/90">
            {title}
          </span>
        </button>
        <div className="relative z-2 grid w-[1.65rem] place-items-center pr-1">
          {!isWorking && (
            <span className="pointer-events-none absolute right-7 top-1/2 min-w-6 -translate-y-1/2 text-right text-[0.6rem] leading-none text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100">
              {age}
            </span>
          )}
          <SessionActionsMenu
            onArchive={onArchive}
            onDelete={onDelete}
            onPin={onPin}
            pinned={isPinned}
            profile={session.profile}
            sessionId={session.id}
            title={title}
          >
            <Button
              aria-label={t.sessionActions.actionsFor(title)}
              className="heroui-session-action [&_svg]:size-3.5!"
              size="icon"
              title={t.sessionActions.sessionActions}
              variant="ghost"
            >
              <Codicon name="ellipsis" size="0.875rem" />
            </Button>
          </SessionActionsMenu>
        </div>
      </div>
    </SessionContextMenu>
  )
}

function SidebarRowDot({ isWorking, className }: { isWorking: boolean; className?: string }) {
  const { t } = useI18n()

  return (
    <span
      aria-label={isWorking ? t.sessionActions.sessionRunning : undefined}
      className={cn(
        'heroui-session-marker',
        isWorking
          ? "is-working relative before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-[var(--accent)] before:opacity-70 before:content-['']"
          : '',
        className
      )}
      role={isWorking ? 'status' : undefined}
    />
  )
}

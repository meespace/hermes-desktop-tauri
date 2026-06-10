import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { writeClipboardText } from '@/components/ui/copy-button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { DesktopUpdateCommit, DesktopUpdateStage, DesktopUpdateStatus } from '@/global'
import { useI18n } from '@/i18n'
import { buildCommitChangelog, type CommitGroup } from '@/lib/commit-changelog'
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, Sparkles, Terminal } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $updateApply,
  $updateChecking,
  $updateOverlayOpen,
  $updateStatus,
  applyUpdates,
  checkUpdates,
  resetUpdateApplyState,
  setUpdateOverlayOpen,
  type UpdateApplyState
} from '@/store/updates'

const UPDATE_PANEL =
  'rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--surface-shadow)]'

function totalItems(groups: readonly CommitGroup[]) {
  return groups.reduce((sum, g) => sum + g.items.length, 0)
}

export function UpdatesOverlay() {
  const open = useStore($updateOverlayOpen)
  const status = useStore($updateStatus)
  const checking = useStore($updateChecking)
  const apply = useStore($updateApply)

  useEffect(() => {
    if (open && !status && !checking) {
      void checkUpdates()
    }
  }, [checking, open, status])

  const behind = status?.behind ?? 0

  const phase: 'idle' | 'applying' | 'manual' | 'done' | 'error' =
    apply.stage === 'manual'
      ? 'manual'
      : apply.stage === 'done'
        ? 'done'
      : apply.applying || apply.stage === 'restart'
        ? 'applying'
        : apply.stage === 'error'
          ? 'error'
          : 'idle'

  const handleClose = (next: boolean) => {
    if (phase === 'applying') {
      return
    }

    setUpdateOverlayOpen(next)

    if (!next && (apply.stage === 'error' || apply.stage === 'restart' || apply.stage === 'manual' || apply.stage === 'done')) {
      resetUpdateApplyState()
    }
  }

  const handleInstall = () => {
    void applyUpdates()
  }

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent
        className="max-w-sm gap-0 overflow-hidden border-[var(--border)] bg-[var(--overlay)] p-0 shadow-[var(--overlay-shadow)]"
        showCloseButton={phase !== 'applying'}
      >
        {phase === 'applying' && <ApplyingView apply={apply} />}

        {phase === 'manual' && (
          <ManualView command={apply.command ?? 'hermes update'} onDone={() => handleClose(false)} />
        )}

        {phase === 'error' && (
          <ErrorView message={apply.message} onDismiss={() => handleClose(false)} onRetry={handleInstall} />
        )}

        {phase === 'done' && <DoneView message={apply.message} onDone={() => handleClose(false)} />}

        {phase === 'idle' && (
          <IdleView
            behind={behind}
            checking={checking}
            commits={status?.commits ?? []}
            onInstall={handleInstall}
            onLater={() => handleClose(false)}
            onRetryCheck={() => void checkUpdates()}
            status={status}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function IdleView({
  behind,
  checking,
  commits,
  onInstall,
  onLater,
  onRetryCheck,
  status
}: {
  behind: number
  checking: boolean
  commits: readonly DesktopUpdateCommit[]
  onInstall: () => void
  onLater: () => void
  onRetryCheck: () => void
  status: DesktopUpdateStatus | null
}) {
  const { t } = useI18n()

  if (!status && checking) {
    return (
      <CenteredStatus icon={<Loader2 className="size-6 animate-spin text-primary" />} title={t.updates.looking} />
    )
  }

  if (!status) {
    return (
      <CenteredStatus
        action={
          <Button onClick={onRetryCheck} size="sm">
            {t.updates.tryAgain}
          </Button>
        }
        icon={<AlertCircle className="size-6 text-[var(--muted)]" />}
        title={t.updates.checkFailed}
      />
    )
  }

  if (!status.supported) {
    return (
      <CenteredStatus
        action={
          <Button onClick={onLater} size="sm" variant="outline">
            {t.updates.close}
          </Button>
        }
        body={status.message ?? t.updates.notAvailableBody}
        icon={<AlertCircle className="size-6 text-[var(--muted)]" />}
        title={t.updates.notAvailable}
      />
    )
  }

  if (status.error) {
    return (
      <CenteredStatus
        action={
          <Button disabled={checking} onClick={onRetryCheck} size="sm">
            {t.updates.tryAgain}
          </Button>
        }
        body={t.updates.connectionHint}
        icon={<AlertCircle className="size-6 text-[var(--muted)]" />}
        title={t.updates.checkFailed}
      />
    )
  }

  if (status.reason === 'packaged-updater') {
    return (
      <CenteredStatus
        action={
          <div className="flex gap-2">
            <Button className="h-10 text-sm font-semibold" onClick={onInstall}>
              {t.updates.updateNow}
            </Button>
            <Button onClick={onLater} size="sm" variant="outline">
              {t.updates.close}
            </Button>
          </div>
        }
        body={
          status.message ??
          t.updates.bundledReadyBody
        }
        icon={<Sparkles className="size-6 text-primary" />}
        title={t.updates.bundledReady}
      />
    )
  }

  if (behind === 0) {
    return (
      <CenteredStatus
        action={
          <Button onClick={onLater} size="sm" variant="outline">
            {t.updates.close}
          </Button>
        }
        body={t.updates.latestBody}
        icon={<CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />}
        title={t.updates.allSet}
      />
    )
  }

  const groups = buildCommitChangelog(commits)
  const shownItems = totalItems(groups)
  const remaining = Math.max(0, behind - shownItems)

  return (
    <div className="grid gap-5 px-6 pb-6 pt-7 pr-8" data-slot="updates-overlay-idle">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-[calc(var(--radius)*2)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--field-shadow)]">
          <Sparkles className="size-7" />
        </span>

        <DialogTitle className="text-center text-xl">{t.updates.newAvailable}</DialogTitle>
        <DialogDescription className="text-center text-sm">
          {t.updates.newAvailableBody}
        </DialogDescription>
      </div>

      <div className={cn('grid gap-3 px-4 py-3', UPDATE_PANEL)} data-slot="updates-overlay-summary-panel">
        {groups.map(group => (
          <div key={group.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{group.label}</p>
            <ul className="mt-1.5 grid gap-1.5 text-sm text-foreground">
              {group.items.map(item => (
                <li className="flex items-start gap-2" key={item}>
                  <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <Button className="h-10 text-sm font-semibold" onClick={onInstall} size="default">
          {t.updates.updateNow}
        </Button>
        <button
          className="text-center text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground"
          onClick={onLater}
          type="button"
        >
          {t.updates.maybeLater}
        </button>
      </div>

      {remaining > 0 && (
        <p className="text-center text-xs text-[var(--muted)]">
          {t.updates.moreChanges(remaining)}
        </p>
      )}
    </div>
  )
}

function ManualView({ command, onDone }: { command: string; onDone: () => void }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const commandLike = !/^Open https?:\/\//i.test(command.trim())

  const handleCopy = () => {
    void writeClipboardText(command).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="grid gap-5 px-6 pb-6 pt-7 pr-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-[calc(var(--radius)*2)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--field-shadow)]">
          <Terminal className="size-7" />
        </span>

        <DialogTitle className="text-center text-xl">{t.updates.manualTitle}</DialogTitle>
        <DialogDescription className="text-center text-sm">
          {t.updates.manualBody}
        </DialogDescription>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-secondary)]',
          UPDATE_PANEL
        )}
      >
        {commandLike ? (
          <code className="select-all font-mono text-sm text-foreground">
            <span className="text-[var(--muted)]">$ </span>
            {command}
          </code>
        ) : (
          <span className="select-all text-sm text-foreground">{command}</span>
        )}
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--muted)] transition-colors group-hover:text-foreground">
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {t.updates.copied}
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              {t.updates.copy}
            </>
          )}
        </span>
      </button>

      <p className="text-center text-xs text-[var(--muted)]">
        {t.updates.manualHint}
      </p>

      <Button className="h-10 text-sm font-semibold" onClick={onDone} variant="outline">
        {t.updates.done}
      </Button>
    </div>
  )
}

function ApplyingView({ apply }: { apply: UpdateApplyState }) {
  const { t } = useI18n()
  const label = t.updates.stages[apply.stage] ?? t.updates.stages.update

  const percent =
    typeof apply.percent === 'number' && Number.isFinite(apply.percent)
      ? Math.max(2, Math.min(100, Math.round(apply.percent)))
      : null

  return (
    <div className="grid gap-5 px-6 pb-6 pt-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative flex size-14 items-center justify-center rounded-[calc(var(--radius)*2)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--field-shadow)]">
          <Loader2 className="size-7 animate-spin" />
        </span>

        <DialogTitle className="text-center text-xl">{label}</DialogTitle>
        <DialogDescription className="text-center text-sm">
          {t.updates.applyingBody}
        </DialogDescription>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--default-soft)]">
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-[width] duration-300 ease-out',
            percent === null && 'w-1/3 animate-pulse'
          )}
          style={percent !== null ? { width: `${percent}%` } : undefined}
        />
      </div>

      <p className="text-center text-xs text-[var(--muted)]">{t.updates.applyingHint}</p>
    </div>
  )
}

function ErrorView({ message, onDismiss, onRetry }: { message: string; onDismiss: () => void; onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <div className="grid gap-5 px-6 pb-6 pt-7 pr-8" data-slot="updates-overlay-error">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-[calc(var(--radius)*2)] bg-[var(--danger-soft)] text-[var(--danger)] shadow-[var(--field-shadow)]">
          <AlertCircle className="size-7" />
        </span>

        <DialogTitle className="text-center text-xl">{t.updates.errorTitle}</DialogTitle>
        <DialogDescription className="text-center text-sm">
          {message || t.updates.errorBody}
        </DialogDescription>
      </div>

      <div className="grid gap-2">
        <Button className="h-10 text-sm font-semibold" onClick={onRetry}>
          {t.updates.tryAgain}
        </Button>
        <button
          className="text-center text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground"
          onClick={onDismiss}
          type="button"
        >
          {t.updates.notNow}
        </button>
      </div>
    </div>
  )
}

function DoneView({ message, onDone }: { message: string; onDone: () => void }) {
  const { t } = useI18n()

  return (
    <CenteredStatus
      action={
        <Button className="h-10 text-sm font-semibold" onClick={onDone} variant="outline">
          {t.updates.close}
        </Button>
      }
      body={message || t.updates.doneBody}
      icon={<CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />}
      title={t.updates.complete}
    />
  )
}

function CenteredStatus({
  action,
  body,
  icon,
  title
}: {
  action?: React.ReactNode
  body?: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="grid gap-4 px-6 pb-6 pt-8 pr-8" data-slot="updates-overlay-status">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-[calc(var(--radius)*2)] bg-[var(--surface-secondary)] shadow-[var(--field-shadow)]">
          {icon}
        </span>
        <DialogTitle className="text-center text-lg">{title}</DialogTitle>
        {body && <DialogDescription className="text-center text-sm">{body}</DialogDescription>}
      </div>

      {action && <div className="flex justify-center">{action}</div>}
    </div>
  )
}

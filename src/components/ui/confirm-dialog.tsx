import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { ActionStatus } from '@/components/ui/action-status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { AlertTriangle } from '@/lib/icons'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  busyLabel?: string
  doneLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  busyLabel,
  doneLabel,
  cancelLabel,
  destructive = false
}: ConfirmDialogProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<'done' | 'idle' | 'saving'>('idle')
  const [error, setError] = useState<null | string>(null)
  const busy = status === 'saving' || status === 'done'
  const resolvedConfirmLabel = confirmLabel ?? t.common.delete
  const resolvedBusyLabel = busyLabel ?? t.common.saving
  const resolvedDoneLabel = doneLabel ?? t.common.save
  const resolvedCancelLabel = cancelLabel ?? t.common.cancel

  useEffect(() => {
    if (open) {
      setStatus('idle')
      setError(null)
    }
  }, [open])

  async function run() {
    if (busy) {
      return
    }

    setStatus('saving')
    setError(null)

    try {
      await onConfirm()
      setStatus('done')
      window.setTimeout(onClose, 500)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : t.common.error)
    }
  }

  return (
    <Dialog onOpenChange={value => !value && !busy && onClose()} open={open}>
      <DialogContent
        className="max-w-md gap-4"
        onKeyDown={event => {
          if ((event.key === 'Enter' || event.key === ' ') && !busy) {
            event.preventDefault()
            void run()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {error ? (
          <div className="flex items-start gap-2 rounded-[var(--field-radius)] border border-[color-mix(in_srgb,var(--danger)_24%,var(--border))] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <DialogFooter>
          <Button disabled={busy} onClick={onClose} type="button" variant="ghost">
            {resolvedCancelLabel}
          </Button>
          <Button disabled={busy} onClick={() => void run()} variant={destructive ? 'destructive' : 'default'}>
            <ActionStatus busy={resolvedBusyLabel} done={resolvedDoneLabel} idle={resolvedConfirmLabel} state={status} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

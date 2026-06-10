import { useStore } from '@nanostores/react'
import { type FC, useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { triggerHaptic } from '@/lib/haptics'
import { ChevronDown, Loader2 } from '@/lib/icons'
import { $gateway } from '@/store/gateway'
import { notifyError } from '@/store/notifications'
import { $approvalRequest, type ApprovalRequest, clearApprovalRequest } from '@/store/prompts'

import type { ToolPart } from './tool-fallback-model'

export const APPROVAL_TOOLS = new Set(['terminal', 'execute_code'])

type ApprovalChoice = 'once' | 'session' | 'always' | 'deny'

export const PendingToolApproval: FC<{ part: ToolPart }> = ({ part }) => {
  const request = useStore($approvalRequest)

  if (!request || !APPROVAL_TOOLS.has(part.toolName)) {
    return null
  }

  return <ApprovalBar request={request} />
}

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)

const ApprovalBar: FC<{ request: ApprovalRequest }> = ({ request }) => {
  const gateway = useStore($gateway)
  const [submitting, setSubmitting] = useState<ApprovalChoice | null>(null)
  const [confirmAlways, setConfirmAlways] = useState(false)
  const busy = submitting !== null

  const respond = useCallback(
    async (choice: ApprovalChoice) => {
      if (busy || !$approvalRequest.get()) {
        return
      }

      if (!gateway) {
        notifyError(new Error('Hermes gateway is not connected'), 'Could not send approval response')

        return
      }

      setSubmitting(choice)

      try {
        await gateway.request<{ resolved?: boolean }>('approval.respond', {
          choice,
          session_id: request.sessionId ?? undefined
        })
        triggerHaptic(choice === 'deny' ? 'cancel' : 'submit')
        clearApprovalRequest(request.sessionId)
      } catch (error) {
        notifyError(error, 'Could not send approval response')
        setSubmitting(null)
      }
    },
    [busy, gateway, request.sessionId]
  )

  useEffect(() => {
    if (confirmAlways) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void respond('once')
      } else if (event.key === 'Escape') {
        event.preventDefault()
        void respond('deny')
      }
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [confirmAlways, respond])

  return (
    <div className="mt-1 flex items-center gap-2.5 ps-5" data-slot="tool-approval-inline">
      <div className="inline-flex h-6 items-stretch overflow-hidden rounded-[0.55rem] border border-[color-mix(in_srgb,var(--accent)_24%,var(--border))] bg-[var(--accent-soft)] text-[var(--accent)]">
        <Button
          className="h-full gap-1 rounded-none px-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft-hover)] hover:text-[var(--accent)]"
          disabled={busy}
          onClick={() => void respond('once')}
          size="xs"
          variant="ghost"
        >
          {submitting === 'once' ? <Loader2 className="size-3 animate-spin" /> : 'Run'}
          {submitting !== 'once' ? <span className="text-[0.625rem] opacity-60">{isMac ? '⌘⏎' : 'Ctrl⏎'}</span> : null}
        </Button>
        <span aria-hidden className="w-px self-stretch bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More approval options"
              className="h-full w-5 rounded-none px-0 text-[var(--accent)] hover:bg-[var(--accent-soft-hover)] hover:text-[var(--accent)]"
              disabled={busy}
              size="xs"
              variant="ghost"
            >
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuItem onSelect={() => void respond('session')}>Allow for session</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTimeout(() => setConfirmAlways(true), 0)}>
              Always allow...
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void respond('deny')} variant="destructive">
              Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        className="h-6 gap-1.5 rounded-[0.55rem] px-1.5 text-xs font-normal text-[var(--muted)] hover:text-foreground"
        disabled={busy}
        onClick={() => void respond('deny')}
        size="xs"
        variant="ghost"
      >
        {submitting === 'deny' ? <Loader2 className="size-3 animate-spin" /> : 'Reject'}
        {submitting !== 'deny' ? <span className="text-[0.625rem] opacity-55">Esc</span> : null}
      </Button>

      <Dialog onOpenChange={setConfirmAlways} open={confirmAlways}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Always allow this command?</DialogTitle>
            <DialogDescription>
              This can persist an approval rule. Use it only for commands you trust.
            </DialogDescription>
          </DialogHeader>

          {request.command.trim() ? (
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-[var(--field-radius)] border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 font-mono text-xs leading-snug text-foreground">
              {request.command.trim()}
            </pre>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setConfirmAlways(false)} size="sm" variant="ghost">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmAlways(false)
                void respond('always')
              }}
              size="sm"
              variant="destructive"
            >
              Always allow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

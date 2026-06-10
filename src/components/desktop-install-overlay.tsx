import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type {
  DesktopBootstrapEvent,
  DesktopBootstrapStageDescriptor,
  DesktopBootstrapStageResult,
  DesktopBootstrapStageState,
  DesktopBootstrapState
} from '@/global'

/**
 * DesktopInstallOverlay
 *
 * Renders the first-launch install progress for Hermes Agent. Mounted always;
 * shows itself only when main.cjs reports an in-flight bootstrap (state.active)
 * OR an error from a completed-failed bootstrap (state.error). When the
 * bootstrap finishes successfully the overlay fades out and the rest of the
 * app (existing onboarding overlay -> main UI) takes over.
 *
 * Subscribes to two channels:
 *   - getBootstrapState()           -- initial snapshot on mount
 *   - onBootstrapEvent(callback)    -- live event stream
 *
 * The reducer is intentionally simple: every event mutates an in-component
 * snapshot the same way main.cjs mutates its server-side snapshot. We don't
 * try to reconcile -- if we miss an event (shouldn't happen) the initial
 * getBootstrapState() call will resync the picture on the next render.
 *
 * Stages flagged needs_user_input render with a deliberately subdued style:
 * they're expected to come back as skipped=true (install.ps1 short-circuits
 * them under -NonInteractive). The post-install configuration flow that
 * those stages cover (API key, model, persona, gateway autostart) is handled
 * by the existing DesktopOnboardingOverlay, NOT by the install overlay.
 */

interface DesktopInstallOverlayProps {
  /** When false, the overlay never renders -- useful for dev when we want
   * to suppress it entirely. */
  enabled?: boolean
}

interface StageRowProps {
  descriptor: DesktopBootstrapStageDescriptor
  result: DesktopBootstrapStageResult | undefined
  isCurrent: boolean
  now: number
}

function formatStageName(name: string): string {
  // 'system-packages' -> 'System packages'; 'uv' stays 'uv'
  if (name.length <= 3) return name
  return name
    .split('-')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return ''
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rs = Math.round(s - m * 60)
  return `${m}m ${rs}s`
}

// Live elapsed for a running stage, as m:ss (or s for sub-minute).
function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}:${String(s - m * 60).padStart(2, '0')}`
}

function StageRow({ descriptor, result, isCurrent, now }: StageRowProps) {
  const { t } = useI18n()
  const state: DesktopBootstrapStageState = result?.state || 'pending'
  const elapsed =
    state === 'running' && typeof result?.startedAt === 'number' ? formatElapsed(now - result.startedAt) : ''
  const icon = useMemo(() => {
    switch (state) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case 'succeeded':
        return <Check className="h-4 w-4 text-emerald-600" />
      case 'skipped':
        return <Check className="h-4 w-4 text-[var(--muted)]" />
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-destructive" />
      case 'pending':
      default:
        return <div className="h-2 w-2 rounded-full border border-muted-foreground/40" />
    }
  }, [state])

  const reason = result?.json?.reason || result?.error || null

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-md px-3 py-2 transition-colors',
        isCurrent && 'bg-[var(--surface-secondary)]',
        state === 'failed' && 'bg-destructive/10'
      )}
    >
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate text-sm font-medium', state === 'pending' && 'text-[var(--muted)]')}>
            {formatStageName(descriptor.name)}
          </span>
          <span className="flex-shrink-0 text-xs tabular-nums text-[var(--muted)]">
            {state === 'running' ? (elapsed ? `${t.desktopInstall.states[state]} · ${elapsed}` : t.desktopInstall.states[state]) : null}
            {state === 'succeeded' || state === 'skipped' ? formatDuration(result?.durationMs) : null}
            {state === 'failed' ? t.desktopInstall.states[state] : null}
          </span>
        </div>
        {reason && state !== 'pending' && <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{reason}</p>}
      </div>
    </li>
  )
}

const EMPTY_STATE: DesktopBootstrapState = {
  active: false,
  manifest: null,
  stages: {},
  error: null,
  log: [],
  startedAt: null,
  completedAt: null,
  unsupportedPlatform: null
}

function applyEvent(state: DesktopBootstrapState, ev: DesktopBootstrapEvent): DesktopBootstrapState {
  if (ev.type === 'manifest') {
    const stages: Record<string, DesktopBootstrapStageResult> = {}
    for (const stage of ev.stages) {
      stages[stage.name] = { state: 'pending', durationMs: null, startedAt: null, json: null, error: null }
    }
    return {
      ...state,
      active: true,
      manifest: { type: 'manifest', stages: ev.stages, protocolVersion: ev.protocolVersion },
      stages,
      error: null,
      startedAt: state.startedAt || Date.now()
    }
  }
  if (ev.type === 'stage') {
    const prev = state.stages[ev.name]
    return {
      ...state,
      stages: {
        ...state.stages,
        [ev.name]: {
          state: ev.state,
          durationMs: ev.durationMs ?? null,
          // Stamp the start time on the running transition so the UI can show
          // a live elapsed timer; preserve it across repeated running events.
          startedAt: ev.state === 'running' ? (prev?.startedAt ?? Date.now()) : (prev?.startedAt ?? null),
          json: ev.json ?? null,
          error: ev.error ?? null
        }
      }
    }
  }
  if (ev.type === 'log') {
    const next = state.log.concat({ ts: Date.now(), stage: ev.stage ?? null, line: ev.line })
    while (next.length > 500) next.shift()
    return { ...state, log: next }
  }
  if (ev.type === 'complete') {
    return { ...state, active: false, completedAt: Date.now(), error: null }
  }
  if (ev.type === 'failed') {
    return { ...state, active: false, error: ev.error || 'unknown error' }
  }
  if (ev.type === 'unsupported-platform') {
    return {
      ...state,
      active: false,
      unsupportedPlatform: {
        platform: ev.platform,
        activeRoot: ev.activeRoot,
        installCommand: ev.installCommand,
        docsUrl: ev.docsUrl,
        missingDependencies: ev.missingDependencies
      }
    }
  }
  return state
}

export function DesktopInstallOverlay({ enabled = true }: DesktopInstallOverlayProps) {
  const { t } = useI18n()
  const [state, setState] = useState<DesktopBootstrapState>(EMPTY_STATE)
  const [logOpen, setLogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [logPath, setLogPath] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  // Tick once a second while a bootstrap is in flight so running steps show a
  // live elapsed timer. Stops when nothing is active to avoid idle renders.
  useEffect(() => {
    if (!state.active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [state.active])

  // Subscribe to bootstrap events + load initial snapshot
  useEffect(() => {
    if (!enabled) return
    const desktop = window.hermesDesktop
    if (!desktop || typeof desktop.onBootstrapEvent !== 'function') return

    let cancelled = false

    desktop
      .getBootstrapState()
      .then(snapshot => {
        if (!cancelled && snapshot) setState(snapshot)
      })
      .catch(() => {
        // Older Electron build without the IPC handler -- bootstrap UI just
        // stays empty, app falls through to existing onboarding flow.
      })

    const off = desktop.onBootstrapEvent(ev => setState(prev => applyEvent(prev, ev)))
    return () => {
      cancelled = true
      off?.()
    }
  }, [enabled])

  // Autoscroll log to bottom when new lines arrive AND the log is open
  useEffect(() => {
    if (logOpen && logEndRef.current && typeof logEndRef.current.scrollIntoView === 'function') {
      logEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
    }
  }, [state.log.length, logOpen])

  // Auto-expand the log panel when a bootstrap fails so the user immediately
  // sees the install.ps1 output. Without this, the failure block shows just
  // the top-level error message and the user has to click "Show installer
  // output" to see WHY the stage failed.
  useEffect(() => {
    if (state.error) setLogOpen(true)
  }, [state.error])

  // Mount logic: show whenever a bootstrap is in flight, completed-with-error,
  // or actively running with a manifest. Hide entirely after a successful
  // completion so the rest of the UI can take over.
  const shouldShow = useMemo(() => {
    if (!enabled) return false
    if (state.active) return true
    if (state.error) return true
    if (state.unsupportedPlatform) return true
    return false
  }, [enabled, state.active, state.error, state.unsupportedPlatform])

  useEffect(() => {
    if (!shouldShow) {
      return
    }

    void window.hermesDesktop
      ?.getRecentLogs?.()
      .then(result => setLogPath(result?.path || null))
      .catch(() => undefined)
  }, [shouldShow])

  if (!shouldShow) return null

  const logLocationLabel = logPath || t.desktopInstall.logDirectory

  // Missing-runtime branch: we could not resolve Hermes CLI for this desktop
  // launch, so we stop and show manual install guidance instead of trying to
  // install anything in the background.
  if (state.unsupportedPlatform) {
    const ups = state.unsupportedPlatform
    const platformLabel = ups.platform === 'darwin' ? 'macOS' : ups.platform === 'linux' ? 'Linux' : ups.platform
    return (
      <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-backdrop p-4 backdrop-blur-md">
        <div
          className="w-full max-w-xl rounded-[min(30px,var(--radius-3xl))] border border-[var(--border)] bg-[var(--overlay)] p-8 text-[var(--foreground)] shadow-[var(--overlay-shadow)]"
          data-slot="desktop-install-overlay-card"
        >
          <h2 className="text-2xl font-semibold tracking-tight">{t.desktopInstall.unsupportedTitle}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t.desktopInstall.unsupportedDescription(platformLabel)}
          </p>

          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">{t.desktopInstall.installCommand}</div>
            <pre className="overflow-x-auto rounded-[calc(var(--radius)*1.5)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2.5 font-mono text-[12px] shadow-[var(--field-shadow)]">
              <code>{ups.installCommand}</code>
            </pre>
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(ups.installCommand).catch(() => {})
                }}
              >
                {t.desktopInstall.copyCommand}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.hermesDesktop?.openExternal?.(ups.docsUrl)
                }}
              >
                {t.desktopInstall.viewDocs}
              </Button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
              <span className="text-xs text-[var(--muted)]">
                {t.desktopInstall.willInstallTo}{' '}
                <code className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 font-mono">{ups.activeRoot}</code>
              </span>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  await window.hermesDesktop?.resetBootstrap?.()
                } catch {
                  // best-effort -- continue with reload regardless
                }
                window.location.reload()
              }}
            >
              {t.desktopInstall.retryAfterInstall}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const stages = state.manifest?.stages || []
  const currentStage = stages.find(s => state.stages[s.name]?.state === 'running')?.name
  const completedCount = stages.filter(
    s => state.stages[s.name]?.state === 'succeeded' || state.stages[s.name]?.state === 'skipped'
  ).length
  const totalCount = stages.length
  const failed = Boolean(state.error)
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const currentStartedAt = currentStage ? state.stages[currentStage]?.startedAt : null
  const currentElapsed = typeof currentStartedAt === 'number' ? formatElapsed(now - currentStartedAt) : ''

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-backdrop p-4 backdrop-blur-md">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[min(30px,var(--radius-3xl))] border border-[var(--border)] bg-[var(--overlay)] text-[var(--foreground)] shadow-[var(--overlay-shadow)]"
        data-slot="desktop-install-overlay-card"
      >
        {/* Header -- always visible, never scrolls */}
        <div className="flex-shrink-0 border-b border-[var(--separator)] p-8 pb-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {failed ? t.desktopInstall.failedTitle : state.active ? t.desktopInstall.activeTitle : t.desktopInstall.finishingTitle}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            {failed ? t.desktopInstall.failedDescription : t.desktopInstall.setupDescription}
          </p>
        </div>

        {/* Scrollable middle: progress, stages, error block, log */}
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-2">
          {totalCount > 0 && (
            <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>
                  {t.desktopInstall.stepsComplete(completedCount, totalCount)}
                  {currentStage && ` -- ${t.desktopInstall.now}: ${formatStageName(currentStage)}`}
                  {currentElapsed && ` (${currentElapsed})`}
                </span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--default-soft)]">
                <div
                  className={cn('h-full transition-all duration-300', failed ? 'bg-destructive' : 'bg-primary')}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {totalCount === 0 && state.active && (
            <div className="mb-4 flex items-center gap-2 rounded-[calc(var(--radius)*1.5)] border border-dashed border-[var(--separator)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.desktopInstall.fetchingManifest}</span>
            </div>
          )}

          {failed && state.error && (
            <div className="mb-4 rounded-[calc(var(--radius)*1.5)] border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>{t.desktopInstall.error}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-foreground/90">{state.error}</p>
            </div>
          )}

          {stages.length > 0 && (
            <ol className="mb-4 space-y-1">
              {stages.map(stage => (
                <StageRow
                  key={stage.name}
                  descriptor={stage}
                  result={state.stages[stage.name]}
                  isCurrent={stage.name === currentStage}
                  now={now}
                />
              ))}
            </ol>
          )}

          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setLogOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors hover:text-foreground"
            >
              {logOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span>{logOpen ? t.desktopInstall.hideOutput : t.desktopInstall.showOutput}</span>
              <span className="ml-1 tabular-nums">
                ({t.desktopInstall.outputLines(state.log.length)})
              </span>
            </button>

            {logOpen && (
              <div
                className={cn(
                  'mt-2 overflow-auto rounded-[calc(var(--radius)*1.5)] border border-[var(--border)] bg-[var(--surface-secondary)] p-2 font-mono text-[11px] leading-relaxed shadow-[var(--field-shadow)]',
                  failed ? 'max-h-96' : 'max-h-64'
                )}
              >
                {state.log.length === 0 ? (
                  <div className="text-[var(--muted)]">{t.desktopInstall.noOutput}</div>
                ) : (
                  <>
                    {state.log.map((entry, i) => (
                      <div key={i} className="whitespace-pre-wrap break-words">
                        {entry.stage ? (
                          <span className="text-[color-mix(in_srgb,var(--foreground)_56%,transparent)]">
                            [{entry.stage}]{' '}
                          </span>
                        ) : null}
                        <span>{entry.line}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active footer: let the user actually cancel a running install. */}
        {state.active && !failed && (
          <div className="flex-shrink-0 border-t border-[var(--separator)] bg-[var(--overlay)] p-4">
            <div className="flex items-center justify-end">
              <Button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true)

                  try {
                    await window.hermesDesktop?.cancelBootstrap?.()
                  } catch {
                    // ignore -- the failed/cancelled event will surface the result
                  }
                }}
                size="sm"
                variant="ghost"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {cancelling ? t.desktopInstall.cancelling : t.desktopInstall.cancelInstall}
              </Button>
            </div>
          </div>
        )}

        {/* Footer -- always visible, never scrolls; only renders on failure */}
        {failed && (
          <div className="flex-shrink-0 border-t border-[var(--separator)] bg-[var(--overlay)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--muted)]">
                {t.desktopInstall.transcriptSavedTo}{' '}
                <code className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-0.5 font-mono">{logLocationLabel}</code>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const text = state.log
                      .map(entry => (entry.stage ? `[${entry.stage}] ${entry.line}` : entry.line))
                      .join('\n')
                    const fullText = state.error ? `Error: ${state.error}\n\n${text}` : text
                    try {
                      await navigator.clipboard.writeText(fullText)
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 1500)
                    } catch {
                      // ignore -- some environments forbid clipboard writes
                    }
                  }}
                >
                  {copied ? t.desktopInstall.copiedOutput : t.desktopInstall.copyOutput}
                </Button>
                <Button onClick={() => void window.hermesDesktop?.revealLogs?.()} size="sm" variant="outline">
                  {t.desktopInstall.openLogs}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    // Tell main.cjs to clear its latched failure BEFORE we
                    // reload. Otherwise the renderer reload calls getConnection
                    // and main short-circuits to the latched error without
                    // re-running install.ps1.
                    try {
                      await window.hermesDesktop?.resetBootstrap?.()
                    } catch {
                      // best-effort -- continue with reload regardless
                    }
                    window.location.reload()
                  }}
                >
                  {t.desktopInstall.reloadAndRetry}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { DesktopBootstrapState } from '@/global'
import { useI18n } from '@/i18n'
import { AlertTriangle, ArrowUpRight, FileText, Loader2, RefreshCw, Wrench } from '@/lib/icons'
import { $desktopBoot } from '@/store/boot'
import { notify, notifyError } from '@/store/notifications'
import { $desktopOnboarding } from '@/store/onboarding'

import type { RemoteReauth } from './boot-failure-reauth'
import { deriveProviderShape, isRemoteReauthFailure, signInLabel } from './boot-failure-reauth'

type BusyAction = 'local' | 'repair' | 'retry' | 'signin' | null

// Recovery surface for a hard boot failure (gateway never came up, backend
// exited during startup, bootstrap latched, …). Without this the app shell
// renders dead — "gateway offline", no composer, only a toast — with no way
// to retry, repair the install, switch the gateway, or find the logs.
export function BootFailureOverlay() {
  const boot = useStore($desktopBoot)
  const onboarding = useStore($desktopOnboarding)
  const { t } = useI18n()
  const [busy, setBusy] = useState<BusyAction>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [bootstrapState, setBootstrapState] = useState<DesktopBootstrapState | null>(null)
  const [remoteReauth, setRemoteReauth] = useState<RemoteReauth | null>(null)

  const visible = Boolean(boot.error) && !boot.running
  // While first-run onboarding owns the picker/flow we let it surface its own
  // progress; the recovery overlay is for hard failures, which it covers via a
  // higher z-index regardless of onboarding state.
  const suppressed = onboarding.flow.status !== 'idle' && onboarding.flow.status !== 'error'

  useEffect(() => {
    if (!visible) {
      return
    }

    void window.hermesDesktop
      ?.getRecentLogs()
      .then(res => setLogs(res.lines ?? []))
      .catch(() => undefined)
  }, [visible])

  useEffect(() => {
    if (!visible) {
      return
    }

    let cancelled = false

    void window.hermesDesktop
      ?.getBootstrapState?.()
      .then(snapshot => {
        if (!cancelled) {
          setBootstrapState(snapshot)
        }
      })
      .catch(() => undefined)

    const off = window.hermesDesktop?.onBootstrapEvent?.(() => {
      void window.hermesDesktop
        ?.getBootstrapState?.()
        .then(snapshot => {
          if (!cancelled) {
            setBootstrapState(snapshot)
          }
        })
        .catch(() => undefined)
    })

    return () => {
      cancelled = true
      off?.()
    }
  }, [visible])

  useEffect(() => {
    if (!visible) {
      setRemoteReauth(null)
      return
    }

    let cancelled = false

    void (async () => {
      const desktop = window.hermesDesktop

      if (!desktop?.getConnectionConfig) {
        return
      }

      let config
      try {
        config = await desktop.getConnectionConfig()
      } catch {
        return
      }

      if (cancelled || !isRemoteReauthFailure(config)) {
        return
      }

      let shape = deriveProviderShape(null)

      try {
        const probe = await desktop.probeConnectionConfig?.(config.remoteUrl)
        shape = deriveProviderShape(probe?.providers)
      } catch {
        // Generic copy is fine here.
      }

      if (!cancelled) {
        setRemoteReauth({ url: config.remoteUrl, ...shape })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible])

  const bootstrapOwnsRecovery = Boolean(
    bootstrapState?.active || bootstrapState?.error || bootstrapState?.unsupportedPlatform
  )

  if (!visible || suppressed || bootstrapOwnsRecovery) {
    return null
  }

  const retry = async () => {
    setBusy('retry')
    await window.hermesDesktop?.resetBootstrap().catch(() => undefined)
    window.location.reload()
  }

  const repair = async () => {
    setBusy('repair')
    await window.hermesDesktop?.repairBootstrap().catch(() => undefined)
    window.location.reload()
  }

  const switchToLocalGateway = async () => {
    setBusy('local')
    await window.hermesDesktop?.applyConnectionConfig({ mode: 'local' }).catch(() => undefined)
    setBusy(null)
  }

  const openLogs = () => void window.hermesDesktop?.revealLogs().catch(() => undefined)
  const copy = t.boot.failure

  const signInRemote = async () => {
    if (!remoteReauth) {
      return
    }

    setBusy('signin')

    try {
      const result = await window.hermesDesktop?.oauthLoginConnectionConfig?.(remoteReauth.url)

      if (result?.connected) {
        notify({ kind: 'success', title: copy.signedInTitle, message: copy.signedInMessage })
        window.location.reload()
        return
      }

      notify({
        kind: 'warning',
        title: copy.signInIncompleteTitle,
        message: copy.signInIncompleteMessage
      })
    } catch (error) {
      notifyError(error, copy.signInFailed)
    } finally {
      setBusy(null)
    }
  }

  const label = signInLabel(remoteReauth, {
    identityProvider: copy.identityProvider,
    remoteGateway: copy.signInToRemoteGateway,
    withProvider: copy.signInWithProvider
  })

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-backdrop p-6 backdrop-blur-md">
      <div
        className="w-full max-w-[40rem] overflow-hidden rounded-[min(30px,var(--radius-3xl))] border border-[var(--border)] bg-[var(--overlay)] text-[var(--foreground)] shadow-[var(--overlay-shadow)]"
        data-slot="boot-failure-overlay-card"
      >
        <div className="flex items-start gap-3 border-b border-[var(--separator)] px-5 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="text-[0.9375rem] font-semibold tracking-tight">
              {remoteReauth ? copy.remoteTitle : copy.title}
            </h2>
            <p className="mt-1 text-[0.8125rem] leading-5 text-[var(--muted)]">
              {remoteReauth ? copy.remoteDescription : copy.description}
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-5">
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-xs text-[var(--danger)]">
            {boot.error}
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              {remoteReauth ? (
                <Button disabled={Boolean(busy)} onClick={() => void signInRemote()}>
                  {busy === 'signin' ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
                  {label}
                </Button>
              ) : (
                <Button disabled={Boolean(busy)} onClick={() => void retry()}>
                  {busy === 'retry' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {copy.retry}
                </Button>
              )}
              {!remoteReauth ? (
                <Button disabled={Boolean(busy)} onClick={() => void repair()} variant="outline">
                  {busy === 'repair' ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />}
                  {copy.repairInstall}
                </Button>
              ) : null}
              <Button disabled={Boolean(busy)} onClick={() => void switchToLocalGateway()} variant="outline">
                {busy === 'local' ? <Loader2 className="size-4 animate-spin" /> : null}
                {copy.useLocalGateway}
              </Button>
              <Button onClick={openLogs} variant="ghost">
                <FileText className="size-4" />
                {copy.openLogs}
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {remoteReauth ? copy.remoteSignInHint : copy.repairHint}
            </p>
          </div>

          {logs.length > 0 ? (
            <div className="grid gap-2">
              <button
                className="self-start text-xs font-medium text-[var(--muted)] transition hover:text-foreground"
                onClick={() => setShowLogs(v => !v)}
                type="button"
              >
                {showLogs ? copy.hideRecentLogs : copy.showRecentLogs}
              </button>
              {showLogs ? (
                <pre className="max-h-48 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 font-mono text-[0.7rem] leading-4 text-[var(--muted)] shadow-[var(--field-shadow)]">
                  {logs.slice(-40).join('')}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

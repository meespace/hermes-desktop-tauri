import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DesktopConnectionProbeResult } from '@/global'
import { useI18n } from '@/i18n'
import { AlertCircle, ArrowUpRight, Check, FileText, Globe, Loader2, Monitor } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { $profiles, refreshActiveProfile } from '@/store/profile'
import { openStartupGuide } from '@/store/startup'

import { CONTROL_TEXT } from './constants'
import { EmptyState, ListRow, LoadingState, Pill, SettingsContent } from './primitives'

type AuthMode = 'oauth' | 'token'
type Mode = 'local' | 'remote'
type ProbeStatus = 'done' | 'error' | 'idle' | 'probing'

interface GatewaySettingsState {
  envOverride: boolean
  mode: Mode
  profile: null | string
  remoteAuthMode: AuthMode
  remoteOauthConnected: boolean
  remoteTokenPreview: null | string
  remoteTokenSet: boolean
  remoteUrl: string
}

const EMPTY_STATE: GatewaySettingsState = {
  envOverride: false,
  mode: 'local',
  profile: null,
  remoteAuthMode: 'token',
  remoteOauthConnected: false,
  remoteTokenPreview: null,
  remoteTokenSet: false,
  remoteUrl: ''
}

function ModeCard({
  active,
  description,
  disabled,
  icon: Icon,
  onSelect,
  title
}: {
  active: boolean
  description: string
  disabled?: boolean
  icon: typeof Monitor
  onSelect: () => void
  title: string
}) {
  return (
    <button
      className={cn(
        'rounded-[0.72rem] border px-3.5 py-3 text-left shadow-none transition-[background-color,border-color,color]',
        active
          ? 'border-[color-mix(in_srgb,var(--accent)_16%,transparent)] bg-[var(--workbench-active)] text-[var(--foreground)]'
          : 'border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] text-[var(--foreground)] hover:border-[var(--workbench-divider)] hover:bg-[var(--workbench-hover)]',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center gap-2 text-[length:var(--conversation-text-font-size)] font-medium">
        <Icon className="size-4 text-[var(--muted)]" />
        <span>{title}</span>
        {active ? <Check className="ml-auto size-4 text-[var(--accent)]" /> : null}
      </div>
      <p className="mt-1.5 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
        {description}
      </p>
    </button>
  )
}

function ScopeChip({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      className={cn(
        'rounded-[0.5rem] border px-3 py-1 text-[length:var(--conversation-caption-font-size)] transition',
        active
          ? 'border-[color-mix(in_srgb,var(--accent)_16%,transparent)] bg-[var(--workbench-active)] text-[var(--foreground)]'
          : 'border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] text-[var(--muted)] hover:bg-[var(--workbench-hover)]'
      )}
      onClick={onSelect}
      type="button"
    >
      {label}
    </button>
  )
}

export function GatewaySettings() {
  const { t } = useI18n()
  const g = t.settings.gateway
  const desktop = window.hermesDesktop
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [state, setState] = useState<GatewaySettingsState>(EMPTY_STATE)
  const [remoteToken, setRemoteToken] = useState('')
  const [lastTest, setLastTest] = useState<null | string>(null)
  const [scope, setScope] = useState<null | string>(null)
  const profiles = useStore($profiles)
  const [probeStatusState, setProbeStatusState] = useState<ProbeStatus>('idle')
  const [probeState, setProbeState] = useState<DesktopConnectionProbeResult | null>(null)
  const probeSeq = useRef(0)
  const oauthApiAvailable = Boolean(desktop?.oauthLoginConnectionConfig && desktop?.oauthLogoutConnectionConfig)

  useEffect(() => {
    void refreshActiveProfile()
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setLoading(true)
      setRemoteToken('')
      setLastTest(null)
    })

    if (!desktop?.getConnectionConfig) {
      return () => {
        cancelled = true
      }
    }

    desktop
      .getConnectionConfig(scope)
      .then(config => {
        if (!cancelled) {
          setState(config)
        }
      })
      .catch(error => notifyError(error, g.failedLoad))
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [desktop, g.failedLoad, scope])

  const trimmedUrl = state.remoteUrl.trim()
  const shouldProbe = state.mode === 'remote' && /^https?:\/\//i.test(trimmedUrl) && Boolean(desktop?.probeConnectionConfig)
  const probeStatus = shouldProbe ? probeStatusState : 'idle'
  const probe = shouldProbe ? probeState : null

  useEffect(() => {
    if (!shouldProbe) {
      return
    }

    const seq = ++probeSeq.current
    queueMicrotask(() => {
      if (seq === probeSeq.current) {
        setProbeStatusState('probing')
      }
    })

    const timer = window.setTimeout(() => {
      desktop
        .probeConnectionConfig?.(trimmedUrl)
        .then(result => {
          if (!result || seq !== probeSeq.current) {
            return
          }

          setProbeState(result)
          setProbeStatusState(result.reachable ? 'done' : 'error')
        })
        .catch(() => {
          if (seq !== probeSeq.current) {
            return
          }

          setProbeState(null)
          setProbeStatusState('error')
        })
    }, 500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [desktop, shouldProbe, trimmedUrl])

  const authMode: AuthMode = useMemo(() => {
    if (probeStatus === 'done' && probe && probe.authMode !== 'unknown') {
      return probe.authMode
    }

    return state.remoteAuthMode
  }, [probe, probeStatus, state.remoteAuthMode])

  const hasSavedRemote = state.remoteTokenSet || state.remoteOauthConnected
  const authResolved = useMemo(() => {
    if (probeStatus === 'done') {
      return true
    }

    return probeStatus === 'idle' && hasSavedRemote
  }, [hasSavedRemote, probeStatus])

  const providerLabel = useMemo(() => {
    const providers = probe?.providers ?? []

    if (providers.length === 1) {
      return providers[0].displayName || providers[0].name
    }

    if (providers.length > 1) {
      return providers.map(provider => provider.displayName || provider.name).join(' / ')
    }

    return t.boot.failure.identityProvider
  }, [probe, t.boot.failure.identityProvider])

  const isPasswordProvider = useMemo(() => {
    const providers = probe?.providers ?? []
    return providers.length > 0 && providers.every(provider => provider.supportsPassword)
  }, [probe])

  const namedProfiles = useMemo(() => profiles.filter(profile => profile.name !== 'default'), [profiles])
  const oauthConnected = state.remoteOauthConnected

  const canUseRemote = useMemo(() => {
    if (!trimmedUrl) {
      return false
    }

    if (authMode === 'oauth') {
      return oauthConnected
    }

    return Boolean(remoteToken.trim()) || state.remoteTokenSet
  }, [authMode, oauthConnected, remoteToken, state.remoteTokenSet, trimmedUrl])

  const payload = () => ({
    mode: state.mode,
    profile: scope ?? undefined,
    remoteAuthMode: authMode,
    remoteToken: authMode === 'token' ? remoteToken.trim() || undefined : undefined,
    remoteUrl: trimmedUrl
  })

  const save = async (apply: boolean) => {
    if (state.mode === 'remote' && !canUseRemote) {
      notify({
        kind: 'warning',
        title: g.incompleteTitle,
        message: authMode === 'oauth' ? g.incompleteSignIn : g.incompleteToken
      })
      return
    }

    setSaving(true)

    try {
      const next = apply ? await desktop.applyConnectionConfig(payload()) : await desktop.saveConnectionConfig(payload())

      setState(next)
      setRemoteToken('')

      notify({
        kind: 'success',
        title: apply ? g.restartingTitle : g.savedTitle,
        message: apply ? g.restartingMessage : g.savedMessage
      })
    } catch (error) {
      notifyError(error, apply ? g.applyFailed : g.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const signIn = async () => {
    if (!trimmedUrl) {
      notify({ kind: 'warning', title: g.incompleteTitle, message: g.enterUrlFirst })
      return
    }

    if (!oauthApiAvailable) {
      notify({ kind: 'warning', title: g.oauthUnsupportedTitle, message: g.oauthUnsupportedDesc })
      return
    }

    setSigningIn(true)

    try {
      const saved = await desktop.saveConnectionConfig({
        mode: state.mode,
        profile: scope ?? undefined,
        remoteAuthMode: 'oauth',
        remoteUrl: trimmedUrl
      })

      setState(saved)

      const result = await desktop.oauthLoginConnectionConfig?.(trimmedUrl)

      if (result?.connected) {
        const refreshed = await desktop.getConnectionConfig(scope)
        setState(refreshed)
        notify({ kind: 'success', title: g.signedIn, message: g.connectedTo(result.baseUrl) })
      } else {
        notify({
          kind: 'warning',
          title: t.boot.failure.signInIncompleteTitle,
          message: t.boot.failure.signInIncompleteMessage
        })
      }
    } catch (error) {
      notifyError(error, g.signInFailed)
    } finally {
      setSigningIn(false)
    }
  }

  const signOut = async () => {
    if (!oauthApiAvailable) {
      notify({ kind: 'warning', title: g.oauthUnsupportedTitle, message: g.oauthUnsupportedDesc })
      return
    }

    setSigningIn(true)

    try {
      await desktop.oauthLogoutConnectionConfig?.(trimmedUrl || undefined)
      const refreshed = await desktop.getConnectionConfig(scope)
      setState(refreshed)
      notify({ kind: 'success', title: g.signedOutTitle, message: g.signedOutMessage })
    } catch (error) {
      notifyError(error, g.signOutFailed)
    } finally {
      setSigningIn(false)
    }
  }

  const testRemote = async () => {
    if (!canUseRemote) {
      notify({
        kind: 'warning',
        title: g.incompleteTitle,
        message: authMode === 'oauth' ? g.incompleteSignInTest : g.incompleteTokenTest
      })
      return
    }

    setTesting(true)
    setLastTest(null)

    try {
      const result = await desktop.testConnectionConfig({
        mode: 'remote',
        profile: scope ?? undefined,
        remoteAuthMode: authMode,
        remoteToken: authMode === 'token' ? remoteToken.trim() || undefined : undefined,
        remoteUrl: trimmedUrl
      })

      const message = g.connectedTo(result.baseUrl, result.version ?? undefined)
      setLastTest(message)
      notify({ kind: 'success', title: g.reachableTitle, message })
    } catch (error) {
      notifyError(error, g.testFailed)
    } finally {
      setTesting(false)
    }
  }

  if (!desktop?.getConnectionConfig) {
    return <EmptyState description={g.unavailableDesc} title={g.unavailableTitle} />
  }

  if (loading) {
    return <LoadingState label={g.loading} />
  }

  return (
    <SettingsContent>
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[length:var(--conversation-text-font-size)] font-medium">
            <Globe className="size-4 text-[var(--muted)]" />
            {g.title}
            {state.envOverride ? <Pill tone="primary">{g.envOverride}</Pill> : null}
          </div>
          <Button onClick={() => openStartupGuide()} size="sm" variant="outline">
            <Monitor className="size-4" />
            重新打开启动向导
          </Button>
        </div>
        <p className="mt-2 max-w-2xl text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
          {g.intro}
        </p>
      </div>

      {namedProfiles.length > 0 ? (
        <div className="mb-5 grid gap-2">
          <div className="text-[length:var(--conversation-caption-font-size)] font-medium text-[var(--muted)]">
            {g.appliesTo}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ScopeChip active={scope === null} label={g.allProfiles} onSelect={() => setScope(null)} />
            {namedProfiles.map(profile => (
              <ScopeChip
                active={scope === profile.name}
                key={profile.name}
                label={profile.name}
                onSelect={() => setScope(profile.name)}
              />
            ))}
          </div>
          <p className="text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
            {scope === null ? g.defaultConnection : g.profileConnection(scope)}
          </p>
        </div>
      ) : null}

      {state.envOverride ? (
        <div className="mb-5 flex items-start gap-2 rounded-[0.72rem] border border-[color-mix(in_srgb,var(--danger)_18%,transparent)] bg-[var(--danger-soft)] px-3 py-2.5 text-[length:var(--conversation-caption-font-size)] text-[var(--danger)] shadow-none">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">{g.envOverrideTitle}</div>
            <div className="mt-1 leading-5">{g.envOverrideDesc}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={state.mode === 'local'}
          description={g.localDesc}
          disabled={state.envOverride}
          icon={Monitor}
          onSelect={() => setState(current => ({ ...current, mode: 'local' }))}
          title={g.localTitle}
        />
        <ModeCard
          active={state.mode === 'remote'}
          description={g.remoteDesc}
          disabled={state.envOverride}
          icon={Globe}
          onSelect={() => setState(current => ({ ...current, mode: 'remote' }))}
          title={g.remoteTitle}
        />
      </div>

      <div className="mt-5 grid gap-1">
        <ListRow
          action={
            <Input
              className={cn('h-8', CONTROL_TEXT)}
              disabled={state.envOverride}
              onChange={event => setState(current => ({ ...current, remoteUrl: event.target.value }))}
              placeholder="https://gateway.example.com/hermes"
              value={state.remoteUrl}
            />
          }
          description={g.remoteUrlDesc}
          title={g.remoteUrlTitle}
        />

        {state.mode === 'remote' && probeStatus === 'probing' ? (
          <div className="flex items-center gap-2 py-3 text-[length:var(--conversation-caption-font-size)] text-[var(--muted)]">
            <Loader2 className="size-4 animate-spin" />
            {g.probing}
          </div>
        ) : null}

        {state.mode === 'remote' && probeStatus === 'error' ? (
          <div className="flex items-start gap-2 py-3 text-[length:var(--conversation-caption-font-size)] text-[var(--muted)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {g.probeError}
          </div>
        ) : null}

        {state.mode === 'remote' && authResolved && authMode === 'oauth' ? (
          <ListRow
            action={
              oauthConnected ? (
                <div className="flex items-center gap-2">
                  <Pill tone="primary">
                    <Check className="size-3" /> {g.signedIn}
                  </Pill>
                  <Button disabled={signingIn || state.envOverride || !oauthApiAvailable} onClick={() => void signOut()} variant="outline">
                    {signingIn ? <Loader2 className="size-4 animate-spin" /> : null}
                    {g.signOut}
                  </Button>
                </div>
              ) : (
                <Button disabled={signingIn || state.envOverride || !trimmedUrl} onClick={() => void signIn()}>
                  {signingIn ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
                  {isPasswordProvider ? g.signIn : g.signInWith(providerLabel)}
                </Button>
              )
            }
            description={
              !oauthApiAvailable
                ? g.oauthUnsupportedDesc
                : oauthConnected
                  ? isPasswordProvider
                    ? g.authSignedInPassword
                    : g.authSignedInOauth
                  : isPasswordProvider
                    ? g.authNeedsPassword
                    : g.authNeedsOauth(providerLabel)
            }
            title={g.authTitle}
          />
        ) : null}

        {state.mode === 'remote' && authResolved && authMode === 'token' ? (
          <ListRow
            action={
              <Input
                autoComplete="off"
                className={cn('h-8 font-mono', CONTROL_TEXT)}
                disabled={state.envOverride}
                onChange={event => setRemoteToken(event.target.value)}
                placeholder={state.remoteTokenSet ? g.existingToken(state.remoteTokenPreview ?? g.savedToken) : g.pasteSessionToken}
                type="password"
                value={remoteToken}
              />
            }
            description={g.tokenDesc}
            title={g.tokenTitle}
          />
        ) : null}
      </div>

      {lastTest ? <div className="mt-4 text-xs text-[var(--accent)]">{lastTest}</div> : null}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button disabled={state.envOverride || testing || !canUseRemote} onClick={() => void testRemote()} variant="outline">
          {testing ? <Loader2 className="size-4 animate-spin" /> : null}
          {g.testRemote}
        </Button>
        <Button disabled={state.envOverride || saving} onClick={() => void save(false)} variant="outline">
          {g.saveForRestart}
        </Button>
        <Button disabled={state.envOverride || saving} onClick={() => void save(true)}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {g.saveAndReconnect}
        </Button>
      </div>

      <div className="mt-6 grid gap-1">
        <ListRow
          action={
            <Button onClick={() => void desktop.revealLogs()} variant="outline">
              <FileText className="size-4" />
              {g.openLogs}
            </Button>
          }
          description={g.diagnosticsDesc}
          title={g.diagnostics}
        />
      </div>
    </SettingsContent>
  )
}

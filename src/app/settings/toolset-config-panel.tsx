import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteEnvVar, getToolsetConfig, revealEnvVar, selectToolsetProvider, setEnvVar } from '@/hermes'
import { useI18n } from '@/i18n'
import { Check, ExternalLink, Eye, EyeOff, Loader2, Save, Trash2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import type { ToolEnvVar, ToolProvider, ToolsetConfig } from '@/types/hermes'

import { Pill } from './primitives'

interface ToolsetConfigPanelProps {
  toolset: string
  /** Called after a key is saved/cleared or a provider chosen, so the parent
   *  can refresh the "Configured / Needs keys" pill. */
  onConfiguredChange?: () => void
}

function providerConfigured(provider: ToolProvider, envState: Record<string, boolean>): boolean {
  if (provider.env_vars.length === 0) {
    return true
  }

  return provider.env_vars.every(ev => envState[ev.key])
}

interface EnvVarFieldProps {
  envVar: ToolEnvVar
  isSet: boolean
  onSaved: (key: string) => void
  onCleared: (key: string) => void
}

function EnvVarField({ envVar, isSet, onSaved, onCleared }: EnvVarFieldProps) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (!value) {
      return
    }

    setBusy(true)

    try {
      await setEnvVar(envVar.key, value)
      setEditing(false)
      setValue('')
      onSaved(envVar.key)
      notify({ kind: 'success', title: t.settings.toolsets.credentialSaved, message: t.settings.toolsets.credentialUpdated(envVar.key) })
    } catch (err) {
      notifyError(err, t.settings.toolsets.saveFailed(envVar.key))
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    if (!window.confirm(t.settings.toolsets.removeConfirm(envVar.key))) {
      return
    }

    setBusy(true)

    try {
      await deleteEnvVar(envVar.key)
      setRevealed(null)
      onCleared(envVar.key)
      notify({ kind: 'success', title: t.settings.toolsets.credentialRemoved, message: t.settings.toolsets.credentialRemovedMessage(envVar.key) })
    } catch (err) {
      notifyError(err, t.settings.toolsets.removeFailed(envVar.key))
    } finally {
      setBusy(false)
    }
  }

  async function handleReveal() {
    if (revealed !== null) {
      setRevealed(null)

      return
    }

    try {
      const result = await revealEnvVar(envVar.key)
      setRevealed(result.value)
    } catch (err) {
      notifyError(err, t.settings.toolsets.revealFailed(envVar.key))
    }
  }

  return (
    <div className="grid gap-2 rounded-[0.68rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] p-2.5 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium">{envVar.key}</span>
            <Pill tone={isSet ? 'primary' : 'muted'}>
              {isSet && <Check className="size-3" />}
              {isSet ? t.settings.keys.set : t.settings.keys.notSet}
            </Pill>
          </div>
          {envVar.prompt && envVar.prompt !== envVar.key && (
            <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">{envVar.prompt}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {envVar.url && (
            <Button asChild size="xs" title={t.settings.keys.openDocs} variant="ghost">
              <a href={envVar.url} rel="noreferrer" target="_blank">
                {t.common.docs}
                <ExternalLink className="size-3" />
              </a>
            </Button>
          )}
          {isSet && (
            <Button onClick={() => void handleReveal()} size="icon-xs" title={t.settings.keys.revealValue} variant="ghost">
              {revealed !== null ? <EyeOff /> : <Eye />}
            </Button>
          )}
          <Button onClick={() => setEditing(e => !e)} size="xs" variant="outline">
            {isSet ? t.settings.keys.replace : t.settings.keys.set}
          </Button>
          {isSet && (
            <Button disabled={busy} onClick={() => void handleClear()} size="icon-xs" title={t.settings.keys.clearValue} variant="ghost">
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      {isSet && revealed !== null && (
        <div className="rounded-[0.52rem] border border-[color-mix(in_srgb,var(--workbench-divider)_90%,transparent)] bg-[var(--workbench-panel-muted-bg)] px-2.5 py-1.5 font-mono text-xs text-[var(--foreground)] shadow-none">
          {revealed || '---'}
        </div>
      )}

      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            className="min-w-52 flex-1 font-mono"
            onChange={e => setValue(e.target.value)}
            placeholder={envVar.prompt || envVar.key}
            type={envVar.default ? 'text' : 'password'}
            value={value}
          />
          <Button disabled={busy || !value} onClick={() => void handleSave()} size="sm">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save />}
            {t.common.save}
          </Button>
          <Button onClick={() => setEditing(false)} size="sm" variant="outline">
            {t.common.cancel}
          </Button>
        </div>
      )}
    </div>
  )
}

export function ToolsetConfigPanel({ toolset, onConfiguredChange }: ToolsetConfigPanelProps) {
  const { t } = useI18n()
  const [cfg, setCfg] = useState<ToolsetConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  // Live per-key set/unset state, seeded from the endpoint then patched locally.
  const [envState, setEnvState] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true)
      }
    })

    void getToolsetConfig(toolset)
      .then(next => {
        if (cancelled) {
          return
        }

        setCfg(next)
        const seeded: Record<string, boolean> = {}

        for (const provider of next.providers) {
          for (const ev of provider.env_vars) {
            seeded[ev.key] = ev.is_set
          }
        }

        setEnvState(seeded)
      })
      .catch(err => {
        if (!cancelled) {
          notifyError(err, t.settings.toolsets.loadFailed)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [t.settings.toolsets.loadFailed, toolset])

  const providers = useMemo(() => cfg?.providers ?? [], [cfg])
  const resolvedActiveProvider = useMemo(() => {
    if (activeProvider) {
      return activeProvider
    }

    const selected =
      providers.find(p => p.is_active) ??
      (cfg?.active_provider ? providers.find(p => p.name === cfg.active_provider) : undefined) ??
      providers.find(p => providerConfigured(p, envState)) ??
      providers[0]

    return selected?.name ?? null
  }, [activeProvider, cfg, envState, providers])

  async function handleSelect(provider: ToolProvider) {
    setActiveProvider(provider.name)
    setSelecting(provider.name)

    try {
      await selectToolsetProvider(toolset, provider.name)
      notify({ kind: 'success', title: t.settings.toolsets.providerSelected, message: t.settings.toolsets.providerActive(provider.name) })
      onConfiguredChange?.()
    } catch (err) {
      notifyError(err, t.settings.toolsets.selectFailed(provider.name))
    } finally {
      setSelecting(null)
    }
  }

  function patchEnv(key: string, isSet: boolean) {
    setEnvState(c => ({ ...c, [key]: isSet }))
    onConfiguredChange?.()
  }

  const emptyMessage = useMemo(() => {
    if (loading || !cfg) {
      return null
    }

    if (!cfg.has_category) {
      return t.settings.toolsets.noProviderOptions
    }

    if (providers.length === 0) {
      return t.settings.toolsets.noProviders
    }

    return null
  }, [cfg, loading, providers.length, t.settings.toolsets.noProviderOptions, t.settings.toolsets.noProviders])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-xs text-[var(--muted)]">
        <Loader2 className="size-3.5 animate-spin" />
        {t.settings.toolsets.loadingConfiguration}
      </div>
    )
  }

  if (emptyMessage) {
    return <p className="px-1 py-3 text-xs text-[var(--muted)]">{emptyMessage}</p>
  }

  return (
    <div className="mt-3 grid gap-2">
      {providers.map(provider => {
        const isActive = resolvedActiveProvider === provider.name
        const configured = providerConfigured(provider, envState)

        return (
          <div
            className="overflow-hidden rounded-[0.74rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] shadow-none"
            key={provider.name}
          >
            <button
              aria-pressed={isActive}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-[background-color,border-color,color] hover:bg-[var(--workbench-hover)]',
                isActive && 'bg-[var(--workbench-active)]'
              )}
              onClick={() => void handleSelect(provider)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{provider.name}</span>
                {provider.badge && <Pill>{provider.badge}</Pill>}
                {configured && (
                  <Pill tone="primary">
                    <Check className="size-3" />
                    Ready
                  </Pill>
                )}
              </span>
              {selecting === provider.name && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
            </button>

            {isActive && (
              <div className="grid gap-2 border-t border-[var(--separator)] bg-[var(--workbench-panel-muted-bg)] p-3">
                {provider.tag && <p className="text-[0.72rem] text-[var(--muted)]">{provider.tag}</p>}
                {provider.requires_nous_auth && (
                  <p className="text-[0.72rem] text-[var(--muted)]">
                    Included with a Nous subscription — sign in to Nous Portal to activate.
                  </p>
                )}
                {provider.env_vars.length === 0 ? (
                  <p className="text-[0.72rem] text-[var(--muted)]">No API key required.</p>
                ) : (
                  provider.env_vars.map(ev => (
                    <EnvVarField
                      envVar={ev}
                      isSet={Boolean(envState[ev.key])}
                      key={ev.key}
                      onCleared={key => patchEnv(key, false)}
                      onSaved={key => patchEnv(key, true)}
                    />
                  ))
                )}
                {provider.post_setup && (
                  <p className="text-[0.72rem] text-[var(--muted)]">
                    This provider needs an extra setup step ({provider.post_setup}). Run it from the CLI with{' '}
                    <code className="font-mono">hermes tools</code> for now.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

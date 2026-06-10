import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  getAuxiliaryModels,
  getGlobalModelInfo,
  getGlobalModelOptions,
  getRecommendedDefaultModel,
  setEnvVar,
  setModelAssignment
} from '@/hermes'
import type { AuxiliaryModelsResponse, ModelOptionProvider, StaleAuxAssignment } from '@/hermes'
import { useI18n } from '@/i18n'
import { AlertTriangle, Cpu, Loader2, Sparkles } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { startManualProviderOAuth } from '@/store/onboarding'

import { CONTROL_TEXT } from './constants'
import { ListRow, LoadingState, Pill, SectionHeading } from './primitives'

function isProviderReady(p?: ModelOptionProvider): boolean {
  return !!p && (p.authenticated !== false || (p.models?.length ?? 0) > 0)
}

// Mirrors `_AUX_TASK_SLOTS` in hermes_cli/web_server.py. Friendly labels and
// hints make the assignments readable; raw task keys (vision, mcp, …) are
// opaque to most users.
interface AuxTaskMeta {
  hint: string
  key: string
  label: string
}

const AUX_TASKS: readonly AuxTaskMeta[] = [
  { key: 'vision', label: 'Vision', hint: 'Image analysis' },
  { key: 'web_extract', label: 'Web extract', hint: 'Page summarization' },
  { key: 'compression', label: 'Compression', hint: 'Context compaction' },
  { key: 'session_search', label: 'Session search', hint: 'Recall queries' },
  { key: 'skills_hub', label: 'Skills hub', hint: 'Skill search' },
  { key: 'approval', label: 'Approval', hint: 'Smart auto-approve' },
  { key: 'mcp', label: 'MCP', hint: 'MCP tool routing' },
  { key: 'title_generation', label: 'Title gen', hint: 'Session titles' },
  { key: 'curator', label: 'Curator', hint: 'Skill-usage review' }
]

const NO_PROVIDERS: readonly ModelOptionProvider[] = [{ name: '—', slug: '', models: [] }]

interface StaleAuxWarningProps {
  applying: boolean
  onReset: () => void
  slots: readonly StaleAuxAssignment[]
  taskLabel: (key: string) => string
}

function StaleAuxWarning({ applying, onReset, slots, taskLabel }: StaleAuxWarningProps) {
  if (!slots.length) {
    return null
  }

  const provider = slots[0].provider
  const allSameProvider = slots.every(slot => slot.provider === provider)
  const names = slots.map(slot => taskLabel(slot.task)).join(', ')

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="grow">
        {slots.length} auxiliary task{slots.length === 1 ? '' : 's'} ({names}) still run on{' '}
        <span className="font-mono">{allSameProvider ? provider : 'other providers'}</span>, not your main model.
      </span>
      <Button disabled={applying} onClick={onReset} size="sm" variant="outline">
        Reset all to main
      </Button>
    </div>
  )
}

interface ModelSettingsProps {
  /** Notified after the main model is applied, so live UI stores can sync. */
  onMainModelChanged?: (provider: string, model: string) => void
}

export function ModelSettings({ onMainModelChanged }: ModelSettingsProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mainModel, setMainModel] = useState<{ model: string; provider: string } | null>(null)
  const [providers, setProviders] = useState<ModelOptionProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [auxiliary, setAuxiliary] = useState<AuxiliaryModelsResponse | null>(null)
  const [applying, setApplying] = useState(false)
  const [editingAuxTask, setEditingAuxTask] = useState<null | string>(null)
  const [auxDraft, setAuxDraft] = useState<{ model: string; provider: string }>({ model: '', provider: '' })
  const [switchStaleAux, setSwitchStaleAux] = useState<StaleAuxAssignment[]>([])
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [activating, setActivating] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [modelInfo, modelOptions, auxiliaryModels] = await Promise.all([
        getGlobalModelInfo(),
        getGlobalModelOptions(),
        getAuxiliaryModels()
      ])

      setMainModel({ model: modelInfo.model, provider: modelInfo.provider })
      setProviders(modelOptions.providers || [])
      setSelectedProvider(prev => prev || modelInfo.provider)
      setSelectedModel(prev => prev || modelInfo.model)
      setAuxiliary(auxiliaryModels)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void Promise.all([getGlobalModelInfo(), getGlobalModelOptions(), getAuxiliaryModels()])
      .then(([modelInfo, modelOptions, auxiliaryModels]) => {
        if (cancelled) {
          return
        }

        setMainModel({ model: modelInfo.model, provider: modelInfo.provider })
        setProviders(modelOptions.providers || [])
        setSelectedProvider(prev => prev || modelInfo.provider)
        setSelectedModel(prev => prev || modelInfo.model)
        setAuxiliary(auxiliaryModels)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
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
  }, [])

  const providerOptions = providers.length ? providers : NO_PROVIDERS

  const selectedProviderRow = useMemo(
    () => providers.find(provider => provider.slug === selectedProvider),
    [providers, selectedProvider]
  )

  const selectedProviderModels = selectedProviderRow?.models ?? []

  const needsSetup = !!selectedProvider && !isProviderReady(selectedProviderRow)
  const setupIsApiKey = needsSetup && selectedProviderRow?.auth_type === 'api_key' && !!selectedProviderRow?.key_env

  useEffect(() => {
    setApiKeyDraft('')
  }, [selectedProvider])

  const auxDraftProviderModels = useMemo(
    () => providers.find(provider => provider.slug === auxDraft.provider)?.models ?? [],
    [auxDraft.provider, providers]
  )

  const auxiliaryTaskLabel = useCallback(
    (key: string) => t.settings.models.tasks[key]?.label ?? key,
    [t.settings.models.tasks]
  )

  const persistentStaleAux = useMemo<StaleAuxAssignment[]>(() => {
    const mainProvider = (mainModel?.provider ?? '').toLowerCase()

    if (!mainProvider || !auxiliary) {
      return []
    }

    return auxiliary.tasks
      .filter(entry => {
        const provider = (entry.provider ?? '').toLowerCase()

        return provider && provider !== 'auto' && provider !== mainProvider
      })
      .map(entry => ({ task: entry.task, provider: entry.provider, model: entry.model }))
  }, [auxiliary, mainModel])

  const activateApiKeyProvider = useCallback(async () => {
    const keyEnv = selectedProviderRow?.key_env
    const slug = selectedProviderRow?.slug

    if (!keyEnv || !slug || !apiKeyDraft.trim()) {
      return
    }

    setActivating(true)
    setError('')

    try {
      await setEnvVar(keyEnv, apiKeyDraft.trim())
      setApiKeyDraft('')

      let nextModel = ''

      try {
        const rec = await getRecommendedDefaultModel(slug)
        nextModel = rec.model || ''
      } catch {
        nextModel = ''
      }

      const options = await getGlobalModelOptions()
      setProviders(options.providers || [])
      const refreshedRow = options.providers?.find(provider => provider.slug === slug)
      const fallbackModel = refreshedRow?.models?.[0] ?? ''
      setSelectedModel(nextModel || fallbackModel)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActivating(false)
    }
  }, [apiKeyDraft, selectedProviderRow])

  const startProviderSetup = useCallback(() => {
    if (selectedProviderRow?.slug) {
      startManualProviderOAuth(selectedProviderRow.slug)
    }
  }, [selectedProviderRow])

  const applyMainModel = useCallback(async () => {
    if (!selectedProvider || !selectedModel) {
      return
    }

    setApplying(true)
    setError('')

    try {
      const result = await setModelAssignment({ model: selectedModel, provider: selectedProvider, scope: 'main' })
      const provider = result.provider || selectedProvider
      const model = result.model || selectedModel
      setMainModel({ provider, model })
      setSwitchStaleAux(result.stale_aux ?? [])
      onMainModelChanged?.(provider, model)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplying(false)
    }
  }, [onMainModelChanged, refresh, selectedModel, selectedProvider])

  const setAuxiliaryToMain = useCallback(
    async (task: string) => {
      if (!mainModel) {
        return
      }

      setApplying(true)
      setError('')

      try {
        await setModelAssignment({ model: mainModel.model, provider: mainModel.provider, scope: 'auxiliary', task })
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setApplying(false)
      }
    },
    [mainModel, refresh]
  )

  const applyAuxiliaryDraft = useCallback(
    async (task: string) => {
      if (!auxDraft.provider || !auxDraft.model) {
        return
      }

      setApplying(true)
      setError('')

      try {
        await setModelAssignment({ model: auxDraft.model, provider: auxDraft.provider, scope: 'auxiliary', task })
        setEditingAuxTask(null)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setApplying(false)
      }
    },
    [auxDraft, refresh]
  )

  const beginAuxiliaryEdit = useCallback(
    (task: string) => {
      const current = auxiliary?.tasks.find(entry => entry.task === task)

      const initialProvider =
        current?.provider && current.provider !== 'auto' ? current.provider : (mainModel?.provider ?? '')

      const initialModel = current?.model || mainModel?.model || ''
      setAuxDraft({ provider: initialProvider, model: initialModel })
      setEditingAuxTask(task)
    },
    [auxiliary, mainModel]
  )

  const resetAuxiliaryModels = useCallback(async () => {
    if (!mainModel) {
      return
    }

    setApplying(true)
    setError('')

    try {
      await setModelAssignment({
        model: mainModel.model,
        provider: mainModel.provider,
        scope: 'auxiliary',
        task: '__reset__'
      })
      setSwitchStaleAux([])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplying(false)
    }
  }, [mainModel, refresh])

  if (loading && !mainModel) {
    return <LoadingState label={t.settings.models.loading} />
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[0.78rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-5 py-4">
        <SectionHeading
          icon={Sparkles}
          meta={mainModel ? `${mainModel.provider} / ${mainModel.model}` : undefined}
          title={t.settings.models.mainModel}
        />
        <p className="mb-4 text-[0.74rem] leading-5.5 text-[var(--muted)]">
          {t.settings.models.mainModelDescription}
        </p>
        <div className="grid gap-2 xl:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)_auto] xl:items-end">
          <Select onValueChange={setSelectedProvider} value={selectedProvider}>
            <SelectTrigger className={cn('w-full', CONTROL_TEXT)}>
              <SelectValue placeholder={t.settings.models.provider} />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map(provider => (
                <SelectItem key={provider.slug || 'none'} value={provider.slug || 'none'}>
                  {provider.name}
                  {!isProviderReady(provider) ? ' · set up' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsSetup ? (
            setupIsApiKey ? (
              <>
                <Input
                  autoComplete="off"
                  className={cn('w-full font-mono', CONTROL_TEXT)}
                  onChange={event => setApiKeyDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      void activateApiKeyProvider()
                    }
                  }}
                  placeholder={`Paste ${selectedProviderRow?.key_env ?? 'API key'}`}
                  type="password"
                  value={apiKeyDraft}
                />
                <Button
                  className="min-w-28 justify-center"
                  disabled={!apiKeyDraft.trim() || activating}
                  onClick={() => void activateApiKeyProvider()}
                  size="sm"
                >
                  {activating ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {activating ? 'Activating...' : 'Activate'}
                </Button>
              </>
            ) : (
              <>
                <div className="text-xs leading-5 text-[var(--muted)] xl:self-center">
                  {selectedProviderRow?.auth_type === 'api_key'
                    ? `${selectedProviderRow?.name} needs an API key to choose a model.`
                    : `${selectedProviderRow?.name} signs in through your browser.`}
                </div>
                <Button className="min-w-28 justify-center" onClick={startProviderSetup} size="sm" variant="outline">
                  Set up {selectedProviderRow?.name ?? 'provider'}
                </Button>
              </>
            )
          ) : (
            <>
              <Select onValueChange={setSelectedModel} value={selectedModel}>
                <SelectTrigger className={cn('w-full', CONTROL_TEXT)}>
                  <SelectValue placeholder={t.settings.models.model} />
                </SelectTrigger>
                <SelectContent>
                  {(selectedProviderModels.length ? selectedProviderModels : []).map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="min-w-28 justify-center"
                disabled={!selectedProvider || !selectedModel || applying}
                onClick={() => void applyMainModel()}
                size="sm"
              >
                {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {applying ? t.settings.models.applying : t.settings.models.apply}
              </Button>
            </>
          )}
        </div>
        {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
        {switchStaleAux.length > 0 ? (
          <div className="mt-2">
            <StaleAuxWarning
              applying={applying}
              onReset={() => void resetAuxiliaryModels()}
              slots={switchStaleAux}
              taskLabel={auxiliaryTaskLabel}
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-[0.78rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-5 py-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading icon={Cpu} title={t.settings.models.auxiliaryModels} />
          <Button
            disabled={!mainModel || applying}
            onClick={() => void resetAuxiliaryModels()}
            size="sm"
            variant="outline"
          >
            {t.settings.models.resetAllToMain}
          </Button>
        </div>
        <p className="mb-3 text-[0.74rem] leading-5.5 text-[var(--muted)]">
          {t.settings.models.auxiliaryDescription}
        </p>
        {switchStaleAux.length === 0 && persistentStaleAux.length > 0 ? (
          <div className="mb-3">
            <StaleAuxWarning
              applying={applying}
              onReset={() => void resetAuxiliaryModels()}
              slots={persistentStaleAux}
              taskLabel={auxiliaryTaskLabel}
            />
          </div>
        ) : null}
        <div className="grid gap-2">
          {AUX_TASKS.map(meta => {
            const current = auxiliary?.tasks.find(entry => entry.task === meta.key)
            const isAuto = !current || !current.provider || current.provider === 'auto'
            const isEditing = editingAuxTask === meta.key

            return (
              <ListRow
                action={
                  !isEditing && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        disabled={!mainModel || applying}
                        onClick={() => void setAuxiliaryToMain(meta.key)}
                        size="sm"
                        variant="ghost"
                      >
                        {t.settings.models.setToMain}
                      </Button>
                      <Button
                        disabled={!providers.length || applying}
                        onClick={() => beginAuxiliaryEdit(meta.key)}
                        size="sm"
                        variant="outline"
                      >
                        {t.settings.models.change}
                      </Button>
                    </div>
                  )
                }
                below={
                  isEditing && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--separator)] pt-3">
                      <Select
                        onValueChange={value => setAuxDraft(prev => ({ ...prev, provider: value, model: '' }))}
                        value={auxDraft.provider}
                      >
                        <SelectTrigger className={cn('min-w-32', CONTROL_TEXT)}>
                          <SelectValue placeholder={t.settings.models.provider} />
                        </SelectTrigger>
                        <SelectContent>
                          {providerOptions.map(provider => (
                            <SelectItem key={provider.slug || 'none'} value={provider.slug || 'none'}>
                              {provider.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        onValueChange={value => setAuxDraft(prev => ({ ...prev, model: value }))}
                        value={auxDraft.model}
                      >
                        <SelectTrigger className={cn('min-w-48', CONTROL_TEXT)}>
                          <SelectValue placeholder={t.settings.models.model} />
                        </SelectTrigger>
                        <SelectContent>
                          {(auxDraftProviderModels.length ? auxDraftProviderModels : []).map(model => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={!auxDraft.provider || !auxDraft.model || applying}
                        onClick={() => void applyAuxiliaryDraft(meta.key)}
                        size="sm"
                      >
                        {applying ? t.settings.models.applying : t.settings.models.apply}
                      </Button>
                      <Button onClick={() => setEditingAuxTask(null)} size="sm" variant="ghost">
                        {t.common.cancel}
                      </Button>
                    </div>
                  )
                }
                description={
                  <span className="font-mono text-[0.68rem]">
                    {isAuto
                      ? t.settings.models.autoUseMain
                      : `${current.provider} · ${current.model || `(${t.settings.models.providerDefault})`}`}
                  </span>
                }
                key={meta.key}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {t.settings.models.tasks[meta.key]?.label ?? meta.label}
                    <Pill>{t.settings.models.tasks[meta.key]?.hint ?? meta.hint}</Pill>
                  </span>
                }
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

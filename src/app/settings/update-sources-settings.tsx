import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  DesktopAgentGitSource,
  DesktopHermesAgentUpdateStatus,
  DesktopNpmSource,
  DesktopPythonSource,
  DesktopUpdateProgress,
  DesktopUpdateStage,
  DesktopUpdateSourceConfig
} from '@/global'
import { useI18n } from '@/i18n'
import { AlertCircle, ArrowUpRight, Check, CheckCircle2, GitBranch, Globe, Loader2, Package, RefreshCw } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import type { SearchProps } from './types'
import { EmptyState, LoadingState, Pill, SectionHeading, SettingsContent } from './primitives'

type SourceKey = DesktopAgentGitSource | DesktopNpmSource | DesktopPythonSource

interface SourceOption<T extends SourceKey> {
  description: string
  disabled?: boolean
  label: string
  value: T
}

interface AgentUpdateProgressState {
  at: number
  error: string | null
  log: readonly string[]
  message: string
  percent: number | null
  stage: DesktopUpdateStage
}

const DEFAULT_SOURCES: DesktopUpdateSourceConfig = {
  agentGitCustomUrl: '',
  agentGitSource: 'gitee',
  desktopRepoUrl: 'https://github.com/meespace/hermes-desktop-tauri',
  npmCustomUrl: '',
  npmSource: 'npmjs',
  pythonCustomUrl: '',
  pythonSource: 'pypi'
}

function normalizeSources(config: DesktopUpdateSourceConfig): DesktopUpdateSourceConfig {
  return config.pythonSource === 'tsinghua' ? { ...config, pythonSource: 'pypi' } : config
}

function matchesQuery(query: string, values: readonly string[]) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }

  return values.some(value => value.toLowerCase().includes(needle))
}

function isTerminalStage(stage: DesktopUpdateStage) {
  return stage === 'done' || stage === 'error' || stage === 'manual'
}

function upsertProgressLog(log: readonly string[], message: string) {
  const next = message.trim()

  if (!next) {
    return log
  }

  return [...log, next].slice(-4)
}

function progressTone(stage: DesktopUpdateStage): 'danger' | 'muted' | 'primary' {
  if (stage === 'error') {
    return 'danger'
  }

  if (stage === 'done') {
    return 'muted'
  }

  return 'primary'
}

function progressFill(percent: number | null) {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    return null
  }

  return Math.max(4, Math.min(100, Math.round(percent)))
}

function AgentProgressCard({
  copy,
  progress,
  stages
}: {
  copy: ReturnType<typeof useI18n>['t']['settings']['updateSources']
  progress: AgentUpdateProgressState
  stages: Record<string, string>
}) {
  const percent = progressFill(progress.percent)
  const running = !isTerminalStage(progress.stage)
  const title = stages[progress.stage] ?? copy.managerUpdate
  const hint =
    progress.stage === 'done'
      ? copy.managerProgressDoneHint
      : progress.stage === 'error'
        ? copy.managerProgressErrorHint
        : copy.managerProgressRunningHint

  return (
    <div className="mt-3 rounded-[0.76rem] border border-[color-mix(in_srgb,var(--accent)_14%,transparent)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[0.76rem] font-semibold tracking-[-0.016em] text-[var(--foreground)]">{copy.managerProgressTitle}</h4>
            <Pill tone={progressTone(progress.stage)}>{title}</Pill>
            {percent !== null ? <Pill>{`${percent}%`}</Pill> : null}
          </div>
          <p className="mt-1 text-[0.68rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_64%,transparent)]">{hint}</p>
        </div>
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-[0.62rem] border',
            progress.stage === 'error'
              ? 'border-[color-mix(in_srgb,var(--danger)_18%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)]'
              : progress.stage === 'done'
                ? 'border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-[var(--workbench-active)] text-[var(--accent)]'
                : 'border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-[var(--workbench-active)] text-[var(--accent)]'
          )}
        >
          {progress.stage === 'error' ? (
            <AlertCircle className="size-4" />
          ) : progress.stage === 'done' ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Loader2 className="size-4 animate-spin" />
          )}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
        <div
          className={cn(
            'h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-out',
            percent === null && running && 'w-1/3 animate-pulse'
          )}
          style={percent !== null ? { width: `${percent}%` } : undefined}
        />
      </div>

      <div className="mt-3 rounded-[0.68rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--surface-secondary)] px-3 py-2.5">
        <div className="text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--foreground)_42%,transparent)]">
          {copy.managerProgressLatestLog}
        </div>
        <div className="mt-1.5 text-[0.68rem] leading-5 text-[var(--foreground)]">{progress.message}</div>
        {progress.log.length > 1 ? (
          <div className="mt-2 grid gap-1 text-[0.64rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
            {progress.log.slice(0, -1).map((line, index) => (
              <div key={`${progress.at}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SourceOptionButton<T extends SourceKey>({
  active,
  option,
  onSelect
}: {
  active: boolean
  option: SourceOption<T>
  onSelect: (value: T) => void
}) {
  return (
    <button
      className={cn(
        'group min-w-0 rounded-[0.58rem] border px-3 py-2 text-left transition-[background-color,border-color,color]',
        active
          ? 'border-[color-mix(in_srgb,var(--accent)_18%,transparent)] bg-[var(--workbench-active)] text-[var(--foreground)]'
          : option.disabled
            ? 'cursor-not-allowed border-[color-mix(in_srgb,var(--workbench-divider)_92%,transparent)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] text-[color-mix(in_srgb,var(--foreground)_38%,transparent)] opacity-70'
            : 'border-[color-mix(in_srgb,var(--workbench-divider)_92%,transparent)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] text-[var(--ui-text-secondary)] hover:bg-[var(--workbench-hover)]'
      )}
      disabled={option.disabled}
      onClick={() => onSelect(option.value)}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[0.76rem] font-medium tracking-[-0.016em]">{option.label}</span>
        {active ? <Check className="size-3.5 shrink-0 text-[var(--accent)]" /> : null}
      </span>
      <span className="mt-1 block truncate text-[0.64rem] text-[color-mix(in_srgb,var(--foreground)_52%,transparent)]">
        {option.description}
      </span>
    </button>
  )
}

function SourcePanel<T extends SourceKey>({
  children,
  description,
  icon: Icon,
  options,
  selected,
  title,
  onSelect
}: {
  children?: ReactNode
  description: string
  icon: typeof GitBranch
  options: readonly SourceOption<T>[]
  selected: T
  title: string
  onSelect: (value: T) => void
}) {
  return (
    <section className="rounded-[0.76rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-4 py-3.5 shadow-none">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] border border-[var(--workbench-divider)] bg-[var(--surface-secondary)] text-[var(--muted)]">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-[0.86rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{title}</h3>
            <Pill>{options.find(option => option.value === selected)?.label ?? selected}</Pill>
          </div>
          <p className="mt-1 text-[0.7rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {options.map(option => (
          <SourceOptionButton active={selected === option.value} key={option.value} onSelect={onSelect} option={option} />
        ))}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  )
}

export function UpdateSourcesSettings({ query }: SearchProps) {
  const { t } = useI18n()
  const copy = t.settings.updateSources
  const updateStages = t.updates.stages
  const desktop = window.hermesDesktop as Partial<typeof window.hermesDesktop>
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<DesktopUpdateSourceConfig>(DEFAULT_SOURCES)
  const [agentStatus, setAgentStatus] = useState<DesktopHermesAgentUpdateStatus | null>(null)
  const [agentProgress, setAgentProgress] = useState<AgentUpdateProgressState | null>(null)
  const [agentBusy, setAgentBusy] = useState<null | 'check' | 'install' | 'repair' | 'update'>(null)
  const trackingAgentUpdateRef = useRef(false)
  const agentCheckSupported = typeof desktop.checkHermesAgentUpdate === 'function'
  const agentInstallSupported = typeof desktop.installHermesAgent === 'function'
  const agentRepairSupported = typeof desktop.repairHermesAgent === 'function'
  const agentUpdateSupported = typeof desktop.updateHermesAgent === 'function'
  const agentUpgradeDisabled =
    !agentUpdateSupported || Boolean(agentBusy) || !agentStatus?.installed || !agentStatus.updateAvailable
  const agentManagerSupported =
    agentCheckSupported && agentInstallSupported && agentRepairSupported && agentUpdateSupported

  useEffect(() => {
    let cancelled = false

    window.hermesDesktop.updates
      .getSources()
      .then(config => {
        if (!cancelled) {
          setState(normalizeSources({ ...DEFAULT_SOURCES, ...config }))
        }
      })
      .catch(error => notifyError(error, copy.loadFailed))
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [copy.loadFailed])

  useEffect(() => {
    const onProgress = window.hermesDesktop?.updates?.onProgress

    if (typeof onProgress !== 'function') {
      return
    }

    return onProgress((payload: DesktopUpdateProgress) => {
      if (!trackingAgentUpdateRef.current) {
        return
      }

      setAgentProgress(current => ({
        at: payload.at,
        error: payload.error,
        log: upsertProgressLog(current?.log ?? [], payload.message),
        message: payload.message,
        percent: payload.percent,
        stage: payload.stage
      }))

      if (isTerminalStage(payload.stage)) {
        trackingAgentUpdateRef.current = false
      }
    })
  }, [])

  const visible = useMemo(
    () => ({
      agent: matchesQuery(query, [copy.agentTitle, copy.agentDescription, 'git', 'github', 'hermes agent']),
      desktop: matchesQuery(query, [copy.desktopTitle, copy.desktopDescription, copy.openRepository, 'desktop']),
      npm: matchesQuery(query, [copy.npmTitle, copy.npmDescription, 'npm', 'npmmirror']),
      python: matchesQuery(query, [copy.pythonTitle, copy.pythonDescription, 'python', 'pip', 'pypi', 'tsinghua', 'aliyun'])
    }),
    [copy, query]
  )

  const hasVisible = visible.agent || visible.python || visible.npm || visible.desktop

  const persistSources = async () => {
    const next = await window.hermesDesktop.updates.setSources(state)
    const normalized = normalizeSources({ ...DEFAULT_SOURCES, ...next })
    setState(normalized)
    return normalized
  }

  const save = async () => {
    setSaving(true)
    try {
      await persistSources()
      notify({
        title: copy.savedTitle,
        message: copy.savedMessage
      })
    } catch (error) {
      notifyError(error, copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const refreshAgentStatus = async (persistBeforeCheck = false) => {
    if (!agentCheckSupported) {
      return
    }

    setAgentBusy('check')
    try {
      if (persistBeforeCheck) {
        await persistSources()
      }
      const next = await desktop.checkHermesAgentUpdate?.()
      if (!next) {
        throw new Error(copy.managerUnavailableMessage)
      }
      setAgentStatus(next)
    } catch (error) {
      notifyError(error, copy.managerCheckFailed)
    } finally {
      setAgentBusy(null)
    }
  }

  const runAgentAction = async (action: 'install' | 'repair' | 'update') => {
    const handler =
      action === 'install'
        ? desktop.installHermesAgent
        : action === 'repair'
          ? desktop.repairHermesAgent
          : desktop.updateHermesAgent

    if (!handler) {
      return
    }

    setAgentBusy(action)
    try {
      if (action === 'update') {
        trackingAgentUpdateRef.current = true
        setAgentProgress({
          at: Date.now(),
          error: null,
          log: [updateStages.update ?? copy.managerUpdate],
          message: updateStages.update ?? copy.managerUpdate,
          percent: 8,
          stage: 'update'
        })
      } else {
        trackingAgentUpdateRef.current = false
        setAgentProgress(null)
      }

      await persistSources()
      const result = await handler()
      let nextStatus: DesktopHermesAgentUpdateStatus = result
      let commandCopied = false
      if (
        action !== 'update' &&
        'command' in result &&
        typeof result.command === 'string' &&
        result.command.trim()
      ) {
        const writeClipboard = window.hermesDesktop.writeClipboard
        if (typeof writeClipboard === 'function') {
          await writeClipboard(result.command)
          commandCopied = true
        }
      }
      if (action === 'update' && agentCheckSupported) {
        const refreshed = await desktop.checkHermesAgentUpdate?.()
        if (refreshed) {
          nextStatus = refreshed
        }
      }
      if (action === 'update') {
        trackingAgentUpdateRef.current = false
        setAgentProgress(current =>
          isTerminalStage(current?.stage ?? 'idle')
            ? current
            : {
                at: Date.now(),
                error: null,
                log: upsertProgressLog(current?.log ?? [], result.message),
                message: result.message,
                percent: 100,
                stage: result.ok ? 'done' : 'error'
              }
        )
      }
      setAgentStatus(nextStatus)
      if (result.ok) {
        notify({
          kind: 'success',
          title: copy.managerActionSuccessTitle,
          message: commandCopied ? `${result.message} Command copied to clipboard.` : result.message
        })
      } else {
        notify({ kind: 'warning', title: copy.managerActionWarningTitle, message: result.message })
      }
    } catch (error) {
      if (action === 'update') {
        const message = error instanceof Error ? error.message : String(error)
        trackingAgentUpdateRef.current = false
        setAgentProgress(current => ({
          at: Date.now(),
          error: 'update-failed',
          log: upsertProgressLog(current?.log ?? [], message),
          message,
          percent: current?.percent ?? null,
          stage: 'error'
        }))
      }
      notifyError(error, copy.managerActionFailed)
    } finally {
      setAgentBusy(null)
    }
  }

  useEffect(() => {
    if (agentManagerSupported) {
      void refreshAgentStatus()
    }
  }, [agentManagerSupported])

  if (loading) {
    return <LoadingState label={copy.loading} />
  }

  return (
    <SettingsContent>
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <section className="rounded-[0.76rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-4 py-3.5 shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <SectionHeading icon={GitBranch} meta={copy.managedBadge} title={copy.managerTitle} />
              <p className="-mt-2 max-w-2xl text-[0.72rem] leading-5.5 text-[color-mix(in_srgb,var(--foreground)_64%,transparent)]">
                {copy.managerDescription}
              </p>
              {!agentManagerSupported ? (
                <div className="mt-3 rounded-[0.72rem] border border-[color-mix(in_srgb,var(--danger)_18%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,transparent)] px-3 py-2.5 text-[0.68rem] leading-5 text-[var(--danger)]">
                  {copy.managerUnavailableMessage}
                </div>
              ) : null}
              {agentStatus ? (
                <div className="mt-3 grid gap-1 text-[0.68rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
                  <div>
                    {copy.managerStatusLabel}:
                    {agentStatus.installed
                      ? agentStatus.updateAvailable
                        ? ` ${copy.managerStatusUpdateAvailable}`
                        : ` ${copy.managerStatusInstalled}`
                      : ` ${copy.managerStatusNotInstalled}`}
                  </div>
                  <div>{copy.managerSourceLabel}: {agentStatus.source}</div>
                  <div>{copy.managerBranchLabel}: {agentStatus.branch}</div>
                  <div>{copy.managerVersionLabel}: {agentStatus.currentVersion ?? copy.managerUnknownValue}</div>
                  <div>{copy.managerCommitLabel}: {agentStatus.currentCommit ?? copy.managerUnknownValue}</div>
                  <div>{agentStatus.message}</div>
                </div>
              ) : null}
              {agentProgress ? <AgentProgressCard copy={copy} progress={agentProgress} stages={updateStages} /> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                disabled={!agentCheckSupported || Boolean(agentBusy)}
                onClick={() => void refreshAgentStatus(true)}
                size="sm"
                variant="outline"
              >
                {agentBusy === 'check' ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                {copy.managerCheck}
              </Button>
              <Button disabled={!agentRepairSupported || Boolean(agentBusy)} onClick={() => void runAgentAction('repair')} size="sm" variant="outline">
                {agentBusy === 'repair' ? <Loader2 className="size-3 animate-spin" /> : null}
                {copy.managerRepair}
              </Button>
              {agentStatus?.installed ? (
                <Button disabled={agentUpgradeDisabled} onClick={() => void runAgentAction('update')} size="sm">
                  {agentBusy === 'update' ? <Loader2 className="size-3 animate-spin" /> : null}
                  {copy.managerUpdate}
                </Button>
              ) : (
                <Button disabled={!agentInstallSupported || Boolean(agentBusy)} onClick={() => void runAgentAction('install')} size="sm">
                  {agentBusy === 'install' ? <Loader2 className="size-3 animate-spin" /> : null}
                  {copy.managerInstall}
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-[0.76rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <SectionHeading icon={RefreshCw} meta={copy.manualBadge} title={copy.title} />
            <p className="-mt-2 max-w-2xl text-[0.72rem] leading-5.5 text-[color-mix(in_srgb,var(--foreground)_64%,transparent)]">
              {copy.intro}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button disabled={saving} onClick={() => setState(DEFAULT_SOURCES)} size="sm" variant="outline">
              {copy.reset}
            </Button>
            <Button disabled={saving} onClick={() => void save()} size="sm">
              {saving ? <Loader2 className="size-3 animate-spin" /> : null}
              {saving ? copy.saving : copy.save}
            </Button>
          </div>
        </div>

        {!hasVisible ? (
          <EmptyState description={copy.emptyDescription} title={copy.emptyTitle} />
        ) : (
          <>
            {visible.agent ? (
              <SourcePanel
                description={copy.agentDescription}
                icon={GitBranch}
                onSelect={agentGitSource => setState(current => ({ ...current, agentGitSource }))}
                options={[
                  { label: copy.githubGit, description: copy.githubGitDescription, value: 'github' },
                  { label: copy.giteeGit, description: copy.giteeGitDescription, value: 'gitee' },
                  { label: copy.gitcodeGit, description: copy.gitcodeGitDescription, value: 'gitcode' },
                  { label: copy.customMirror, description: copy.customMirrorDescription, value: 'custom' }
                ]}
                selected={state.agentGitSource}
                title={copy.agentTitle}
              >
                {state.agentGitSource === 'custom' ? (
                  <Input
                    className="h-9 text-[0.72rem]"
                    onChange={event => setState(current => ({ ...current, agentGitCustomUrl: event.target.value }))}
                    placeholder="https://gitee.com/your-org/hermes-agent.git"
                    value={state.agentGitCustomUrl}
                  />
                ) : null}
              </SourcePanel>
            ) : null}

            {visible.python ? (
              <SourcePanel
                description={copy.pythonDescription}
                icon={Globe}
                onSelect={pythonSource => setState(current => ({ ...current, pythonSource }))}
                options={[
                  { label: copy.pypi, description: copy.pypiDescription, value: 'pypi' },
                  { label: copy.tsinghua, description: copy.tsinghuaDescription, disabled: true, value: 'tsinghua' },
                  { label: copy.aliyun, description: copy.aliyunDescription, value: 'aliyun' },
                  { label: copy.custom, description: copy.customPythonDescription, value: 'custom' }
                ]}
                selected={state.pythonSource}
                title={copy.pythonTitle}
              >
                {state.pythonSource === 'custom' ? (
                  <Input
                    className="h-9 text-[0.72rem]"
                    onChange={event => setState(current => ({ ...current, pythonCustomUrl: event.target.value }))}
                    placeholder="https://example.com/pypi/simple"
                    value={state.pythonCustomUrl}
                  />
                ) : null}
              </SourcePanel>
            ) : null}

            {visible.npm ? (
              <SourcePanel
                description={copy.npmDescription}
                icon={Package}
                onSelect={npmSource => setState(current => ({ ...current, npmSource }))}
                options={[
                  { label: copy.npmjs, description: copy.npmjsDescription, value: 'npmjs' },
                  { label: copy.npmmirror, description: copy.npmmirrorDescription, value: 'npmmirror' },
                  { label: copy.custom, description: copy.customNpmDescription, value: 'custom' }
                ]}
                selected={state.npmSource}
                title={copy.npmTitle}
              >
                {state.npmSource === 'custom' ? (
                  <Input
                    className="h-9 text-[0.72rem]"
                    onChange={event => setState(current => ({ ...current, npmCustomUrl: event.target.value }))}
                    placeholder="https://registry.example.com/"
                    value={state.npmCustomUrl}
                  />
                ) : null}
              </SourcePanel>
            ) : null}

            {visible.desktop ? (
              <section className="rounded-[0.76rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-4 py-3.5 shadow-none">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[0.86rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                        {copy.desktopTitle}
                      </h3>
                      <Pill tone="primary">{copy.manualOnly}</Pill>
                    </div>
                    <p className="mt-1 text-[0.7rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
                      {copy.desktopDescription}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      void persistSources()
                        .then(() => window.hermesDesktop.updates.openRepository())
                        .catch(error => notifyError(error, copy.saveFailed))
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <ArrowUpRight className="size-3.5" />
                    {copy.openRepository}
                  </Button>
                </div>
                <Input
                  className="mt-3 h-9 text-[0.72rem]"
                  onChange={event => setState(current => ({ ...current, desktopRepoUrl: event.target.value }))}
                  placeholder="https://github.com/your-name/hermes-desktop-tauri"
                  value={state.desktopRepoUrl}
                />
                <p className="mt-2 text-[0.64rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_52%,transparent)]">
                  {copy.desktopHint}
                </p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </SettingsContent>
  )
}

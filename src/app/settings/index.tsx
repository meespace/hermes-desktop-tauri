import { IconDownload, IconRefresh, IconUpload } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { getHermesConfigDefaults, getHermesConfigRecord, saveHermesConfig } from '@/hermes'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Archive, Globe, Info, KeyRound, RefreshCw, Wrench, Zap } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { OverlaySearchInput } from '../overlays/overlay-search-input'

import { AboutSettings } from './about-settings'
import { AppearanceSettings } from './appearance-settings'
import { ConfigSettings } from './config-settings'
import { SECTIONS } from './constants'
import { GatewaySettings } from './gateway-settings'
import { KeysSettings } from './keys-settings'
import { McpSettings } from './mcp-settings'
import { ProvidersSettings } from './providers-settings'
import { SessionsSettings } from './sessions-settings'
import type { SettingsPageProps, SettingsQueryKey, SettingsView as SettingsViewId } from './types'
import { UpdateSourcesSettings } from './update-sources-settings'

const SETTINGS_VIEWS: readonly SettingsViewId[] = [
  ...SECTIONS.map(s => `config:${s.id}` as SettingsViewId),
  'providers',
  'gateway',
  'keys',
  'mcp',
  'sessions',
  'updateSources',
  'about'
]

function resolveViewMeta(activeView: SettingsViewId, t: ReturnType<typeof useI18n>['t']) {
  if (activeView.startsWith('config:')) {
    const sectionId = activeView.slice('config:'.length)

    return {
      eyebrow: t.settings.shell.configurationEyebrow,
      title: t.settings.sections[sectionId as keyof typeof t.settings.sections] ?? t.settings.shell.settingsTitle,
      description:
        t.settings.sectionDescriptions[sectionId as keyof typeof t.settings.sectionDescriptions] ??
        t.settings.shell.settingsIntro
    }
  }

  return {
    eyebrow: t.settings.shell.desktopEyebrow,
    title: t.settings.viewTitles[activeView],
    description: t.settings.viewDescriptions[activeView]
  }
}

function SettingsUtilityAction({
  icon: Icon,
  label,
  description,
  onClick,
  danger = false
}: {
  icon: typeof IconDownload
  label: string
  description: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      className="flex w-full items-start gap-2.5 rounded-[0.52rem] border border-transparent bg-transparent px-2.5 py-2 text-left transition-[background-color,border-color,color] hover:border-[color-mix(in_srgb,var(--workbench-divider)_96%,transparent)] hover:bg-[var(--workbench-hover)]"
      onClick={onClick}
      type="button"
    >
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[0.58rem] border ${
          danger
            ? 'border-[color-mix(in_srgb,var(--danger)_18%,transparent)] bg-[var(--danger-soft)] text-[var(--danger)]'
            : 'border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] text-[var(--muted)]'
        }`}
      >
        <Icon className="size-3.25" />
      </span>
      <span className="min-w-0">
        <span className={`block text-[0.73rem] font-medium ${danger ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'}`}>
          {label}
        </span>
        <span className="mt-0.5 block text-[0.64rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]">
          {description}
        </span>
      </span>
    </button>
  )
}

export function SettingsView({ gateway, onClose, onConfigSaved, onMainModelChanged }: SettingsPageProps) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useRouteEnumParam('tab', SETTINGS_VIEWS, 'config:model' as SettingsViewId)

  const [queries, setQueries] = useState<Record<SettingsQueryKey, string>>({
    about: '',
    config: '',
    gateway: '',
    keys: '',
    mcp: '',
    providers: '',
    sessions: '',
    updateSources: ''
  })

  const searchInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const queryKey: SettingsQueryKey = activeView.startsWith('config:') ? 'config' : (activeView as SettingsQueryKey)
  const query = queries[queryKey]
  const setQuery = (next: string) => setQueries(c => ({ ...c, [queryKey]: next }))
  const activeMeta = resolveViewMeta(activeView, t)

  const exportConfig = async () => {
    try {
      const cfg = await getHermesConfigRecord()
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hermes-config.json'
      a.click()
      URL.revokeObjectURL(url)
      triggerHaptic('success')
    } catch (err) {
      notifyError(err, t.settings.exportFailed)
    }
  }

  const resetConfig = async () => {
    if (!window.confirm(t.settings.resetConfirm)) {
      return
    }

    try {
      await saveHermesConfig(await getHermesConfigDefaults())
      triggerHaptic('success')
      onConfigSaved?.()
    } catch (err) {
      notifyError(err, t.settings.resetFailed)
    }
  }

  // OverlayView handles Esc; this just adds Cmd/Ctrl+P → focus search.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--workbench-shell-bg)] p-2 pt-2">
      <div className="grid min-h-0 flex-1 grid-cols-[13.5rem_minmax(0,1fr)] gap-2 max-[72rem]:grid-cols-1">
        <aside className="scrollbar-dt flex min-h-0 flex-col overflow-y-auto rounded-[0.82rem] border border-[color-mix(in_srgb,var(--workbench-panel-stroke)_96%,transparent)] bg-[var(--workbench-panel-bg)] px-2.5 py-2 shadow-none">
          <div className="border-b border-[var(--workbench-divider)] px-1 pb-3">
            <div className="inline-flex h-5 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_12%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-2 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent)]" />
              {t.settings.shell.desktopEyebrow}
            </div>
            <div className="mt-2 text-[0.92rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {t.settings.shell.settingsTitle}
            </div>
            <p className="mt-1 text-[0.67rem] leading-5 text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
              {t.settings.shell.settingsIntro}
            </p>
          </div>

          <div className="mt-3">
            <OverlaySearchInput
              containerClassName="w-full"
              inputClassName="h-8 rounded-[0.58rem] border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] py-2 pl-8 text-[0.69rem] shadow-none"
              inputRef={searchInputRef}
              onChange={setQuery}
              placeholder={t.settings.searchPlaceholder[queryKey]}
              value={query}
            />
          </div>

          <div className="mt-4 px-1 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[var(--ui-text-quaternary)]">
            {t.settings.shell.configurationEyebrow}
          </div>
          <div className="mt-1.5 grid gap-0.5">
            {SECTIONS.map(section => {
              const view = `config:${section.id}` as SettingsViewId
              const Icon = section.icon
              const active = activeView === view && !queries.config.trim()
              const label = t.settings.sections[section.id as keyof typeof t.settings.sections] ?? section.label

              return (
                <button
                  className={cn(
                    'group flex h-9 items-center gap-2 rounded-[0.52rem] border border-transparent px-2.5 text-left transition-[background-color,border-color,color]',
                    active
                      ? 'bg-[var(--workbench-active)] text-[var(--foreground)]'
                      : 'bg-transparent text-[var(--ui-text-secondary)] hover:bg-[var(--workbench-hover)]'
                  )}
                  key={section.id}
                  onClick={() => setActiveView(view)}
                  type="button"
                >
                  <span
                    className={cn(
                      'grid size-[1.25rem] shrink-0 place-items-center rounded-[0.32rem] border transition-colors',
                      active
                        ? 'border-[color-mix(in_srgb,var(--accent)_16%,transparent)] bg-[var(--surface)] text-[var(--accent)]'
                        : 'border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] text-[var(--ui-text-quaternary)] group-hover:text-[var(--muted)]'
                    )}
                  >
                    <Icon className="size-[0.78rem]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.72rem] font-medium tracking-[-0.012em]">
                    {label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="my-3 h-px bg-[var(--workbench-divider)]" />

          <div className="grid gap-0.5">
            {[
              { icon: Zap, label: t.settings.nav.providers, view: 'providers' as const },
              { icon: Globe, label: t.settings.nav.gateway, view: 'gateway' as const },
              { icon: KeyRound, label: t.settings.nav.apiKeys, view: 'keys' as const },
              { icon: Wrench, label: 'MCP', view: 'mcp' as const },
              { icon: Archive, label: t.settings.nav.archivedChats, view: 'sessions' as const },
              { icon: RefreshCw, label: t.settings.nav.updateSources, view: 'updateSources' as const },
              { icon: Info, label: t.settings.nav.about, view: 'about' as const }
            ].map(item => {
              const Icon = item.icon
              const active = activeView === item.view

              return (
                <button
                  className={cn(
                    'group flex h-9 items-center gap-2 rounded-[0.52rem] border border-transparent px-2.5 text-left transition-[background-color,border-color,color]',
                    active
                      ? 'bg-[var(--workbench-active)] text-[var(--foreground)]'
                      : 'bg-transparent text-[var(--ui-text-secondary)] hover:bg-[var(--workbench-hover)]'
                  )}
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  type="button"
                >
                  <span
                    className={cn(
                      'grid size-[1.25rem] shrink-0 place-items-center rounded-[0.32rem] border transition-colors',
                      active
                        ? 'border-[color-mix(in_srgb,var(--accent)_16%,transparent)] bg-[var(--surface)] text-[var(--accent)]'
                        : 'border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] text-[var(--ui-text-quaternary)] group-hover:text-[var(--muted)]'
                    )}
                  >
                    <Icon className="size-[0.78rem]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.72rem] font-medium tracking-[-0.012em]">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-auto border-t border-[var(--workbench-divider)] pt-3">
            <div className="px-1 pb-1 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[var(--ui-text-quaternary)]">
              {t.settings.shell.configurationEyebrow}
            </div>
            <div className="grid gap-0.5">
              <SettingsUtilityAction
                description="Download your desktop settings as JSON."
                icon={IconDownload}
                label={t.settings.exportConfig}
                onClick={() => void exportConfig()}
              />
              <SettingsUtilityAction
                description="Import a saved settings file into this desktop app."
                icon={IconUpload}
                label={t.settings.importConfig}
                onClick={() => {
                  triggerHaptic('open')
                  importInputRef.current?.click()
                }}
              />
              <SettingsUtilityAction
                danger
                description="Reset every preference to the Hermes defaults."
                icon={IconRefresh}
                label={t.settings.resetToDefaults}
                onClick={() => {
                  triggerHaptic('warning')
                  void resetConfig()
                }}
              />
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[0.82rem] border border-[color-mix(in_srgb,var(--workbench-panel-stroke)_96%,transparent)] bg-[var(--workbench-panel-bg)] shadow-none">
          <div className="border-b border-[var(--workbench-divider)] bg-[var(--workbench-panel-muted-bg)] px-5 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex h-5 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_12%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-2 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent)]" />
                  {activeMeta.eyebrow}
                </div>
                <h1 className="mt-1.5 text-[1.12rem] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  {activeMeta.title}
                </h1>
                <p className="mt-0.5 max-w-3xl text-[0.75rem] leading-5.5 text-[color-mix(in_srgb,var(--foreground)_64%,transparent)]">
                  {activeMeta.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-[24rem] lg:justify-end">
                <div className="inline-flex min-h-8 items-center gap-2 rounded-[0.55rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-3 py-1 text-[0.66rem] text-[color-mix(in_srgb,var(--foreground)_64%,transparent)]">
                  <span className="text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-quaternary)]">
                    {t.settings.shell.quickSearch}
                  </span>
                  <span>Cmd/Ctrl+P</span>
                </div>
                <Button
                  className="h-8 rounded-[0.55rem] border-[var(--workbench-divider)] px-3 text-[0.7rem] shadow-none"
                  onClick={() => {
                    triggerHaptic('close')
                    onClose()
                  }}
                  variant="secondary"
                >
                  <Codicon name="arrow-left" size="0.9rem" />
                  {t.settings.shell.back}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-[var(--workbench-canvas-bg)]">
            {activeView === 'config:appearance' ? (
              <AppearanceSettings />
            ) : activeView === 'about' ? (
              <AboutSettings />
            ) : activeView === 'gateway' ? (
              <GatewaySettings />
            ) : activeView.startsWith('config:') ? (
              <ConfigSettings
                activeSectionId={activeView.slice('config:'.length)}
                importInputRef={importInputRef}
                onConfigSaved={onConfigSaved}
                onMainModelChanged={onMainModelChanged}
                query={queries.config}
              />
            ) : activeView === 'providers' ? (
              <ProvidersSettings onOpenApiKeys={() => setActiveView('keys')} query={queries.providers} />
            ) : activeView === 'keys' ? (
              <KeysSettings query={queries.keys} />
            ) : activeView === 'mcp' ? (
              <McpSettings gateway={gateway} onConfigSaved={onConfigSaved} query={queries.mcp} />
            ) : activeView === 'updateSources' ? (
              <UpdateSourcesSettings query={queries.updateSources} />
            ) : (
              <SessionsSettings query={queries.sessions} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export { SettingsView as SettingsPage }

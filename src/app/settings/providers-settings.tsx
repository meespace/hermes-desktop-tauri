import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getEnvVars, getGlobalModelOptions, listOAuthProviders } from '@/hermes'
import { useI18n } from '@/i18n'
import { ArrowUpRight, Zap } from '@/lib/icons'
import { $desktopOnboarding, startManualProviderOAuth } from '@/store/onboarding'
import type { EnvVarInfo, ModelOptionProvider, OAuthProvider } from '@/types/hermes'

import { LOCAL_ENDPOINT_ENV_KEY } from './constants'
import { LoadingState, Pill, SectionHeading, SettingsContent } from './primitives'
import type { SearchProps } from './types'

type ProviderSummaryGroup = 'api_key' | 'local' | 'oauth'
type ProviderSummaryStatus = 'configured' | 'connected' | 'needs_setup' | 'not_configured'

interface ProviderSummaryRow {
  action: 'connect' | 'open_keys'
  description: string
  group: ProviderSummaryGroup
  id: string
  keyEnv?: string
  kindLabel: string
  name: string
  oauthProvider?: OAuthProvider
  status: ProviderSummaryStatus
}

interface ProvidersSettingsProps extends SearchProps {
  onOpenApiKeys: () => void
}

const statusRank: Record<ProviderSummaryStatus, number> = {
  connected: 0,
  configured: 1,
  needs_setup: 2,
  not_configured: 3
}

const groupRank: Record<ProviderSummaryGroup, number> = {
  oauth: 0,
  api_key: 1,
  local: 2
}

function statusTone(status: ProviderSummaryStatus): 'danger' | 'muted' | 'primary' {
  return status === 'connected' || status === 'configured' ? 'primary' : status === 'needs_setup' ? 'danger' : 'muted'
}

function matchesQuery(query: string, values: readonly string[]) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }

  return values.some(value => value.toLowerCase().includes(needle))
}

function ProviderSummaryButton({
  actionLabel,
  onClick,
  row,
  statusLabel
}: {
  actionLabel: string
  onClick: () => void
  row: ProviderSummaryRow
  statusLabel: string
}) {
  return (
    <button
      className="group grid gap-3 rounded-[0.74rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-4 py-3 text-left transition-[background-color,border-color,color] hover:border-[color-mix(in_srgb,var(--accent)_14%,transparent)] hover:bg-[var(--workbench-hover)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.84rem] font-medium tracking-[-0.018em] text-[var(--foreground)]">{row.name}</span>
          <Pill>{row.kindLabel}</Pill>
          <Pill tone={statusTone(row.status)}>{statusLabel}</Pill>
        </div>
        <p className="mt-1 text-[0.71rem] leading-5.5 text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
          {row.description}
        </p>
        {row.keyEnv ? (
          <div className="mt-1 font-mono text-[0.63rem] text-[color-mix(in_srgb,var(--foreground)_44%,transparent)]">
            {row.keyEnv}
          </div>
        ) : null}
      </div>
      <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-[var(--accent)]">
        {actionLabel}
        <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

function SummarySection({
  connectLabel,
  countLabel,
  description,
  openInKeysLabel,
  rows,
  title,
  onSelect,
  statusLabel
}: {
  connectLabel: string
  countLabel: string
  description: string
  openInKeysLabel: string
  rows: ProviderSummaryRow[]
  title: string
  onSelect: (row: ProviderSummaryRow) => void
  statusLabel: (status: ProviderSummaryStatus) => string
}) {
  if (rows.length === 0) {
    return null
  }

  return (
    <section className="grid gap-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[0.84rem] font-medium tracking-[-0.018em] text-[var(--foreground)]">
            <span>{title}</span>
            <Pill>{countLabel}</Pill>
          </div>
          <p className="mt-1 text-[0.71rem] leading-5.5 text-[color-mix(in_srgb,var(--foreground)_66%,transparent)]">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-2.5">
        {rows.map(row => (
          <ProviderSummaryButton
            actionLabel={row.action === 'connect' ? connectLabel : openInKeysLabel}
            key={row.id}
            onClick={() => onSelect(row)}
            row={row}
            statusLabel={statusLabel(row.status)}
          />
        ))}
      </div>
    </section>
  )
}

export function ProvidersSettings({ onOpenApiKeys, query }: ProvidersSettingsProps) {
  const { t } = useI18n()
  const p = t.settings.providers
  const onboardingActive = useStore($desktopOnboarding).manual
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[] | null>(null)
  const [modelProviders, setModelProviders] = useState<ModelOptionProvider[] | null>(null)
  const [envVars, setEnvVars] = useState<Record<string, EnvVarInfo> | null>(null)

  useEffect(() => {
    if (onboardingActive) {
      return
    }

    let cancelled = false

    void Promise.all([listOAuthProviders(), getGlobalModelOptions(), getEnvVars()])
      .then(([oauth, models, env]) => {
        if (cancelled) {
          return
        }

        setOauthProviders(oauth.providers ?? [])
        setModelProviders(models.providers ?? [])
        setEnvVars(env)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setOauthProviders([])
        setModelProviders([])
        setEnvVars({})
      })

    return () => {
      cancelled = true
    }
  }, [onboardingActive])

  const rows = useMemo<ProviderSummaryRow[]>(() => {
    if (!oauthProviders || !modelProviders || !envVars) {
      return []
    }

    const oauthRows: ProviderSummaryRow[] = oauthProviders.map(provider => ({
      action: 'connect',
      description: provider.flow === 'external' ? 'Uses external CLI sign-in through Hermes.' : 'Uses browser-based sign-in through Hermes.',
      group: 'oauth',
      id: `oauth:${provider.id}`,
      kindLabel: p.kindOauth,
      name: provider.name,
      oauthProvider: provider,
      status: provider.status?.logged_in ? 'connected' : 'needs_setup'
    }))

    const apiKeyRows: ProviderSummaryRow[] = modelProviders
      .filter(provider => provider.auth_type === 'api_key' && provider.key_env && provider.key_env !== LOCAL_ENDPOINT_ENV_KEY)
      .map(provider => {
        const env = envVars[provider.key_env!]
        return {
          action: 'open_keys' as const,
          description: env?.description || `Direct API access to ${provider.name}.`,
          group: 'api_key' as const,
          id: `api:${provider.slug}`,
          keyEnv: provider.key_env,
          kindLabel: p.kindApiKey,
          name: provider.name,
          status: env?.is_set ? 'configured' : 'not_configured'
        }
      })

    const localEnv = envVars[LOCAL_ENDPOINT_ENV_KEY]
    const localRows: ProviderSummaryRow[] = [
      {
        action: 'open_keys',
        description: p.localEndpointDescription,
        group: 'local',
        id: 'local:openai-compatible',
        keyEnv: LOCAL_ENDPOINT_ENV_KEY,
        kindLabel: p.kindLocal,
        name: p.localEndpointName,
        status: localEnv?.is_set ? 'configured' : 'not_configured'
      }
    ]

    const filtered = [...oauthRows, ...apiKeyRows, ...localRows].filter(row =>
      matchesQuery(query, [row.name, row.description, row.kindLabel, row.keyEnv || '', row.group])
    )

    return filtered.sort((a, b) => {
      if (a.group !== b.group) {
        return groupRank[a.group] - groupRank[b.group]
      }

      return statusRank[a.status] - statusRank[b.status] || a.name.localeCompare(b.name)
    })
  }, [envVars, modelProviders, oauthProviders, p.kindApiKey, p.kindLocal, p.kindOauth, p.localEndpointDescription, p.localEndpointName, query])

  const grouped = useMemo(() => {
    const oauth = rows.filter(row => row.group === 'oauth')
    const apiKey = rows.filter(row => row.group === 'api_key')
    const local = rows.filter(row => row.group === 'local')

    return { oauth, apiKey, local }
  }, [rows])

  if (!oauthProviders || !modelProviders || !envVars) {
    return <LoadingState label={p.loading} />
  }

  const statusLabel = (status: ProviderSummaryStatus) =>
    status === 'connected'
      ? p.connected
      : status === 'configured'
        ? p.configured
        : status === 'needs_setup'
          ? p.needsSetup
          : p.notConfigured

  const selectRow = (row: ProviderSummaryRow) => {
    if (row.action === 'connect' && row.oauthProvider) {
      startManualProviderOAuth(row.oauthProvider.id)
      return
    }

    onOpenApiKeys()
  }

  const configuredCount = (sectionRows: ProviderSummaryRow[]) =>
    sectionRows.filter(row => row.status === 'connected' || row.status === 'configured').length

  return (
    <SettingsContent>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionHeading icon={Zap} title={p.title} />
          <p className="-mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">{p.intro}</p>
        </div>
        <Button onClick={onOpenApiKeys} size="sm" variant="outline">
          {p.apiKeys}
        </Button>
      </div>

      <SummarySection
        connectLabel={p.connect}
        countLabel={p.sectionMeta(configuredCount(grouped.oauth), grouped.oauth.length)}
        description={p.oauthSectionDescription}
        onSelect={selectRow}
        openInKeysLabel={p.openInKeys}
        rows={grouped.oauth}
        statusLabel={statusLabel}
        title={p.oauthSectionTitle}
      />

      <SummarySection
        connectLabel={p.connect}
        countLabel={p.sectionMeta(configuredCount(grouped.apiKey), grouped.apiKey.length)}
        description={p.apiKeySectionDescription}
        onSelect={selectRow}
        openInKeysLabel={p.openInKeys}
        rows={grouped.apiKey}
        statusLabel={statusLabel}
        title={p.apiKeySectionTitle}
      />

      <SummarySection
        connectLabel={p.connect}
        countLabel={p.sectionMeta(configuredCount(grouped.local), grouped.local.length)}
        description={p.localSectionDescription}
        onSelect={selectRow}
        openInKeysLabel={p.openInKeys}
        rows={grouped.local}
        statusLabel={statusLabel}
        title={p.localSectionTitle}
      />
    </SettingsContent>
  )
}

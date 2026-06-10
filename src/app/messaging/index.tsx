import type * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageLoader } from '@/components/page-loader'
import { StatusDot, type StatusTone } from '@/components/status-dot'
import { Button } from '@/components/ui/button'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  getMessagingPlatforms,
  type MessagingEnvVarInfo,
  type MessagingPlatformInfo,
  updateMessagingPlatform
} from '@/hermes'
import { useI18n } from '@/i18n'
import { AlertTriangle, ExternalLink, Save, Trash2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { PageSearchShell } from '../page-search-shell'
import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'

import { PlatformAvatar } from './platform-icon'

interface MessagingViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
}

type EditMap = Record<string, Record<string, string>>

const PILL_TONE: Record<StatusTone, string> = {
  good: 'bg-[var(--surface-secondary)] text-foreground shadow-[var(--field-shadow)]',
  muted: 'bg-[var(--surface-secondary)] text-[var(--muted)] shadow-[var(--field-shadow)]',
  warn: 'bg-[var(--warning-soft)] text-[var(--warning-soft-foreground)] shadow-[var(--field-shadow)]',
  bad: 'bg-[var(--danger-soft)] text-[var(--danger-soft-foreground)] shadow-[var(--field-shadow)]'
}

const stateLabel = (state: null | string | undefined, t: ReturnType<typeof useI18n>['t']) =>
  state ? t.messagingView.states[state] || state.replace(/_/g, ' ') : t.messagingView.unknown

function stateTone({ enabled, state }: MessagingPlatformInfo): StatusTone {
  if (!enabled) {
    return 'muted'
  }

  if (state === 'connected') {
    return 'good'
  }

  if (state === 'fatal' || state === 'startup_failed') {
    return 'bad'
  }

  return 'warn'
}

const trimEdits = (edits: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(edits)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v)
  )

const FIELD_COPY: Record<string, { advanced?: boolean; help?: string; label?: string; placeholder?: string }> = {
  TELEGRAM_BOT_TOKEN: {
    label: 'Bot token',
    help: 'Create a bot with @BotFather, then paste the token it gives you.',
    placeholder: '123456:ABC...'
  },
  TELEGRAM_ALLOWED_USERS: {
    label: 'Allowed Telegram user IDs',
    help: 'Recommended. Comma-separated numeric IDs from @userinfobot. Without this, anyone can DM your bot.'
  },
  TELEGRAM_PROXY: {
    label: 'Proxy URL',
    help: 'Only needed on networks where Telegram is blocked.',
    advanced: true
  },
  DISCORD_BOT_TOKEN: {
    label: 'Bot token',
    help: 'Create an application in the Discord Developer Portal, add a bot, then paste its token.'
  },
  DISCORD_ALLOWED_USERS: {
    label: 'Allowed Discord user IDs',
    help: 'Recommended. Comma-separated Discord user IDs.'
  },
  DISCORD_REPLY_TO_MODE: {
    label: 'Reply style',
    help: 'first, all, or off.',
    advanced: true
  },
  SLACK_BOT_TOKEN: {
    label: 'Slack bot token',
    help: 'Starts with xoxb-. Found under OAuth & Permissions after installing your Slack app.',
    placeholder: 'xoxb-...'
  },
  SLACK_APP_TOKEN: {
    label: 'Slack app token',
    help: 'Starts with xapp-. Required for Socket Mode.',
    placeholder: 'xapp-...'
  },
  SLACK_ALLOWED_USERS: {
    label: 'Allowed Slack user IDs',
    help: 'Recommended. Comma-separated Slack user IDs.'
  },
  MATTERMOST_URL: {
    label: 'Server URL',
    placeholder: 'https://mattermost.example.com'
  },
  MATTERMOST_TOKEN: {
    label: 'Bot token'
  },
  MATTERMOST_ALLOWED_USERS: {
    label: 'Allowed user IDs',
    help: 'Recommended. Comma-separated Mattermost user IDs.'
  },
  MATRIX_HOMESERVER: {
    label: 'Homeserver URL',
    placeholder: 'https://matrix.org'
  },
  MATRIX_ACCESS_TOKEN: {
    label: 'Access token'
  },
  MATRIX_USER_ID: {
    label: 'Bot user ID',
    placeholder: '@hermes:example.org'
  },
  MATRIX_ALLOWED_USERS: {
    label: 'Allowed Matrix user IDs',
    help: 'Recommended. Comma-separated user IDs in @user:server format.'
  },
  SIGNAL_HTTP_URL: {
    label: 'Signal bridge URL',
    placeholder: 'http://127.0.0.1:8080',
    help: 'URL of a running signal-cli REST bridge.'
  },
  SIGNAL_ACCOUNT: {
    label: 'Phone number',
    help: 'The number registered with your signal-cli bridge.'
  },
  SIGNAL_ALLOWED_USERS: {
    label: 'Allowed Signal users',
    help: 'Recommended. Comma-separated Signal identifiers.'
  },
  WHATSAPP_ENABLED: {
    label: 'Enable WhatsApp bridge',
    help: 'Set automatically by the toggle below. Leave alone unless you know you need it.',
    advanced: true
  },
  WHATSAPP_MODE: {
    label: 'Bridge mode',
    advanced: true
  },
  WHATSAPP_ALLOWED_USERS: {
    label: 'Allowed WhatsApp users',
    help: 'Recommended. Comma-separated phone numbers or WhatsApp IDs.'
  }
}

function fieldCopy(field: MessagingEnvVarInfo, t: ReturnType<typeof useI18n>['t']) {
  const translated = t.messagingView.fields[field.key] as
    | { help?: string; label?: string; placeholder?: string }
    | undefined
  const copy = FIELD_COPY[field.key] || {}

  return {
    label: translated?.label || copy.label || field.prompt || field.key,
    help: translated?.help || copy.help || field.description,
    placeholder: translated?.placeholder || copy.placeholder || field.prompt,
    advanced: Boolean(copy.advanced || field.advanced)
  }
}

export function MessagingView({ setStatusbarItemGroup: _setStatusbarItemGroup, ...props }: MessagingViewProps) {
  const { t } = useI18n()
  const [platforms, setPlatforms] = useState<MessagingPlatformInfo[] | null>(null)
  const [edits, setEdits] = useState<EditMap>({})
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const platformIds = useMemo(() => platforms?.map(p => p.id) ?? [], [platforms])
  const [selectedId, setSelectedId] = useRouteEnumParam('platform', platformIds, platformIds[0] ?? '')

  const refreshPlatforms = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true)
    }

    try {
      const result = await getMessagingPlatforms()
      setPlatforms(result.platforms)
    } catch (err) {
      if (!silent) {
        notifyError(err, t.messagingView.failedToLoad)
      }
    } finally {
      if (!silent) {
        setRefreshing(false)
      }
    }
  }, [t.messagingView.failedToLoad])

  useEffect(() => {
    void refreshPlatforms()
  }, [refreshPlatforms])

  // Auto-poll while the user is on the messaging page so connection status
  // updates without a manual "check" click. Pause when the tab is hidden.
  useEffect(() => {
    let cancelled = false

    function tick() {
      if (cancelled || document.hidden) {
        return
      }

      void refreshPlatforms(true)
    }

    const id = window.setInterval(tick, 6000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [refreshPlatforms])

  const selected = useMemo(() => {
    if (!platforms) {
      return null
    }

    return platforms.find(platform => platform.id === selectedId) || platforms[0] || null
  }, [platforms, selectedId])

  const visiblePlatforms = useMemo(() => {
    if (!platforms) {
      return []
    }

    const q = query.trim().toLowerCase()

    if (!q) {
      return platforms
    }

    return platforms.filter(platform =>
      [platform.id, platform.name, platform.description, platform.state]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q))
    )
  }, [platforms, query])

  async function handleToggle(platform: MessagingPlatformInfo, enabled: boolean) {
    setSaving(`enabled:${platform.id}`)

    try {
      await updateMessagingPlatform(platform.id, { enabled })
      setPlatforms(
        current =>
          current?.map(row =>
            row.id === platform.id
              ? {
                  ...row,
                  enabled,
                  state: enabled ? (row.configured ? 'pending_restart' : 'not_configured') : 'disabled'
                }
              : row
          ) ?? current
      )
      notify({
        kind: 'success',
        title: t.messagingView.toggleUpdatedTitle(platform.name, enabled),
        message: t.messagingView.toggleUpdatedMessage
      })
    } catch (err) {
      notifyError(err, t.messagingView.updateFailed(platform.name))
    } finally {
      setSaving(null)
    }
  }

  async function handleSave(platform: MessagingPlatformInfo) {
    const env = trimEdits(edits[platform.id] || {})

    if (Object.keys(env).length === 0) {
      return
    }

    setSaving(`env:${platform.id}`)

    try {
      await updateMessagingPlatform(platform.id, { env })
      setEdits(current => ({ ...current, [platform.id]: {} }))
      await refreshPlatforms()
      notify({
        kind: 'success',
        title: t.messagingView.setupSavedTitle(platform.name),
        message: t.messagingView.setupSavedMessage
      })
    } catch (err) {
      notifyError(err, t.messagingView.saveFailed(platform.name))
    } finally {
      setSaving(null)
    }
  }

  async function handleClear(platform: MessagingPlatformInfo, key: string) {
    setSaving(`clear:${key}`)

    try {
      await updateMessagingPlatform(platform.id, { clear_env: [key] })
      setEdits(current => ({
        ...current,
        [platform.id]: {
          ...(current[platform.id] || {}),
          [key]: ''
        }
      }))
      await refreshPlatforms()
      notify({
        kind: 'success',
        title: t.messagingView.clearedTitle(key),
        message: t.messagingView.setupUpdatedMessage(platform.name)
      })
    } catch (err) {
      notifyError(err, t.messagingView.clearFailed(key))
    } finally {
      setSaving(null)
    }
  }

  return (
    <PageSearchShell
      {...props}
      headerTitle={t.sidebar.messaging}
      showSidebarRestoreButton
      onSearchChange={setQuery}
      searchPlaceholder={t.messagingView.searchPlaceholder}
      searchTrailingAction={null}
      searchValue={query}
    >
      {!platforms ? (
        <PageLoader label={t.messagingView.loadingPlatforms} />
      ) : (
        <div className="grid h-full min-h-0 p-3.5">
          <div className="mx-auto grid h-full min-h-0 w-full max-w-[70rem] grid-cols-1 gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto rounded-[0.95rem] border border-[var(--workbench-divider)] bg-[var(--workbench-panel-bg)] p-2.5">
            <ul className="space-y-1">
              {visiblePlatforms.map(platform => (
                <li key={platform.id}>
                  <PlatformRow
                    active={selected?.id === platform.id}
                    onSelect={() => setSelectedId(platform.id)}
                    platform={platform}
                  />
                </li>
              ))}
            </ul>
            </aside>

            <main className="min-h-0 overflow-hidden rounded-[0.95rem] border border-[var(--workbench-divider)] bg-[var(--workbench-panel-bg)]">
              {selected && (
                <PlatformDetail
                  edits={edits[selected.id] || {}}
                  onClear={key => void handleClear(selected, key)}
                  onEdit={(key, value) =>
                    setEdits(current => ({
                      ...current,
                      [selected.id]: {
                        ...(current[selected.id] || {}),
                        [key]: value
                      }
                    }))
                  }
                  onSave={() => void handleSave(selected)}
                  onToggle={enabled => void handleToggle(selected, enabled)}
                  platform={selected}
                  saving={saving}
                />
              )}
            </main>
          </div>
        </div>
      )}
    </PageSearchShell>
  )
}

function PlatformRow({
  active,
  onSelect,
  platform
}: {
  active: boolean
  onSelect: () => void
  platform: MessagingPlatformInfo
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-[calc(var(--radius)*1.5)] px-2 py-1.5 text-left shadow-[var(--field-shadow)] transition-[background-color,border-color,color]',
        active
          ? 'bg-[var(--surface-secondary)] text-[var(--foreground)]'
          : 'bg-transparent text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]'
      )}
      onClick={onSelect}
      type="button"
    >
      <PlatformAvatar platformId={platform.id} platformName={platform.name} />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate text-[length:var(--conversation-text-font-size)] font-normal">{platform.name}</span>
        <StatusDot tone={stateTone(platform)} />
      </span>
    </button>
  )
}

function PlatformDetail({
  edits,
  onClear,
  onEdit,
  onSave,
  onToggle,
  platform,
  saving
}: {
  edits: Record<string, string>
  onClear: (key: string) => void
  onEdit: (key: string, value: string) => void
  onSave: () => void
  onToggle: (enabled: boolean) => void
  platform: MessagingPlatformInfo
  saving: string | null
}) {
  const { t } = useI18n()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasEdits = Object.keys(trimEdits(edits)).length > 0
  const requiredFields = platform.env_vars.filter(field => field.required)
  const optionalFields = platform.env_vars.filter(field => !field.required && !fieldCopy(field, t).advanced)
  const advancedFields = platform.env_vars.filter(field => !field.required && fieldCopy(field, t).advanced)
  const hiddenCount = advancedFields.length
  const isSavingEnv = saving === `env:${platform.id}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 px-5 py-4">
          <header className="flex items-start gap-3">
            <PlatformAvatar platformId={platform.id} platformName={platform.name} />
            <div className="min-w-0 flex-1">
              <h3 className="text-[0.9375rem] font-semibold tracking-tight">{platform.name}</h3>
              <p className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
                {platform.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatePill tone={stateTone(platform)}>{stateLabel(platform.state, t)}</StatePill>
                <SetupPill active={platform.configured}>
                  {platform.configured ? t.messagingView.configured : t.messagingView.needsSetup}
                </SetupPill>
                {!platform.gateway_running && <SetupPill active={false}>{t.messagingView.gatewayStopped}</SetupPill>}
              </div>
              <PlatformHint platform={platform} />
            </div>
          </header>

          {platform.error_message && (
            <div className="flex items-start gap-2 rounded-[calc(var(--radius)*2)] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--danger-soft-foreground)] shadow-[var(--field-shadow)]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{platform.error_message}</span>
            </div>
          )}

          <section>
            <SectionTitle>{t.messagingView.getCredentialsTitle}</SectionTitle>
            <p className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
              {introCopy(platform, t)}
            </p>
            <div className="mt-3">
              <Button asChild size="sm" variant="outline">
                <a href={platform.docs_url} rel="noreferrer" target="_blank">
                  {t.messagingView.openSetupGuide}
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </section>

          <section>
            <SectionTitle>{t.messagingView.required}</SectionTitle>
            <div className="mt-3 space-y-4">
              {requiredFields.length > 0 ? (
                requiredFields.map(field => (
                  <MessagingField
                    edits={edits}
                    field={field}
                    key={field.key}
                    onClear={onClear}
                    onEdit={onEdit}
                    saving={saving}
                  />
                ))
              ) : (
                <p className="text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
                  {t.messagingView.noTokenNeeded}
                </p>
              )}
            </div>
          </section>

          {optionalFields.length > 0 && (
            <section>
              <SectionTitle>{t.messagingView.recommended}</SectionTitle>
              <div className="mt-3 space-y-4">
                {optionalFields.map(field => (
                  <MessagingField
                    edits={edits}
                    field={field}
                    key={field.key}
                    onClear={onClear}
                    onEdit={onEdit}
                    saving={saving}
                  />
                ))}
              </div>
            </section>
          )}

          {hiddenCount > 0 && (
            <section>
              <button
                className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] hover:text-foreground"
                onClick={() => setShowAdvanced(value => !value)}
                type="button"
              >
                <span>{t.messagingView.advanced(hiddenCount)}</span>
                <DisclosureCaret open={showAdvanced} size="0.875rem" />
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  {advancedFields.map(field => (
                    <MessagingField
                      edits={edits}
                      field={field}
                      key={field.key}
                      onClear={onClear}
                      onEdit={onEdit}
                      saving={saving}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="border-t border-[var(--separator)] bg-[var(--surface)] px-5 py-2.5">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2">
          <label className="flex shrink-0 items-center gap-2 rounded-[calc(var(--radius)*1.5)] border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1.5 text-[length:var(--conversation-text-font-size)] shadow-[var(--field-shadow)]">
            <Switch
              aria-label={
                platform.enabled
                  ? t.messagingView.disablePlatform(platform.name)
                  : t.messagingView.enablePlatform(platform.name)
              }
              checked={platform.enabled}
              disabled={saving === `enabled:${platform.id}`}
              onCheckedChange={onToggle}
            />
            <span className="text-xs font-medium text-[var(--muted)]">
              {platform.enabled ? t.messagingView.enabled : t.messagingView.disabled}
            </span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            {hasEdits && <span className="text-xs text-[var(--muted)]">{t.messagingView.unsavedChanges}</span>}
            <Button disabled={!hasEdits || isSavingEnv} onClick={onSave} size="sm">
              <Save />
              {isSavingEnv ? t.messagingView.savingChanges : t.messagingView.saveChanges}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}

const introCopy = (platform: MessagingPlatformInfo, t: ReturnType<typeof useI18n>['t']) =>
  t.messagingView.platformIntro[platform.id] || platform.description

function MessagingField({
  edits,
  field,
  onClear,
  onEdit,
  saving
}: {
  edits: Record<string, string>
  field: MessagingEnvVarInfo
  onClear: (key: string) => void
  onEdit: (key: string, value: string) => void
  saving: string | null
}) {
  const { t } = useI18n()
  const copy = fieldCopy(field, t)

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={`messaging-field-${field.key}`}>
          {copy.label}
        </label>
        {field.is_set && <span className="text-[0.66rem] font-medium text-primary">{t.messagingView.saved}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="h-9 rounded-lg font-mono text-sm"
          id={`messaging-field-${field.key}`}
          onChange={event => onEdit(field.key, event.target.value)}
          placeholder={field.is_set ? field.redacted_value || t.messagingView.replaceCurrentValue : copy.placeholder}
          type={field.is_password ? 'password' : 'text'}
          value={edits[field.key] || ''}
        />
        {field.url && (
          <Button asChild size="icon-sm" title={t.messagingView.openDocs} variant="ghost">
            <a href={field.url} rel="noreferrer" target="_blank">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
        {field.is_set && (
          <Button
            disabled={saving === `clear:${field.key}`}
            onClick={() => onClear(field.key)}
            size="icon-sm"
            title={t.messagingView.clearField(field.key)}
            variant="ghost"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      {copy.help && <p className="text-xs leading-5 text-[var(--muted)]">{copy.help}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{children}</h4>
}

function PlatformHint({ platform }: { platform: MessagingPlatformInfo }) {
  const { t } = useI18n()

  if (!platform.enabled || platform.state === 'connected') {
    return null
  }

  const hint =
    t.messagingView.hints[platform.state || ''] ||
    (platform.gateway_running ? null : t.messagingView.hints.gateway_stopped)

  return hint ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</p> : null
}

function StatePill({ children, tone }: { children: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.66rem] font-medium',
        PILL_TONE[tone]
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  )
}

function SetupPill({ active, children }: { active: boolean; children: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.66rem] font-medium',
        PILL_TONE[active ? 'good' : 'muted']
      )}
    >
      {children}
    </span>
  )
}

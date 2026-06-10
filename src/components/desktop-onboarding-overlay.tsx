import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ModelPickerDialog } from '@/components/model-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getGlobalModelOptions } from '@/hermes'
import { useI18n } from '@/i18n'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Loader2,
  Sparkles,
  Terminal
} from '@/lib/icons'
import { isProviderSetupErrorMessage } from '@/lib/provider-setup-errors'
import { cn } from '@/lib/utils'
import { $desktopBoot, type DesktopBootState } from '@/store/boot'
import {
  $desktopOnboarding,
  cancelOnboardingFlow,
  clearPendingProviderOAuth,
  closeManualOnboarding,
  confirmOnboardingModel,
  copyDeviceCode,
  copyExternalCommand,
  DEFAULT_MANUAL_ONBOARDING_REASON,
  DEFAULT_ONBOARDING_REASON,
  dismissFirstRunOnboarding,
  type OnboardingContext,
  type OnboardingFlow,
  peekPendingProviderOAuth,
  recheckExternalSignin,
  refreshOnboarding,
  saveOnboardingApiKey,
  setOnboardingCode,
  setOnboardingMode,
  setOnboardingModel,
  startProviderOAuth,
  submitOnboardingCode
} from '@/store/onboarding'
import type { ModelOptionProvider, OAuthProvider } from '@/types/hermes'

interface DesktopOnboardingOverlayProps {
  onCompleted?: () => void
  requestGateway: OnboardingContext['requestGateway']
}

interface ApiKeyOption {
  description: string
  docsUrl: string
  envKey: string
  id: string
  name: string
  placeholder?: string
  short?: string
}

const MIN_KEY_LENGTH = 8

function getApiKeyOptions(t: ReturnType<typeof useI18n>['t']): ApiKeyOption[] {
  return [
    {
      id: 'openrouter',
      name: 'OpenRouter',
      short: t.onboarding.apiOptions.openrouter.short,
      envKey: 'OPENROUTER_API_KEY',
      description: t.onboarding.apiOptions.openrouter.description,
      docsUrl: 'https://openrouter.ai/keys'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      short: t.onboarding.apiOptions.openai.short,
      envKey: 'OPENAI_API_KEY',
      description: t.onboarding.apiOptions.openai.description,
      docsUrl: 'https://platform.openai.com/api-keys'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      short: t.onboarding.apiOptions.gemini.short,
      envKey: 'GEMINI_API_KEY',
      description: t.onboarding.apiOptions.gemini.description,
      docsUrl: 'https://aistudio.google.com/app/apikey'
    },
    {
      id: 'xai',
      name: 'xAI Grok',
      short: t.onboarding.apiOptions.xai.short,
      envKey: 'XAI_API_KEY',
      description: t.onboarding.apiOptions.xai.description,
      docsUrl: 'https://console.x.ai/'
    },
    {
      id: 'local',
      name: t.onboarding.localEndpointName,
      short: t.onboarding.apiOptions.local.short,
      envKey: 'OPENAI_BASE_URL',
      description: t.onboarding.apiOptions.local.description,
      docsUrl: '',
      placeholder: 'http://127.0.0.1:8000/v1'
    }
  ]
}

function useApiKeyCatalog(t: ReturnType<typeof useI18n>['t']): ApiKeyOption[] {
  const [rows, setRows] = useState<ModelOptionProvider[]>([])

  useEffect(() => {
    let cancelled = false

    void Promise.resolve()
      .then(() => getGlobalModelOptions())
      .then(res => {
        if (!cancelled) {
          setRows(res.providers ?? [])
        }
      })
      .catch(() => {
        // Fall back to curated defaults only.
      })

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => {
    const curated = getApiKeyOptions(t)
    const curatedByEnv = new Map(curated.map(option => [option.envKey, option]))
    const seenEnv = new Set(curated.map(option => option.envKey))
    const derived: ApiKeyOption[] = []

    for (const row of rows) {
      if (row.auth_type && row.auth_type !== 'api_key') {
        continue
      }

      const envKey = row.key_env

      if (!envKey || seenEnv.has(envKey)) {
        continue
      }

      seenEnv.add(envKey)
      derived.push({
        id: row.slug,
        name: row.name,
        envKey,
        description: `Direct API access to ${row.name}.`,
        docsUrl: ''
      })
    }

    derived.sort((a, b) => a.name.localeCompare(b.name))

    return [...curated.filter(option => curatedByEnv.has(option.envKey)), ...derived]
  }, [rows, t])
}

const PROVIDER_DISPLAY: Record<string, { order: number; title: string }> = {
  nous: { order: 0, title: 'Nous Portal' },
  'openai-codex': { order: 1, title: 'OpenAI OAuth (ChatGPT)' },
  'minimax-oauth': { order: 2, title: 'MiniMax' },
  'qwen-oauth': { order: 3, title: 'Qwen Code' },
  'xai-oauth': { order: 4, title: 'xAI Grok' },
  anthropic: { order: 5, title: 'Anthropic API Key' },
  'claude-code': { order: 6, title: 'Anthropic OAuth: Required Extra Usage Credits to Use Subscription' }
}

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

const providerTitle = (p: OAuthProvider) => PROVIDER_DISPLAY[p.id]?.title ?? p.name
const orderOf = (p: OAuthProvider) => PROVIDER_DISPLAY[p.id]?.order ?? 99

export const sortProviders = (providers: OAuthProvider[]) =>
  [...providers].sort((a, b) => orderOf(a) - orderOf(b) || a.name.localeCompare(b.name))

export function DesktopOnboardingOverlay({ onCompleted, requestGateway }: DesktopOnboardingOverlayProps) {
  const { t } = useI18n()
  const onboarding = useStore($desktopOnboarding)
  const boot = useStore($desktopBoot)
  const ctxRef = useRef<OnboardingContext>({ requestGateway, onCompleted })
  ctxRef.current = { requestGateway, onCompleted }
  const shouldOpen = onboarding.manual || onboarding.requested

  const ctx = useMemo<OnboardingContext>(
    () => ({
      requestGateway: (...args) => ctxRef.current.requestGateway(...args),
      onCompleted: () => ctxRef.current.onCompleted?.()
    }),
    []
  )

  useEffect(() => {
    if (shouldOpen) {
      void refreshOnboarding(ctx)
    }
  }, [ctx, shouldOpen])

  useEffect(() => {
    if (!onboarding.manual || onboarding.flow.status !== 'idle' || !onboarding.providers) {
      return
    }

    const pendingId = peekPendingProviderOAuth()

    if (!pendingId) {
      return
    }

    const provider = onboarding.providers.find(p => p.id === pendingId)

    if (provider) {
      clearPendingProviderOAuth()
      void startProviderOAuth(provider, ctx)
    } else if (onboarding.providers.length > 0) {
      clearPendingProviderOAuth()
    }
  }, [ctx, onboarding.flow.status, onboarding.manual, onboarding.providers])

  // Provider setup is no longer part of desktop startup. Only show this
  // overlay when the user explicitly opens it (manual mode) or when a real
  // provider-missing error asks for setup on demand.
  if (!shouldOpen) {
    return null
  }

  const { flow } = onboarding
  const rawReason = onboarding.reason?.trim() || null
  const reason =
    rawReason &&
    !isProviderSetupErrorMessage(rawReason) &&
    rawReason !== DEFAULT_ONBOARDING_REASON &&
    rawReason !== DEFAULT_MANUAL_ONBOARDING_REASON
      ? rawReason
      : null
  // In manual mode the app is already configured, so the flow is "ready"
  // immediately — no runtime gate needed. Otherwise wait for the provider
  // readiness check (configured === false) before showing the picker.
  const ready = onboarding.manual || onboarding.configured === false
  const showPicker = flow.status === 'idle' || flow.status === 'success'

  return (
    <div className="fixed inset-0 z-1300 flex items-center justify-center bg-backdrop p-6 backdrop-blur-md">
      <div
        className="w-full max-w-[45rem] overflow-hidden rounded-[min(30px,var(--radius-3xl))] border border-[var(--border)] bg-[var(--overlay)] text-[var(--foreground)] shadow-[var(--overlay-shadow)]"
        data-slot="desktop-onboarding-overlay-card"
      >
        <Header />
        <div className="grid gap-3 p-5">
          {onboarding.manual ? (
            <div className="flex justify-end">
              <button
                className="text-xs font-medium text-[var(--muted)] transition hover:text-foreground"
                onClick={() => closeManualOnboarding()}
                type="button"
              >
                {t.onboarding.close}
              </button>
            </div>
          ) : null}
          {reason ? <ReasonNotice reason={reason} /> : null}
          {ready ? showPicker ? <Picker ctx={ctx} /> : <FlowPanel ctx={ctx} flow={flow} /> : <Preparing boot={boot} />}
        </div>
      </div>
    </div>
  )
}

function ReasonNotice({ reason }: { reason: string }) {
  return (
    <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
      {reason}
    </div>
  )
}

function Preparing({ boot }: { boot: DesktopBootState }) {
  const { t } = useI18n()
  const progress = Math.max(2, Math.min(100, Math.round(boot.progress)))
  const hasError = Boolean(boot.error)
  const installing = boot.phase.startsWith('runtime.')

  return (
    <div className="grid gap-3" role="status">
      <p className="text-sm text-[var(--muted)]">
        {installing ? t.onboarding.preparingInstall : t.onboarding.starting}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--default-soft)]">
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-[width] duration-300 ease-out',
            hasError && 'bg-destructive'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span className="truncate">{boot.message}</span>
        <span>{progress}%</span>
      </div>
      {hasError ? <p className="text-xs text-destructive">{boot.error}</p> : null}
    </div>
  )
}

function Header() {
  const { t } = useI18n()
  return (
    <div className="border-b border-[var(--separator)] bg-[var(--overlay)] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[calc(var(--radius)*1.5)] bg-[var(--surface-secondary)] text-[var(--muted)] shadow-[var(--field-shadow)]">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">{t.onboarding.title}</h2>
          <p className="mt-1 max-w-xl text-[0.8125rem] leading-5 text-[var(--muted)]">{t.onboarding.description}</p>
        </div>
      </div>
    </div>
  )
}

export const FEATURED_ID = 'nous'
const SHOW_ALL_KEY = 'hermes-onboarding-show-all-v1'

const readShowAll = () => {
  try {
    return window.localStorage.getItem(SHOW_ALL_KEY) === '1'
  } catch {
    return false
  }
}

const persistShowAll = (value: boolean) => {
  try {
    window.localStorage.setItem(SHOW_ALL_KEY, value ? '1' : '0')
  } catch {
    // localStorage unavailable — degrade silently.
  }

  return value
}

export function Picker({ ctx }: { ctx: OnboardingContext }) {
  const { t } = useI18n()
  const { manual, mode, providers } = useStore($desktopOnboarding)
  const [showAll, setShowAll] = useState(readShowAll)
  const ordered = useMemo(() => (providers ? sortProviders(providers) : []), [providers])
  const hasOauth = ordered.length > 0
  const apiKeyOptions = useApiKeyCatalog(t)

  if (mode === 'apikey' || !hasOauth) {
    return (
      <div className="grid gap-3">
        <ApiKeyForm canGoBack={hasOauth} ctx={ctx} options={apiKeyOptions} />
        {manual ? null : (
          <div className="flex justify-center border-t border-[var(--separator)] pt-3">
            <ChooseLaterLink />
          </div>
        )}
      </div>
    )
  }

  if (providers === null) {
    return <Status>{t.onboarding.lookingUpProviders}</Status>
  }

  const select = (p: OAuthProvider) => void startProviderOAuth(p, ctx)
  const featured = ordered.find(p => p.id === FEATURED_ID) ?? null
  const rest = featured ? ordered.filter(p => p.id !== FEATURED_ID) : ordered
  // Collapse the secondary providers behind a disclosure only when Nous
  // Portal is present to anchor the choice — otherwise show the full list.
  const collapsible = Boolean(featured) && rest.length > 0
  const showRest = !collapsible || showAll

  return (
    <div className="grid gap-2">
      {featured ? <FeaturedProviderRow onSelect={select} provider={featured} /> : null}
      {showRest ? (
        <>
          {rest.map(p => (
            <ProviderRow key={p.id} onSelect={select} provider={p} />
          ))}
          <KeyProviderRow onClick={() => setOnboardingMode('apikey')} />
        </>
      ) : null}
      {collapsible ? (
        <button
          className="flex items-center justify-center gap-1.5 pt-1 text-xs font-medium text-[var(--muted)] transition hover:text-foreground"
          onClick={() => setShowAll(persistShowAll(!showAll))}
          type="button"
        >
          {showAll ? t.onboarding.collapse : t.onboarding.otherProviders}
          <ChevronDown className={cn('size-3.5 transition', showAll && 'rotate-180')} />
        </button>
      ) : null}
      <div className="flex items-center justify-between gap-3 pt-1">
        {manual ? <span /> : <ChooseLaterLink />}
        <button
          className="text-xs font-medium text-[var(--muted)] hover:text-foreground"
          onClick={() => setOnboardingMode('apikey')}
          type="button"
        >
          {t.onboarding.apiKeyCta}
        </button>
      </div>
    </div>
  )
}

function ChooseLaterLink() {
  const { t } = useI18n()

  return (
    <button
      className="text-xs font-medium text-[var(--muted)] transition hover:text-foreground"
      onClick={() => dismissFirstRunOnboarding()}
      type="button"
    >
      {t.onboarding.chooseLater}
    </button>
  )
}

export function FeaturedProviderRow({
  onSelect,
  provider
}: {
  onSelect: (provider: OAuthProvider) => void
  provider: OAuthProvider
}) {
  const { t } = useI18n()
  const loggedIn = provider.status?.logged_in

  return (
    <button
      className={cn(
        'group flex w-full items-center justify-between gap-4 rounded-[calc(var(--radius)*2)] border border-[var(--accent-soft)] bg-[var(--surface)] p-4 text-left shadow-[var(--surface-shadow)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]',
        loggedIn && 'border-[var(--accent)]'
      )}
      data-slot="onboarding-provider-featured"
      onClick={() => onSelect(provider)}
      type="button"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <img alt="" className="size-5 shrink-0 rounded" src={assetPath('apple-touch-icon.png')} />
          <span className="text-base font-semibold">{providerTitle(provider)}</span>
          {loggedIn ? (
            <ConnectedTag />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent-foreground)] shadow-[var(--field-shadow)]">
              <span aria-hidden="true" className="dither inline-block size-2 shrink-0" />
              {t.onboarding.recommended}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.onboarding.featuredPitch}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-primary transition group-hover:translate-x-0.5" />
    </button>
  )
}

function ConnectedTag() {
  const { t } = useI18n()
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
      <Check className="size-3" />
      {t.onboarding.connected}
    </span>
  )
}

export function KeyProviderRow({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button
      className="group flex w-full items-center justify-between gap-3 rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-[var(--field-shadow)] transition hover:border-[var(--accent-soft)] hover:bg-[var(--surface-secondary)]"
      data-slot="onboarding-provider-key"
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <span className="text-sm font-semibold">OpenRouter</span>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.onboarding.apiKeyDefaultDescription}</p>
      </div>
      <ChevronRight className="size-4 text-[var(--muted)] transition group-hover:text-foreground" />
    </button>
  )
}

export function ProviderRow({ onSelect, provider }: { onSelect: (provider: OAuthProvider) => void; provider: OAuthProvider }) {
  const { t } = useI18n()
  const loggedIn = provider.status?.logged_in
  const Trail = provider.flow === 'external' ? Terminal : ChevronRight

  return (
    <button
      className={cn(
        'group flex w-full items-center justify-between gap-3 rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-[var(--field-shadow)] transition hover:border-[var(--accent-soft)] hover:bg-[var(--surface-secondary)]',
        loggedIn && 'border-[var(--accent-soft)]'
      )}
      data-slot="onboarding-provider-row"
      onClick={() => onSelect(provider)}
      type="button"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{providerTitle(provider)}</span>
          {loggedIn ? <ConnectedTag /> : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.onboarding.flowSubtitles[provider.flow]}</p>
      </div>
      <Trail className="size-4 text-[var(--muted)] transition group-hover:text-foreground" />
    </button>
  )
}

function ApiKeyForm({
  canGoBack,
  ctx,
  options
}: {
  canGoBack: boolean
  ctx: OnboardingContext
  options: ApiKeyOption[]
}) {
  const { t } = useI18n()
  const [option, setOption] = useState<ApiKeyOption>(() => options[0]!)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    setOption(prev => options.find(candidate => candidate.id === prev.id) ?? options[0]!)
  }, [options])

  const isLocal = option.envKey === 'OPENAI_BASE_URL'
  const canSave = value.trim().length >= (isLocal ? 1 : MIN_KEY_LENGTH)

  const submit = async () => {
    if (!canSave || saving) {
      return
    }

    setSaving(true)
    setError(null)
    const result = await saveOnboardingApiKey(option.envKey, value, option.name, ctx)

    if (result.ok) {
      setValue('')
    } else {
      setError(result.message ?? t.onboarding.saveCredentialFailed)
    }

    setSaving(false)
  }

  return (
      <div className="grid gap-4">
      {canGoBack ? (
        <button
          className="-mt-1 flex items-center gap-1 self-start text-xs font-medium text-[var(--muted)] hover:text-foreground"
          onClick={() => setOnboardingMode('oauth')}
          type="button"
        >
          <ChevronLeft className="size-3" />
          {t.onboarding.backToSignIn}
        </button>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(o => (
          <button
            className={cn(
              'rounded-[calc(var(--radius)*2)] border bg-[var(--surface)] p-3 text-left shadow-[var(--field-shadow)] transition hover:bg-[var(--surface-secondary)]',
              option.id === o.id ? 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]' : 'border-[var(--border)]'
            )}
            key={o.id}
            onClick={() => {
              setOption(o)
              setValue('')
              setError(null)
            }}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{o.name}</span>
              {option.id === o.id ? <Check className="size-4 text-primary" /> : null}
            </div>
            {o.short ? <p className="mt-1 text-xs text-[var(--muted)]">{o.short}</p> : null}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm leading-6 text-[var(--muted)]">{option.description}</p>
          {option.docsUrl ? <DocsLink href={option.docsUrl}>{t.onboarding.getKey}</DocsLink> : null}
        </div>
        <Input
          autoComplete="off"
          autoFocus
          className="font-mono"
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void submit()}
          placeholder={option.placeholder || t.onboarding.pasteApiKey}
          type={isLocal ? 'text' : 'password'}
          value={value}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="flex justify-end">
        <Button disabled={!canSave || saving} onClick={() => void submit()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {saving ? t.onboarding.connecting : t.onboarding.connect}
        </Button>
      </div>
    </div>
  )
}

function FlowPanel({ ctx, flow }: { ctx: OnboardingContext; flow: OnboardingFlow }) {
  const { t } = useI18n()
  const title = 'provider' in flow && flow.provider ? providerTitle(flow.provider) : ''

  if (flow.status === 'starting') {
    return <Status>{t.onboarding.startingSignIn(title)}</Status>
  }

  if (flow.status === 'submitting') {
    return <Status>{t.onboarding.verifyingCode(title)}</Status>
  }

  if (flow.status === 'success') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        <Check className="size-4" />
        {t.onboarding.connectedPickingModel(title)}
      </div>
    )
  }

  if (flow.status === 'confirming_model') {
    return <ConfirmingModelPanel ctx={ctx} flow={flow} />
  }

  if (flow.status === 'error') {
    return (
      <div className="grid gap-3">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {flow.message || t.onboarding.signInFailed}
        </div>
        <div className="flex justify-end">
          <Button onClick={cancelOnboardingFlow} variant="outline">
            {t.onboarding.pickDifferentProvider}
          </Button>
        </div>
      </div>
    )
  }

  if (flow.status === 'awaiting_user') {
    return (
      <Step title={t.onboarding.signInWith(title)}>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>{t.onboarding.stepOpenBrowser(title)}</li>
          <li>{t.onboarding.stepAuthorize}</li>
          <li>{t.onboarding.stepPasteCode}</li>
        </ol>
        <Input
          autoFocus
          onChange={e => setOnboardingCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void submitOnboardingCode(ctx)}
          placeholder={t.onboarding.pasteAuthorizationCode}
          value={flow.code}
        />
        <FlowFooter left={<DocsLink href={flow.start.auth_url}>{t.onboarding.reopenAuthorizationPage}</DocsLink>}>
          <CancelBtn />
          <Button disabled={!flow.code.trim()} onClick={() => void submitOnboardingCode(ctx)}>
            {t.onboarding.continue}
          </Button>
        </FlowFooter>
      </Step>
    )
  }

  if (flow.status === 'awaiting_browser') {
    return (
      <Step title={t.onboarding.signInWith(title)}>
        <p className="text-sm text-[var(--muted)]">{t.onboarding.browserSigninDescription(title)}</p>
        <FlowFooter left={<DocsLink href={flow.start.auth_url}>{t.onboarding.reopenSignInPage}</DocsLink>}>
          <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Loader2 className="size-3 animate-spin" />
            {t.onboarding.waitingForAuthorization}
          </span>
          <CancelBtn size="sm" />
        </FlowFooter>
      </Step>
    )
  }

  if (flow.status === 'external_pending') {
    return (
      <Step title={t.onboarding.signInWith(title)}>
        <p className="text-sm text-[var(--muted)]">{t.onboarding.externalSigninDescription(title)}</p>
        <CodeBlock copied={flow.copied} onCopy={() => void copyExternalCommand()} text={flow.provider.cli_command} />
        <FlowFooter left={flow.provider.docs_url ? <DocsLink href={flow.provider.docs_url}>{t.common.docs}</DocsLink> : null}>
          <CancelBtn />
          <Button onClick={() => void recheckExternalSignin(ctx)}>
            <Check className="size-4" />
            {t.onboarding.signedIn}
          </Button>
        </FlowFooter>
      </Step>
    )
  }

  if (flow.status !== 'polling') {
    return null
  }

  return (
    <Step title={t.onboarding.signInWith(title)}>
      <p className="text-sm text-[var(--muted)]">{t.onboarding.enterCodeThere(title)}</p>
      <CodeBlock copied={flow.copied} large onCopy={() => void copyDeviceCode()} text={flow.start.user_code} />
      <FlowFooter left={<DocsLink href={flow.start.verification_url}>{t.onboarding.reopenVerificationPage}</DocsLink>}>
        <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Loader2 className="size-3 animate-spin" />
          {t.onboarding.waitingForAuthorization}
        </span>
        <CancelBtn size="sm" />
      </FlowFooter>
    </Step>
  )
}

function Step({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="grid gap-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function CodeBlock({
  copied,
  large,
  onCopy,
  text
}: {
  copied: boolean
  large?: boolean
  onCopy: () => void
  text: string
}) {
  const { t } = useI18n()
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3 shadow-[var(--field-shadow)]"
      data-slot="onboarding-code-block"
    >
      <code className={cn('font-mono', large ? 'text-2xl tracking-[0.4em]' : 'text-sm')}>{text}</code>
      <Button onClick={onCopy} size="sm" variant="outline">
        {copied ? <Check className="size-4" /> : t.onboarding.copy}
      </Button>
    </div>
  )
}

function FlowFooter({ children, left }: { children: React.ReactNode; left?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  )
}

function CancelBtn({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const { t } = useI18n()
  return (
    <Button onClick={cancelOnboardingFlow} size={size} variant="ghost">
      {t.onboarding.cancel}
    </Button>
  )
}

function ConfirmingModelPanel({
  ctx,
  flow
}: {
  ctx: OnboardingContext
  flow: Extract<OnboardingFlow, { status: 'confirming_model' }>
}) {
  const { t } = useI18n()
  // Local state controls whether the model picker dialog is open.
  // We reuse the existing ModelPickerDialog component (the same picker
  // available from the chat shell) rather than building an inline
  // dropdown — gives us search, multi-provider listing if relevant, and
  // a familiar UI for users who'll see this picker again later.
  const [pickerOpen, setPickerOpen] = useState(false)

  // Pull pricing + tier for the just-picked default so the confirm card
  // shows the same $/Mtok + Free/Pro info the picker and CLI do.
  const options = useQuery({
    queryKey: ['onboarding-model-options', flow.providerSlug],
    queryFn: () => getGlobalModelOptions()
  })
  const providerRow = options.data?.providers?.find(
    p => String(p.slug).toLowerCase() === flow.providerSlug.toLowerCase()
  )
  const price = providerRow?.pricing?.[flow.currentModel]
  const freeTier = providerRow?.free_tier

  return (
    <div className="grid gap-4">
      <div
        className="flex items-center gap-2 rounded-[calc(var(--radius)*2)] border border-[var(--success-soft)] bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]"
        data-slot="onboarding-confirm-success"
      >
        <Check className="size-4 shrink-0" />
        <span>{t.onboarding.providerConnected(flow.label)}</span>
      </div>

      <div className="grid gap-3 rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--surface-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{t.onboarding.defaultModel}</p>
              {freeTier === true && (
                <span className="rounded-sm bg-emerald-500/15 px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  {t.onboarding.freeTier}
                </span>
              )}
              {freeTier === false && (
                <span className="rounded-sm bg-primary/15 px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-primary">
                  {t.onboarding.pro}
                </span>
              )}
            </div>
            <p className="mt-1 truncate font-mono text-sm">{flow.currentModel}</p>
            {price && (price.input || price.output) && (
              <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                {price.free ? t.onboarding.free : t.onboarding.pricePerMtok(price.input || '?', price.output || '?')}
              </p>
            )}
          </div>
          <Button disabled={flow.saving} onClick={() => setPickerOpen(true)} size="sm" variant="outline">
            {t.common.change}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button disabled={flow.saving} onClick={() => confirmOnboardingModel(ctx)}>
          {flow.saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {t.onboarding.startChatting}
        </Button>
      </div>

      {/*
        ModelPickerDialog defaults to z-130 on its content, which renders
        UNDER the onboarding overlay (z-1300) and breaks pointer events.
        Bump it above with z-[1310] so the picker sits on top of the
        onboarding panel. The dialog's own dim-backdrop layer stays at
        its default z-120 — the onboarding overlay is already dimming
        the rest of the screen, so we don't want a second backdrop.
      */}
      <ModelPickerDialog
        contentClassName="z-[1310]"
        currentModel={flow.currentModel}
        currentProvider={flow.providerSlug}
        onOpenChange={setPickerOpen}
        onSelect={({ model }) => {
          void setOnboardingModel(model)
          setPickerOpen(false)
        }}
        open={pickerOpen}
      />
    </div>
  )
}

function DocsLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Button asChild size="xs" variant="ghost">
      <a href={href} rel="noreferrer" target="_blank">
        <ExternalLink className="size-3" />
        {children}
      </a>
    </Button>
  )
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-6 text-sm text-[var(--muted)] shadow-[var(--field-shadow)]">
      <Loader2 className="size-4 animate-spin" />
      {children}
    </div>
  )
}

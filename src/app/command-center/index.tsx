import { useStore } from '@nanostores/react'
import {
  IconBookmark,
  IconBookmarkFilled,
  IconDownload,
  IconRefresh,
  IconTrash
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getActionStatus,
  getLogs,
  getStatus,
  getUsageAnalytics,
  restartGateway,
  searchSessions
} from '@/hermes'
import type {
  ActionStatusResponse,
  AnalyticsResponse,
  SessionInfo,
  SessionSearchResult as SessionSearchApiResult,
  StatusResponse
} from '@/hermes'
import { useI18n } from '@/i18n'
import { sessionTitle } from '@/lib/chat-runtime'
import { Activity, AlertCircle, BarChart3, Pin } from '@/lib/icons'
import { exportSession } from '@/lib/session-export'
import { cn } from '@/lib/utils'
import { upsertDesktopActionTask } from '@/store/activity'
import { $pinnedSessionIds, pinSession, unpinSession } from '@/store/layout'
import { $sessions } from '@/store/session'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { OverlayActionButton, OverlayCard, OverlayIconButton } from '../overlays/overlay-chrome'
import { OverlaySearchInput } from '../overlays/overlay-search-input'
import { OverlayMain, OverlayNavItem, OverlaySidebar, OverlaySplitLayout } from '../overlays/overlay-split-layout'
import { OverlayView } from '../overlays/overlay-view'
import { ARTIFACTS_ROUTE, MESSAGING_ROUTE, NEW_CHAT_ROUTE, SETTINGS_ROUTE, SKILLS_ROUTE } from '../routes'

export type CommandCenterSection = 'sessions' | 'system' | 'usage'

const SECTIONS = ['sessions', 'system', 'usage'] as const satisfies readonly CommandCenterSection[]

const USAGE_PERIODS = [7, 30, 90] as const
type UsagePeriod = (typeof USAGE_PERIODS)[number]

interface CommandCenterViewProps {
  initialSection?: CommandCenterSection
  onClose: () => void
  onDeleteSession: (sessionId: string) => Promise<void>
  onNavigateRoute: (path: string) => void
  onOpenSession: (sessionId: string) => void
}

interface NavigationSearchEntry {
  detail?: string
  id: string
  route: string
  title: string
}

interface SectionSearchEntry {
  detail?: string
  id: string
  section: CommandCenterSection
  title: string
}

interface SessionSearchHit {
  detail?: string
  kind: 'session'
  sessionId: string
  snippet: string
  title: string
}

interface RouteSearchHit {
  detail?: string
  kind: 'route'
  route: string
  title: string
}

interface SectionSearchHit {
  detail?: string
  kind: 'section'
  section: CommandCenterSection
  title: string
}

type CommandCenterSearchResult = RouteSearchHit | SectionSearchHit | SessionSearchHit

interface CommandCenterSearchProvider {
  id: string
  label: string
  search: (query: string) => Promise<CommandCenterSearchResult[]>
}

interface CommandCenterSearchGroup {
  id: string
  label: string
  results: CommandCenterSearchResult[]
}

function formatTimestamp(value?: number | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value * 1000)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function splitSessionSearchResult(result: SessionSearchApiResult, sessionsById: Map<string, SessionInfo>) {
  const row = sessionsById.get(result.session_id)
  const title = row ? sessionTitle(row) : result.session_id
  const detail = [result.model, result.source].filter(Boolean).join(' · ')

  return { detail, title }
}

function matchesSearchQuery(query: string, ...values: Array<string | undefined>): boolean {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return true
  }

  return values.some(value => value?.toLowerCase().includes(normalized))
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)

    return () => window.clearTimeout(id)
  }, [delayMs, value])

  return debounced
}

export function CommandCenterView({
  initialSection,
  onClose,
  onDeleteSession,
  onNavigateRoute,
  onOpenSession
}: CommandCenterViewProps) {
  const { t } = useI18n()
  const cc = t.commandCenter
  const sessions = useStore($sessions)
  const pinnedSessionIds = useStore($pinnedSessionIds)

  const [section, setSection] = useRouteEnumParam('section', SECTIONS, initialSection ?? 'sessions')

  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchGroups, setSearchGroups] = useState<CommandCenterSearchGroup[]>([])
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [systemLoading, setSystemLoading] = useState(false)
  const [systemError, setSystemError] = useState('')
  const [systemAction, setSystemAction] = useState<ActionStatusResponse | null>(null)
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriod>(30)
  const [usage, setUsage] = useState<AnalyticsResponse | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState('')
  const searchRequestRef = useRef(0)
  const usageRequestRef = useRef(0)

  const debouncedQuery = useDebouncedValue(query.trim(), 180)

  const sessionsById = useMemo(() => new Map(sessions.map(session => [session.id, session])), [sessions])
  const sectionLabels = cc.sections
  const sectionDescriptions = cc.descriptions
  const navigationSearchEntries = useMemo<readonly NavigationSearchEntry[]>(
    () => [
      { id: 'nav-new-chat', route: NEW_CHAT_ROUTE, title: cc.navigation.newSession, detail: cc.navigation.newSessionDetail },
      { id: 'nav-settings', route: SETTINGS_ROUTE, title: cc.navigation.settings, detail: cc.navigation.settingsDetail },
      { id: 'nav-skills', route: SKILLS_ROUTE, title: cc.navigation.skills, detail: cc.navigation.skillsDetail },
      { id: 'nav-messaging', route: MESSAGING_ROUTE, title: cc.navigation.messaging, detail: cc.navigation.messagingDetail },
      { id: 'nav-artifacts', route: ARTIFACTS_ROUTE, title: cc.navigation.artifacts, detail: cc.navigation.artifactsDetail }
    ],
    [cc.navigation]
  )
  const sectionSearchEntries = useMemo<readonly SectionSearchEntry[]>(
    () => [
      {
        id: 'section-sessions',
        section: 'sessions',
        title: cc.navigation.sessionsPanel,
        detail: cc.navigation.sessionsPanelDetail
      },
      { id: 'section-system', section: 'system', title: cc.navigation.systemPanel, detail: cc.navigation.systemPanelDetail },
      { id: 'section-usage', section: 'usage', title: cc.navigation.usagePanel, detail: cc.navigation.usagePanelDetail }
    ],
    [cc.navigation]
  )

  const filteredSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const left = a.last_active || a.started_at || 0
        const right = b.last_active || b.started_at || 0

        return right - left
      }),
    [sessions]
  )

  const searchProviders = useMemo<readonly CommandCenterSearchProvider[]>(
    () => [
      {
        id: 'navigation',
        label: cc.navigation.navigate,
        search: async searchQuery => {
          const routeHits: RouteSearchHit[] = navigationSearchEntries.filter(entry =>
            matchesSearchQuery(searchQuery, entry.title, entry.detail, entry.route)
          ).map(entry => ({
            detail: entry.detail,
            kind: 'route',
            route: entry.route,
            title: entry.title
          }))

          const sectionHits: SectionSearchHit[] = sectionSearchEntries.filter(entry =>
            matchesSearchQuery(searchQuery, entry.title, entry.detail, sectionLabels[entry.section])
          ).map(entry => ({
            detail: entry.detail,
            kind: 'section',
            section: entry.section,
            title: entry.title
          }))

          return [...routeHits, ...sectionHits]
        }
      },
      {
        id: 'sessions',
        label: cc.sections.sessions,
        search: async searchQuery => {
          const response = await searchSessions(searchQuery)

          return response.results.map(result => {
            const { detail, title } = splitSessionSearchResult(result, sessionsById)

            return {
              detail,
              kind: 'session',
              sessionId: result.session_id,
              snippet: result.snippet || '',
              title
            } satisfies SessionSearchHit
          })
        }
      }
    ],
    [cc.navigation.navigate, cc.sections.sessions, navigationSearchEntries, sectionLabels, sectionSearchEntries, sessionsById]
  )

  const refreshSystem = useCallback(async () => {
    setSystemLoading(true)
    setSystemError('')

    try {
      const [nextStatus, nextLogs] = await Promise.all([
        getStatus(),
        getLogs({
          file: 'agent',
          lines: 120
        })
      ])

      setStatus(nextStatus)
      setLogs(nextLogs.lines)
    } catch (error) {
      setSystemError(error instanceof Error ? error.message : String(error))
    } finally {
      setSystemLoading(false)
    }
  }, [])

  const refreshUsage = useCallback(async (days: UsagePeriod) => {
    const requestId = usageRequestRef.current + 1
    usageRequestRef.current = requestId
    setUsageLoading(true)
    setUsageError('')

    try {
      const response = await getUsageAnalytics(days)

      if (usageRequestRef.current === requestId) {
        setUsage(response)
      }
    } catch (error) {
      if (usageRequestRef.current === requestId) {
        setUsageError(error instanceof Error ? error.message : String(error))
      }
    } finally {
      if (usageRequestRef.current === requestId) {
        setUsageLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchGroups([])
      setSearchLoading(false)

      return
    }

    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    setSearchLoading(true)

    void Promise.all(
      searchProviders.map(async provider => ({
        id: provider.id,
        label: provider.label,
        results: await provider.search(debouncedQuery)
      }))
    )
      .then(groups => {
        if (searchRequestRef.current === requestId) {
          setSearchGroups(groups.filter(group => group.results.length > 0))
        }
      })
      .catch(() => {
        if (searchRequestRef.current === requestId) {
          setSearchGroups([])
        }
      })
      .finally(() => {
        if (searchRequestRef.current === requestId) {
          setSearchLoading(false)
        }
      })
  }, [debouncedQuery, searchProviders])

  useEffect(() => {
    if (section === 'system' && !status && !systemLoading) {
      void refreshSystem()
    }
  }, [refreshSystem, section, status, systemLoading])

  useEffect(() => {
    if (section === 'usage') {
      void refreshUsage(usagePeriod)
    }
  }, [refreshUsage, section, usagePeriod])

  const showGlobalSearchResults = debouncedQuery.length > 0
  const hasGlobalSearchResults = searchGroups.length > 0
  const sessionListHasResults = filteredSessions.length > 0

  const runSystemAction = useCallback(
    async () => {
      setSystemError('')

      try {
        const started = await restartGateway()
        let nextStatus: ActionStatusResponse | null = null

        for (let attempt = 0; attempt < 18; attempt += 1) {
          await new Promise(resolve => window.setTimeout(resolve, 1200))
          const polled = await getActionStatus(started.name, 180)
          nextStatus = polled
          setSystemAction(polled)
          upsertDesktopActionTask(polled)

          if (!polled.running) {
            break
          }
        }

        if (!nextStatus) {
          const pendingStatus = {
            exit_code: null,
            lines: [t.commandCenter.system.actionPending],
            name: started.name,
            pid: started.pid,
            running: true
          }

          setSystemAction(pendingStatus)
          upsertDesktopActionTask(pendingStatus)
        }
      } catch (error) {
        setSystemError(error instanceof Error ? error.message : String(error))
      } finally {
        void refreshSystem()
      }
    },
    [refreshSystem, t.commandCenter.system.actionPending]
  )

  const handleSearchSelect = useCallback(
    (result: CommandCenterSearchResult) => {
      if (result.kind === 'route') {
        onNavigateRoute(result.route)

        return
      }

      if (result.kind === 'section') {
        setSection(result.section)
        setQuery('')

        return
      }

      onOpenSession(result.sessionId)
    },
    [onNavigateRoute, onOpenSession, setSection]
  )

  return (
    <OverlayView
      closeLabel={t.common.close}
      headerContent={
        <OverlaySearchInput
          containerClassName="w-[min(28rem,calc(100vw-9rem))] min-w-[18rem]"
          loading={searchLoading}
          onChange={next => setQuery(next)}
          placeholder={t.commandPalette.searchPlaceholder}
          value={query}
        />
      }
      rootClassName="h-[min(42rem,calc(100vh-1rem))] max-w-[min(68rem,calc(100vw-1rem))]"
      onClose={onClose}
    >
      <OverlaySplitLayout className="grid-cols-[12.75rem_minmax(0,1fr)] max-[52rem]:grid-cols-1">
        <OverlaySidebar className="gap-2 px-2.5 py-2.5">
          {SECTIONS.map(value => (
            <OverlayNavItem
              active={section === value}
              icon={value === 'sessions' ? Pin : value === 'system' ? Activity : BarChart3}
              key={value}
              label={sectionLabels[value]}
              onClick={() => setSection(value)}
            />
          ))}
        </OverlaySidebar>

        <OverlayMain className="p-3.5">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{sectionLabels[section]}</h2>
              <p className="text-xs text-[var(--muted)]">{sectionDescriptions[section]}</p>
            </div>
            {section === 'system' && (
              <OverlayActionButton disabled={systemLoading} onClick={() => void refreshSystem()}>
                <IconRefresh className={cn('mr-1.5 size-3.5', systemLoading && 'animate-spin')} />
                {systemLoading ? t.common.loading : t.common.refresh}
              </OverlayActionButton>
            )}
            {section === 'usage' && (
              <OverlayActionButton disabled={usageLoading} onClick={() => void refreshUsage(usagePeriod)}>
                <IconRefresh className={cn('mr-1.5 size-3.5', usageLoading && 'animate-spin')} />
                {usageLoading ? t.common.loading : t.common.refresh}
              </OverlayActionButton>
            )}
          </header>

          {showGlobalSearchResults ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {!hasGlobalSearchResults ? (
                <div className="rounded-[0.75rem] px-3 py-4 text-sm text-[var(--muted)]">
                  {t.sidebar.noMatch(debouncedQuery)}
                </div>
              ) : (
                <div className="grid gap-2">
                  {searchGroups.map(group => (
                    <section className="grid gap-1.5" key={group.id}>
                      <h3 className="px-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {group.label}
                      </h3>
                      {group.results.map(result => {
                        if (result.kind === 'session') {
                          const pinned = pinnedSessionIds.includes(result.sessionId)

                          return (
                            <div
                              className="group/search-row border-b border-[var(--workbench-divider)] px-2 py-2 transition-colors hover:bg-[var(--workbench-hover)]"
                              key={`${group.id}:${result.sessionId}:${result.snippet}`}
                            >
                              <button
                                className="w-full text-left"
                                onClick={() => handleSearchSelect(result)}
                                type="button"
                              >
                                <div className="truncate text-sm font-medium text-foreground">{result.title}</div>
                                <div className="mt-0.5 text-xs text-[var(--muted)]">
                                  {result.detail || result.sessionId}
                                </div>
                                {result.snippet && (
                                  <div className="mt-1 whitespace-pre-wrap text-xs text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">
                                    {result.snippet}
                                  </div>
                                )}
                              </button>
                              <div className="mt-1.5 flex gap-1 opacity-70 transition-opacity group-hover/search-row:opacity-100">
                                <OverlayIconButton
                                  onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    pinned ? unpinSession(result.sessionId) : pinSession(result.sessionId)
                                  }}
                                  title={pinned ? t.sessionActions.unpin : t.sessionActions.pin}
                                >
                                  {pinned ? (
                                    <IconBookmarkFilled className="size-3.5" />
                                  ) : (
                                    <IconBookmark className="size-3.5" />
                                  )}
                                </OverlayIconButton>
                                <OverlayIconButton
                                  onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    void exportSession(result.sessionId, { title: result.title })
                                  }}
                                  title={t.sessionActions.export}
                                >
                                  <IconDownload className="size-3.5" />
                                </OverlayIconButton>
                                <OverlayIconButton
                                  className="hover:text-destructive"
                                  onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    void onDeleteSession(result.sessionId)
                                  }}
                                  title={t.sessionActions.delete}
                                >
                                  <IconTrash className="size-3.5" />
                                </OverlayIconButton>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <button
                            className="w-full border-b border-[var(--workbench-divider)] px-2 py-2 text-left transition-colors hover:bg-[var(--workbench-hover)]"
                            key={`${group.id}:${result.kind}:${result.title}`}
                            onClick={() => handleSearchSelect(result)}
                            type="button"
                          >
                            <div className="text-sm font-medium text-foreground">{result.title}</div>
                            {result.detail && (
                              <div className="mt-0.5 text-xs text-[var(--muted)]">{result.detail}</div>
                            )}
                          </button>
                        )
                      })}
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : section === 'sessions' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!sessionListHasResults ? (
                <div className="rounded-[0.75rem] px-3 py-4 text-sm text-[var(--muted)]">{t.sidebar.allPinned}</div>
              ) : (
                <div className="grid">
                  {filteredSessions.map(session => {
                    const pinned = pinnedSessionIds.includes(session.id)

                    return (
                      <div
                        className="flex items-center gap-2 border-b border-[var(--workbench-divider)] px-2 py-2 transition-colors hover:bg-[var(--workbench-hover)]"
                        key={session.id}
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => onOpenSession(session.id)}
                          type="button"
                        >
                          <div className="truncate text-sm font-medium text-foreground">{sessionTitle(session)}</div>
                          <div className="truncate text-xs text-[var(--muted)]">
                            {formatTimestamp(session.last_active || session.started_at)}
                          </div>
                        </button>
                        <OverlayIconButton
                          onClick={() => (pinned ? unpinSession(session.id) : pinSession(session.id))}
                          title={pinned ? t.sessionActions.unpin : t.sessionActions.pin}
                        >
                          {pinned ? <IconBookmarkFilled className="size-3.5" /> : <IconBookmark className="size-3.5" />}
                        </OverlayIconButton>
                        <OverlayIconButton
                          onClick={() => void exportSession(session.id, { session, title: sessionTitle(session) })}
                          title={t.sessionActions.export}
                        >
                          <IconDownload className="size-3.5" />
                        </OverlayIconButton>
                        <OverlayIconButton
                          className="hover:text-destructive"
                          onClick={() => void onDeleteSession(session.id)}
                          title={t.sessionActions.delete}
                        >
                          <IconTrash className="size-3.5" />
                        </OverlayIconButton>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : section === 'usage' ? (
            <UsagePanel
              error={usageError}
              loading={usageLoading}
              onPeriodChange={setUsagePeriod}
              onRefresh={() => void refreshUsage(usagePeriod)}
              period={usagePeriod}
              usage={usage}
            />
          ) : (
            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3">
              <OverlayCard className="p-3 text-sm">
                {status ? (
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              status.gateway_running ? 'bg-emerald-500' : 'bg-amber-500'
                            )}
                          />
                          <span className="font-medium text-foreground">
                            {status.gateway_running ? cc.system.gatewayRunning : cc.system.gatewayStopped}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          Hermes {status.version} · {cc.system.activeSessions(status.active_sessions)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                        <OverlayActionButton className="h-7 px-2.5" onClick={() => void runSystemAction()}>
                          {cc.system.restartMessaging}
                        </OverlayActionButton>
                      </div>
                    </div>
                    {systemAction && (
                      <div className="text-xs text-[var(--muted)]">
                        {systemAction.name} ·{' '}
                        {systemAction.running
                          ? cc.system.actionRunning
                          : systemAction.exit_code === 0
                            ? cc.system.actionDone
                            : cc.system.actionFailed}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--muted)]">{cc.system.loadingStatus}</div>
                )}
              </OverlayCard>

              <OverlayCard className="min-h-0 overflow-hidden p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--muted)]">{cc.system.recentLogs}</span>
                  {systemError && (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="size-3.5" />
                      {systemError}
                    </span>
                  )}
                </div>
                <pre className="h-full min-h-0 overflow-auto whitespace-pre-wrap wrap-break-word font-mono text-[0.65rem] leading-relaxed text-[var(--muted)]">
                  {logs.length ? logs.join('\n') : cc.system.noLogs}
                </pre>
              </OverlayCard>
            </div>
          )}
        </OverlayMain>
      </OverlaySplitLayout>
    </OverlayView>
  )
}

function formatTokens(value: null | number | undefined): string {
  const num = Number(value || 0)

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }

  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }

  return num.toLocaleString()
}

function formatCost(value: null | number | undefined): string {
  const num = Number(value || 0)

  if (num === 0) {
    return '$0.00'
  }

  if (num < 0.01) {
    return '<$0.01'
  }

  return `$${num.toFixed(2)}`
}

function formatInteger(value: null | number | undefined): string {
  return Number(value ?? 0).toLocaleString()
}

interface UsagePanelProps {
  error: string
  loading: boolean
  onPeriodChange: (period: UsagePeriod) => void
  onRefresh: () => void
  period: UsagePeriod
  usage: AnalyticsResponse | null
}

function UsagePanel({ error, loading, onPeriodChange, onRefresh, period, usage }: UsagePanelProps) {
  const { t } = useI18n()
  const daily = useMemo(() => usage?.daily ?? [], [usage])
  const totals = usage?.totals
  const byModel = usage?.by_model ?? []
  const topSkills = usage?.skills?.top_skills ?? []
  const up = t.commandCenter.usagePanel

  const maxTokens = useMemo(() => {
    if (!daily.length) {
      return 1
    }

    return daily.reduce((acc, entry) => Math.max(acc, (entry.input_tokens || 0) + (entry.output_tokens || 0)), 1)
  }, [daily])

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <OverlayCard className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-1">
          {USAGE_PERIODS.map(value => (
            <button
              className={cn(
                'h-7 rounded-[calc(var(--radius)*1.25)] px-2.5 text-xs font-medium transition-colors shadow-[var(--field-shadow)]',
                value === period
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'bg-[var(--default-soft)] text-[var(--default-soft-foreground)] hover:bg-[var(--default-soft-hover)] hover:text-[var(--foreground)]'
              )}
              key={value}
              onClick={() => onPeriodChange(value)}
              type="button"
            >
              {value}d
            </button>
          ))}
        </div>
        {error && (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            {error}
          </span>
        )}
      </OverlayCard>

      <OverlayCard className="p-3">
        {totals ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <UsageStat label={up.sessions} value={formatInteger(totals.total_sessions)} />
            <UsageStat label={up.apiCalls} value={formatInteger(totals.total_api_calls)} />
            <UsageStat
              label={up.tokensInOut}
              value={`${formatTokens(totals.total_input)} / ${formatTokens(totals.total_output)}`}
            />
            <UsageStat
              hint={totals.total_actual_cost > 0 ? up.actualCost(formatCost(totals.total_actual_cost)) : undefined}
              label={up.estimatedCost}
              value={formatCost(totals.total_estimated_cost)}
            />
          </div>
        ) : loading ? (
          <div className="text-xs text-[var(--muted)]">{up.loading}</div>
        ) : (
          <div className="text-xs text-[var(--muted)]">
            {up.noUsage(period)}{' '}
            <button className="underline underline-offset-4 decoration-current/20" onClick={onRefresh} type="button">
              {up.retry}
            </button>
          </div>
        )}
      </OverlayCard>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <OverlayCard className="p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">{up.dailyTokens}</span>
            <span className="flex items-center gap-3 text-[0.65rem] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 60%, transparent)' }}
                />{' '}
                {up.input}
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--success) 70%, transparent)' }}
                />{' '}
                {up.output}
              </span>
            </span>
          </div>
          {daily.length === 0 ? (
            <div className="grid h-24 place-items-center text-xs text-[var(--muted)]">{up.noDailyActivity}</div>
          ) : (
            <>
              <div className="flex h-24 items-end gap-px">
                {daily.map(entry => {
                  const inputH = Math.round(((entry.input_tokens || 0) / maxTokens) * 96)
                  const outputH = Math.round(((entry.output_tokens || 0) / maxTokens) * 96)

                  return (
                    <div
                      className="group relative flex h-24 min-w-0 flex-1 flex-col justify-end"
                      key={entry.day}
                      title={`${entry.day} · in ${formatTokens(entry.input_tokens)} · out ${formatTokens(entry.output_tokens)}`}
                    >
                      <div
                        className="w-full"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--accent) 50%, transparent)',
                          height: Math.max(inputH, entry.input_tokens > 0 ? 1 : 0)
                        }}
                      />
                      <div
                        className="w-full"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--success) 60%, transparent)',
                          height: Math.max(outputH, entry.output_tokens > 0 ? 1 : 0)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between text-[0.6rem] text-[color-mix(in_srgb,var(--foreground)_56%,transparent)]">
                <span>{daily[0]?.day}</span>
                <span>{daily[daily.length - 1]?.day}</span>
              </div>
            </>
          )}
        </OverlayCard>

        <OverlayCard className="min-h-0 overflow-auto p-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="min-w-0">
              <div className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-[var(--muted)]">
                {up.topModels}
              </div>
              {byModel.length === 0 ? (
                <div className="text-xs text-[var(--muted)]">{up.noModelUsage}</div>
              ) : (
                <ul className="space-y-1">
                  {byModel.slice(0, 6).map(entry => (
                    <li
                      className="flex items-center justify-between gap-2 rounded-[calc(var(--radius)*1.25)] px-1.5 py-1 text-xs transition-colors hover:bg-[var(--surface-secondary)]"
                      key={entry.model}
                    >
                      <span className="min-w-0 truncate font-mono text-[0.7rem] text-foreground">{entry.model}</span>
                      <span className="shrink-0 text-[0.65rem] text-[var(--muted)]">
                        {formatTokens((entry.input_tokens || 0) + (entry.output_tokens || 0))} ·{' '}
                        {formatCost(entry.estimated_cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="min-w-0">
              <div className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-[var(--muted)]">
                {up.topSkills}
              </div>
              {topSkills.length === 0 ? (
                <div className="text-xs text-[var(--muted)]">{up.noSkillActivity}</div>
              ) : (
                <ul className="space-y-1">
                  {topSkills.slice(0, 6).map(entry => (
                    <li
                      className="flex items-center justify-between gap-2 rounded-[calc(var(--radius)*1.25)] px-1.5 py-1 text-xs transition-colors hover:bg-[var(--surface-secondary)]"
                      key={entry.skill}
                    >
                      <span className="min-w-0 truncate font-mono text-[0.7rem] text-foreground">{entry.skill}</span>
                      <span className="shrink-0 text-[0.65rem] text-[var(--muted)]">
                        {up.actions(entry.total_count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </OverlayCard>
      </div>
    </div>
  )
}

function UsageStat({ hint, label, value }: { hint?: string; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tracking-tight text-foreground">{value}</div>
      {hint && (
        <div className="mt-0.5 truncate text-[0.62rem] text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]">
          {hint}
        </div>
      )}
    </div>
  )
}

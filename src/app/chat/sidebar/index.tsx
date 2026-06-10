import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '@nanostores/react'
import type * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { KbdGroup } from '@/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { searchSessions, type SessionInfo, type SessionSearchResult } from '@/hermes'
import { useI18n } from '@/i18n'
import { profileColor } from '@/lib/profile-color'
import { sessionMatchesSearch } from '@/lib/session-search'
import { cn } from '@/lib/utils'
import { $cronJobs } from '@/store/cron'
import {
  $pinnedSessionIds,
  $sidebarAgentsGrouped,
  $sidebarCronOpen,
  $sidebarOpen,
  $sidebarPinsOpen,
  $sidebarRecentsOpen,
  SESSION_SEARCH_FOCUS_EVENT,
  pinSession,
  reorderPinnedSession,
  setSidebarAgentsGrouped,
  setSidebarCronOpen,
  setSidebarPinsOpen,
  setSidebarRecentsOpen,
  SIDEBAR_SESSIONS_PAGE_SIZE,
  unpinSession
} from '@/store/layout'
import {
  $newChatProfile,
  $profiles,
  $profileScope,
  ALL_PROFILES,
  newSessionInProfile,
  normalizeProfileKey
} from '@/store/profile'
import {
  $currentCwd,
  $cronSessions,
  $selectedStoredSessionId,
  $sessionProfileTotals,
  $sessions,
  $sessionsLoading,
  $sessionsTotal,
  $workingSessionIds,
  sessionPinId
} from '@/store/session'

import { type AppView, ARTIFACTS_ROUTE, MESSAGING_ROUTE, SKILLS_ROUTE } from '../../routes'
import { SidebarPanelLabel } from '../../shell/sidebar-label'
import type { SidebarNavItem } from '../../types'

import { SidebarCronJobsSection } from './cron-jobs-section'
import { ProfileRail } from './profile-switcher'
import { SidebarSessionRow } from './session-row'
import { VirtualSessionList } from './virtual-session-list'

const VIRTUALIZE_THRESHOLD = 25

// Render the modifier key the user actually presses on this platform. The
// global accelerator is bound to both Cmd+N (macOS) and Ctrl+N (everywhere
// else) in desktop-controller.tsx, but the hint should match muscle memory.
const NEW_SESSION_KBD: readonly string[] =
  typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac') ? ['⌘', 'N'] : ['Ctrl', 'N']

const WORKSPACE_PAGE = 5
const PROFILE_INITIAL_PAGE = 5
const WS_ID_PREFIX = 'workspace:'

const wsId = (id: string) => `${WS_ID_PREFIX}${id}`
const parseWsId = (id: string) => (id.startsWith(WS_ID_PREFIX) ? id.slice(WS_ID_PREFIX.length) : null)
const countLabel = (loaded: number, total: number) => (total > loaded ? `${loaded}/${total}` : String(loaded))
const sessionTime = (s: SessionInfo) => s.last_active || s.started_at || 0

function orderByIds<T>(items: T[], getId: (item: T) => string, orderIds: string[]): T[] {
  if (!orderIds.length) {
    return items
  }

  const byId = new Map(items.map(item => [getId(item), item]))
  const seen = new Set<string>()
  const out: T[] = []

  for (const id of orderIds) {
    const item = byId.get(id)

    if (item) {
      out.push(item)
      seen.add(id)
    }
  }

  for (const item of items) {
    if (!seen.has(getId(item))) {
      out.push(item)
    }
  }

  return out
}

const baseName = (path: string) =>
  path
    .replace(/[/\\]+$/, '')
    .split(/[/\\]/)
    .filter(Boolean)
    .pop()

// FTS results cover sessions that aren't in the loaded page; synthesize a
// minimal SessionInfo so they render in the same row component (resume works
// by id; the snippet stands in for the preview).
function searchResultToSession(result: SessionSearchResult): SessionInfo {
  const ts = result.session_started ?? Date.now() / 1000

  return {
    archived: false,
    cwd: null,
    ended_at: null,
    id: result.session_id,
    input_tokens: 0,
    is_active: false,
    last_active: ts,
    message_count: 0,
    model: result.model ?? null,
    output_tokens: 0,
    preview: result.snippet?.trim() || null,
    source: result.source ?? null,
    started_at: ts,
    title: null,
    tool_call_count: 0
  }
}

function workspaceGroupsFor(sessions: SessionInfo[], emptyWorkspaceLabel: string): SidebarSessionGroup[] {
  const groups = new Map<string, SidebarSessionGroup>()

  for (const session of sessions) {
    const path = session.cwd?.trim() || ''
    const id = path || '__no_workspace__'
    const label = baseName(path) || path || emptyWorkspaceLabel

    const group = groups.get(id) ?? { id, label, path: path || null, sessions: [] }
    group.sessions.push(session)
    groups.set(id, group)
  }

  // Groups keep recency order (Map insertion = first-seen in the recency-sorted
  // input, so an active project floats up), but rows *within* a group sort by
  // creation time so they don't reshuffle every time a message lands — keeps
  // muscle memory intact.
  for (const group of groups.values()) {
    group.sessions.sort((a, b) => b.started_at - a.started_at)
  }

  return [...groups.values()]
}

function useSortableBindings(id: string) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id })

  return {
    dragging: isDragging,
    dragHandleProps: { ...attributes, ...listeners },
    ref: setNodeRef,
    reorderable: true as const,
    style: { transform: CSS.Transform.toString(transform), transition }
  }
}

interface ChatSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentView: AppView
  onNavigate: (item: SidebarNavItem) => void
  onLoadMoreSessions: () => void
  onLoadMoreProfileSessions?: (profile: string) => Promise<void> | void
  onResumeSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onArchiveSession: (sessionId: string) => void
  onNewSessionInWorkspace: (path: null | string) => void
  onManageCronJob: (jobId: string) => void
  onOpenSearch: () => void
  onTriggerCronJob: (jobId: string) => void
}

export function ChatSidebar({
  currentView,
  onNavigate,
  onLoadMoreSessions,
  onLoadMoreProfileSessions,
  onResumeSession,
  onDeleteSession,
  onArchiveSession,
  onNewSessionInWorkspace,
  onManageCronJob,
  onTriggerCronJob
}: ChatSidebarProps) {
  const { t } = useI18n()
  const s = t.sidebar
  const sidebarNav: SidebarNavItem[] = [
    {
      id: 'new-session',
      label: s.newSession,
      icon: props => <Codicon name="robot" {...props} />,
      action: 'new-session'
    },
    {
      id: 'skills',
      label: s.skills,
      icon: props => <Codicon name="symbol-misc" {...props} />,
      route: SKILLS_ROUTE
    },
    { id: 'messaging', label: s.messaging, icon: props => <Codicon name="comment" {...props} />, route: MESSAGING_ROUTE },
    { id: 'artifacts', label: s.artifacts, icon: props => <Codicon name="files" {...props} />, route: ARTIFACTS_ROUTE }
  ]
  const sidebarOpen = useStore($sidebarOpen)
  const agentsGrouped = useStore($sidebarAgentsGrouped)
  const cronOpen = useStore($sidebarCronOpen)
  const pinnedSessionIds = useStore($pinnedSessionIds)
  const pinsOpen = useStore($sidebarPinsOpen)
  const agentsOpen = useStore($sidebarRecentsOpen)
  const selectedSessionId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)
  const cronSessions = useStore($cronSessions)
  const cronJobs = useStore($cronJobs)
  const sessionsLoading = useStore($sessionsLoading)
  const sessionsTotal = useStore($sessionsTotal)
  const sessionProfileTotals = useStore($sessionProfileTotals)
  const workingSessionIds = useStore($workingSessionIds)
  const profiles = useStore($profiles)
  const profileScope = useStore($profileScope)
  const multiProfile = profiles.length > 1
  const showAllProfiles = multiProfile && profileScope === ALL_PROFILES
  const [agentOrderIds, setAgentOrderIds] = useState<string[]>([])
  const [workspaceOrderIds, setWorkspaceOrderIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [serverMatches, setServerMatches] = useState<SessionSearchResult[]>([])
  const [profileLoadMorePending, setProfileLoadMorePending] = useState<Record<string, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)
  const trimmedQuery = searchQuery.trim()

  const activeSidebarSessionId = currentView === 'chat' ? selectedSessionId : null

  useEffect(() => {
    const focusSearch = () => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }

    window.addEventListener(SESSION_SEARCH_FOCUS_EVENT, focusSearch)

    return () => window.removeEventListener(SESSION_SEARCH_FOCUS_EVENT, focusSearch)
  }, [])

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const visibleSessions = useMemo(
    () => (showAllProfiles ? sessions : sessions.filter(s => normalizeProfileKey(s.profile) === profileScope)),
    [sessions, showAllProfiles, profileScope]
  )

  const sortedSessions = useMemo(() => [...visibleSessions].sort((a, b) => sessionTime(b) - sessionTime(a)), [visibleSessions])

  const workingSessionIdSet = useMemo(() => new Set(workingSessionIds), [workingSessionIds])

  // Index sessions by both their live id and their lineage-root id so a pin
  // stored as the pre-compression root resolves to the live continuation tip.
  const sessionByAnyId = useMemo(() => {
    const map = new Map<string, SessionInfo>()

    for (const s of [...cronSessions, ...visibleSessions]) {
      map.set(s.id, s)

      if (s._lineage_root_id && !map.has(s._lineage_root_id)) {
        map.set(s._lineage_root_id, s)
      }
    }

    return map
  }, [visibleSessions, cronSessions])

  const pinnedSessions = useMemo(() => {
    const seen = new Set<string>()
    const out: SessionInfo[] = []

    for (const pinId of pinnedSessionIds) {
      const session = sessionByAnyId.get(pinId)

      if (session && !seen.has(session.id)) {
        seen.add(session.id)
        out.push(session)
      }
    }

    return out
  }, [pinnedSessionIds, sessionByAnyId])

  const pinnedRealIdSet = useMemo(() => new Set(pinnedSessions.map(s => s.id)), [pinnedSessions])

  // Full-text search across *all* sessions (not just the loaded page) so 699
  // sessions stay findable. Debounced; loaded sessions are matched instantly
  // client-side and merged ahead of the server hits.
  useEffect(() => {
    if (!trimmedQuery) {
      return
    }

    let cancelled = false

    const id = window.setTimeout(() => {
      void searchSessions(trimmedQuery)
        .then(res => {
          if (!cancelled) {
            setServerMatches(res.results)
          }
        })
        .catch(() => undefined)
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [trimmedQuery])

  const searchResults = useMemo(() => {
    if (!trimmedQuery) {
      return []
    }

    const out = new Map<string, SessionInfo>()

    for (const s of sortedSessions) {
      if (sessionMatchesSearch(s, trimmedQuery)) {
        out.set(s.id, s)
      }
    }

    for (const match of serverMatches) {
      if (out.has(match.session_id)) {
        continue
      }

      const loaded = sessionByAnyId.get(match.session_id)
      out.set(match.session_id, loaded ?? searchResultToSession(match))
    }

    return [...out.values()]
  }, [trimmedQuery, sortedSessions, serverMatches, sessionByAnyId])

  const unpinnedAgentSessions = useMemo(
    () => sortedSessions.filter(s => !pinnedRealIdSet.has(s.id)),
    [sortedSessions, pinnedRealIdSet]
  )

  const agentSessions = useMemo(
    () => orderByIds(unpinnedAgentSessions, s => s.id, agentOrderIds),
    [unpinnedAgentSessions, agentOrderIds]
  )

  const agentGroups = useMemo(
    () => orderByIds(workspaceGroupsFor(agentSessions, s.workspaceNone), g => g.id, workspaceOrderIds),
    [agentSessions, s.workspaceNone, workspaceOrderIds]
  )

  const loadMoreForProfileGroup = useCallback(
    (profile: string) => {
      if (!onLoadMoreProfileSessions) {
        return
      }

      setProfileLoadMorePending(prev => ({ ...prev, [profile]: true }))

      void Promise.resolve(onLoadMoreProfileSessions(profile))
        .catch(() => undefined)
        .finally(() =>
          setProfileLoadMorePending(prev => {
            const next = { ...prev }
            delete next[profile]

            return next
          })
        )
    },
    [onLoadMoreProfileSessions]
  )

  const profileGroups = useMemo<SidebarSessionGroup[] | undefined>(() => {
    if (!showAllProfiles) {
      return undefined
    }

    const groups = new Map<string, SidebarSessionGroup>()

    for (const session of agentSessions) {
      const key = normalizeProfileKey(session.profile)
      const group = groups.get(key) ?? {
        color: profileColor(key),
        id: key,
        label: key,
        mode: 'profile',
        path: null,
        sessions: []
      }

      group.sessions.push(session)
      groups.set(key, group)
    }

    return [...groups.values()]
      .map(group => ({
        ...group,
        loadingMore: Boolean(profileLoadMorePending[group.id]),
        onLoadMore: onLoadMoreProfileSessions ? () => loadMoreForProfileGroup(group.id) : undefined,
        totalCount: Math.max(group.sessions.length, sessionProfileTotals[group.id] ?? 0)
      }))
      .sort((a, b) => (a.id === 'default' ? -1 : b.id === 'default' ? 1 : a.label.localeCompare(b.label)))
  }, [
    showAllProfiles,
    agentSessions,
    loadMoreForProfileGroup,
    onLoadMoreProfileSessions,
    profileLoadMorePending,
    sessionProfileTotals
  ])

  const hasPinnedSessions = pinnedSessions.length > 0
  const showSessionSkeletons = sessionsLoading && sortedSessions.length === 0 && !hasPinnedSessions
  const showSessionSections = true
  const loadedSessionCount = showAllProfiles ? sessions.length : visibleSessions.length
  const scopedProfileTotal = showAllProfiles ? undefined : sessionProfileTotals[profileScope]
  const recentsLoadedCount = Math.max(sortedSessions.length, hasPinnedSessions ? agentSessions.length + pinnedSessions.length : agentSessions.length)
  const knownSessionTotal = Math.max(
    showAllProfiles ? sessionsTotal : (scopedProfileTotal ?? loadedSessionCount),
    loadedSessionCount,
    recentsLoadedCount
  )
  const hasMoreSessions = knownSessionTotal > loadedSessionCount
  const remainingSessionCount = Math.max(0, knownSessionTotal - loadedSessionCount)
  const recentsMeta = countLabel(recentsLoadedCount, knownSessionTotal)

  const handlePinnedDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return
    }

    const newIndex = pinnedSessions.findIndex(s => s.id === String(over.id))

    if (newIndex < 0) {
      return
    }

    // Sortable ids are live session ids; the pinned store is keyed by durable
    // (lineage-root) ids, so translate before reordering.
    const dragged = sessionByAnyId.get(String(active.id))
    reorderPinnedSession(dragged ? sessionPinId(dragged) : String(active.id), newIndex)
  }

  const handleAgentDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    const activeWs = parseWsId(activeId)
    const overWs = parseWsId(overId)

    if (activeWs && overWs) {
      const oldIdx = agentGroups.findIndex(g => g.id === activeWs)
      const newIdx = agentGroups.findIndex(g => g.id === overWs)

      if (oldIdx < 0 || newIdx < 0) {
        return
      }

      setWorkspaceOrderIds(arrayMove(agentGroups, oldIdx, newIdx).map(g => g.id))

      return
    }

    if (activeWs || overWs) {
      return
    }

    const oldIdx = agentSessions.findIndex(s => s.id === activeId)
    const newIdx = agentSessions.findIndex(s => s.id === overId)

    if (oldIdx < 0 || newIdx < 0) {
      return
    }

    setAgentOrderIds(arrayMove(agentSessions, oldIdx, newIdx).map(s => s.id))
  }

  return (
    <Sidebar
      className={cn(
        'relative h-full min-w-0 overflow-hidden border-r border-t-0 border-b-0 border-l-0 text-foreground transition-none',
        sidebarOpen
          ? 'border-[color-mix(in_srgb,var(--workbench-divider)_72%,transparent)] bg-[var(--workbench-panel-strong-bg)] opacity-100 shadow-none'
          : 'pointer-events-none border-transparent bg-transparent opacity-0'
      )}
      collapsible="none"
    >
      <SidebarContent className="heroui-sidebar-content gap-0 overflow-hidden">
        <SidebarGroup className="shrink-0 p-0">
          <SidebarGroupContent className="heroui-sidebar-top-card">
            <div className="heroui-sidebar-brand">
              <span className="heroui-sidebar-brand-icon">
                <Codicon name="robot" size="0.78rem" />
              </span>
              <div className="min-w-0 flex flex-1 items-center">
                <span className="truncate text-[0.76rem] font-semibold tracking-[-0.02em] text-foreground/90">
                  Hermes Desktop Community
                </span>
              </div>
            </div>
            <SidebarMenu className="heroui-sidebar-menu">
              {sidebarNav.map(item => {
                const isInteractive = Boolean(item.action) || Boolean(item.route)
                const itemLabel =
                  item.id === 'new-session'
                    ? s.newSession
                    : item.id === 'skills'
                      ? s.skills
                      : item.id === 'messaging'
                        ? s.messaging
                        : item.id === 'artifacts'
                          ? s.artifacts
                          : item.label

                const active =
                  (item.id === 'skills' && currentView === 'skills') ||
                  (item.id === 'messaging' && currentView === 'messaging') ||
                  (item.id === 'artifacts' && currentView === 'artifacts')

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      aria-disabled={!isInteractive}
                      className={cn(
                        'heroui-sidebar-menu-item',
                        active && 'is-active',
                        !isInteractive &&
                          'cursor-default hover:border-transparent hover:bg-transparent hover:text-inherit'
                      )}
                      onClick={() => {
                        if (item.id === 'new-session') {
                          $newChatProfile.set(null)
                        }

                        onNavigate(item)
                      }}
                      tooltip={itemLabel}
                      type="button"
                    >
                      <span className="heroui-sidebar-menu-icon">
                        <item.icon className="size-3.5 shrink-0" />
                      </span>
                      {sidebarOpen && (
                        <>
                          <span className="min-w-0 flex-1 truncate max-[46.25rem]:hidden">{itemLabel}</span>
                          {item.id === 'new-session' && (
                            <KbdGroup className="ml-auto max-[46.25rem]:hidden" keys={[...NEW_SESSION_KBD]} />
                          )}
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {sidebarOpen && showSessionSections && (
          <div className="heroui-sidebar-search-zone shrink-0">
            <div className="heroui-sidebar-search border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:border-[color-mix(in_srgb,var(--foreground)_9%,transparent)] focus-within:border-[color-mix(in_srgb,var(--accent)_16%,transparent)]">
              <Codicon className="shrink-0 text-[var(--muted)]" name="search" size="0.75rem" />
              <input
                aria-label={s.searchAria}
                className="h-5 min-w-0 flex-1 bg-transparent text-[0.72rem] text-foreground placeholder:text-[color-mix(in_srgb,var(--foreground)_42%,transparent)] focus:outline-none"
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={s.searchPlaceholder}
                ref={searchInputRef}
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  aria-label={s.clearSearch}
                  className="heroui-sidebar-icon-button"
                  onClick={() => setSearchQuery('')}
                  type="button"
                >
                  <Codicon name="close" size="0.75rem" />
                </button>
              )}
            </div>
          </div>
        )}

        {sidebarOpen && showSessionSections && trimmedQuery && (
          <SidebarSessionsSection
            activeSessionId={activeSidebarSessionId}
            contentClassName="heroui-session-list flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-1.5"
            emptyState={
              <div className="grid min-h-24 place-items-center rounded-lg px-2 text-center text-xs text-[var(--muted)]">
                {s.noMatch(trimmedQuery)}
              </div>
            }
            label={s.results}
            labelMeta={String(searchResults.length)}
            onArchiveSession={onArchiveSession}
            onDeleteSession={onDeleteSession}
            onResumeSession={onResumeSession}
            onToggle={() => undefined}
            onTogglePin={pinSession}
            open
            pinned={false}
            rootClassName="heroui-sidebar-section-card min-h-0 flex-1"
            sessions={searchResults}
            workingSessionIdSet={workingSessionIdSet}
          />
        )}

        {sidebarOpen && showSessionSections && !trimmedQuery && (
          <SidebarSessionsSection
            activeSessionId={activeSidebarSessionId}
            contentClassName="heroui-session-list flex min-h-10 shrink-0 flex-col pb-1.5 pt-0.5"
            dndSensors={dndSensors}
            emptyState={<SidebarPinnedEmptyState />}
            label={s.pinned}
            onArchiveSession={onArchiveSession}
            onDeleteSession={onDeleteSession}
            onReorder={handlePinnedDragEnd}
            onResumeSession={onResumeSession}
            onToggle={() => setSidebarPinsOpen(!pinsOpen)}
            onTogglePin={unpinSession}
            open={pinsOpen}
            pinned
            rootClassName="heroui-sidebar-section-card shrink-0"
            sessions={pinnedSessions}
            sortable={pinnedSessions.length > 1}
            workingSessionIdSet={workingSessionIdSet}
          />
        )}

        {sidebarOpen && showSessionSections && !trimmedQuery && (
          <SidebarSessionsSection
            activeSessionId={activeSidebarSessionId}
            contentClassName={cn(
              'heroui-session-list flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-1.5',
              showAllProfiles ? 'gap-2' : ''
            )}
            dndSensors={dndSensors}
            emptyState={
              showSessionSkeletons ? (
                <SidebarSessionSkeletons />
              ) : sortedSessions.length > 0 || hasPinnedSessions ? (
                <SidebarAllPinnedState />
              ) : (
                <SidebarNoSessionsState />
              )
            }
            footer={
              !showAllProfiles && !agentsGrouped && !showSessionSkeletons && hasMoreSessions ? (
                <SidebarLoadMoreRow
                  loading={sessionsLoading}
                  onClick={onLoadMoreSessions}
                  step={Math.min(SIDEBAR_SESSIONS_PAGE_SIZE, remainingSessionCount)}
                />
              ) : null
            }
            forceEmptyState={showSessionSkeletons}
            groups={showAllProfiles ? profileGroups : agentsGrouped ? agentGroups : undefined}
            headerAction={
              <div className="grid size-5 shrink-0 place-items-center">
                {!showAllProfiles && agentSessions.length > 0 ? (
                    <Button
                    aria-label={agentsGrouped ? s.workspaceUngroup : s.workspaceGroup}
                    className={cn(
                      'heroui-sidebar-section-action',
                      agentsGrouped && 'is-active'
                    )}
                    onClick={event => {
                      event.stopPropagation()
                      setSidebarRecentsOpen(true)
                      setSidebarAgentsGrouped(!agentsGrouped)
                    }}
                    size="icon-xs"
                    title={agentsGrouped ? s.workspaceUngroup : s.workspaceGroup}
                    variant="ghost"
                  >
                    <Codicon name={agentsGrouped ? 'list-unordered' : 'root-folder'} size="0.75rem" />
                  </Button>
                ) : null}
              </div>
            }
            label={s.sessions}
            labelMeta={recentsMeta}
            onArchiveSession={onArchiveSession}
            onDeleteSession={onDeleteSession}
            onNewSessionInWorkspace={showAllProfiles ? undefined : onNewSessionInWorkspace}
            onReorder={showAllProfiles ? undefined : handleAgentDragEnd}
            onResumeSession={onResumeSession}
            onToggle={() => setSidebarRecentsOpen(!agentsOpen)}
            onTogglePin={pinSession}
            open={agentsOpen}
            pinned={false}
            rootClassName="heroui-sidebar-section-card min-h-0 flex-1"
            sessions={agentSessions}
            sortable={!showAllProfiles && agentSessions.length > 1}
            workingSessionIdSet={workingSessionIdSet}
          />
        )}

        {sidebarOpen && !trimmedQuery && cronJobs.length > 0 && (
          <SidebarCronJobsSection
            jobs={cronJobs}
            label={s.cronJobs}
            onManageJob={onManageCronJob}
            onToggle={() => setSidebarCronOpen(!cronOpen)}
            onTriggerJob={onTriggerCronJob}
            open={cronOpen}
          />
        )}

        {sidebarOpen && !showSessionSections && <div className="min-h-0 flex-1" />}

        {sidebarOpen && (
          <div className="heroui-sidebar-profile-zone shrink-0">
            <ProfileRail />
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  )
}

interface SidebarSectionHeaderProps {
  label: string
  open: boolean
  onToggle: () => void
  action?: React.ReactNode
  meta?: React.ReactNode
}

function SidebarSectionHeader({ label, open, onToggle, action, meta }: SidebarSectionHeaderProps) {
  return (
    <div className="heroui-sidebar-section-header group/section">
      <button
        className="heroui-sidebar-section-button group/section-label"
        onClick={onToggle}
        type="button"
      >
        <SidebarPanelLabel>{label}</SidebarPanelLabel>
        {meta && <SidebarCount>{meta}</SidebarCount>}
        <DisclosureCaret
          className="text-[var(--muted)] opacity-0 transition group-hover/section-label:opacity-100"
          open={open}
        />
      </button>
      {action}
    </div>
  )
}

function SidebarSessionSkeletons() {
  return (
    <div aria-hidden="true" className="grid gap-0.5">
      {['w-32', 'w-40', 'w-28', 'w-36', 'w-24'].map((width, i) => (
        <div className="grid min-h-6 grid-cols-[minmax(0,1fr)_1.5rem] items-center rounded-lg" key={`${width}-${i}`}>
          <Skeleton className={cn('h-3.5 rounded-full', width)} />
          <Skeleton className="mx-auto size-4 rounded-md opacity-60" />
        </div>
      ))}
    </div>
  )
}

function SidebarAllPinnedState() {
  const { t } = useI18n()

  return (
    <div className="grid min-h-24 place-items-center rounded-lg text-center text-xs text-[var(--muted)]">
      {t.sidebar.allPinned}
    </div>
  )
}

function SidebarNoSessionsState() {
  const { t } = useI18n()

  return (
    <div className="grid min-h-24 place-items-center rounded-lg px-2 text-center text-xs text-[var(--muted)]">
      {t.sidebar.noSessions}
    </div>
  )
}

function SidebarPinnedEmptyState() {
  const { t } = useI18n()

  return (
    <div className="mx-1 flex min-h-7 items-center gap-1.5 rounded-[0.75rem] bg-[color-mix(in_srgb,var(--foreground)_2.5%,transparent)] px-2 text-[0.68rem] text-[var(--muted)]">
      <span className="grid w-3.5 shrink-0 place-items-center text-[color-mix(in_srgb,var(--foreground)_38%,transparent)]">
        <Codicon name="pin" size="0.75rem" />
      </span>
      <span className="min-w-0 truncate whitespace-nowrap">{t.sidebar.shiftClickHint}</span>
    </div>
  )
}

interface SidebarSessionGroup {
  id: string
  label: string
  path: null | string
  sessions: SessionInfo[]
  color?: null | string
  loadingMore?: boolean
  mode?: 'profile' | 'workspace'
  onLoadMore?: () => void
  totalCount?: number
}

interface SidebarSessionsSectionProps {
  label: string
  open: boolean
  onToggle: () => void
  sessions: SessionInfo[]
  activeSessionId: null | string
  workingSessionIdSet: Set<string>
  onResumeSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onArchiveSession: (sessionId: string) => void
  onTogglePin: (sessionId: string) => void
  onNewSessionInWorkspace?: (path: null | string) => void
  pinned: boolean
  rootClassName?: string
  contentClassName?: string
  emptyState: React.ReactNode
  forceEmptyState?: boolean
  headerAction?: React.ReactNode
  footer?: React.ReactNode
  groups?: SidebarSessionGroup[]
  labelMeta?: React.ReactNode
  sortable?: boolean
  onReorder?: (event: DragEndEvent) => void
  dndSensors?: ReturnType<typeof useSensors>
}

function SidebarSessionsSection({
  label,
  open,
  onToggle,
  sessions,
  activeSessionId,
  workingSessionIdSet,
  onResumeSession,
  onDeleteSession,
  onArchiveSession,
  onTogglePin,
  onNewSessionInWorkspace,
  pinned,
  rootClassName,
  contentClassName,
  emptyState,
  forceEmptyState = false,
  headerAction,
  footer,
  groups,
  labelMeta,
  sortable = false,
  onReorder,
  dndSensors
}: SidebarSessionsSectionProps) {
  const showEmptyState = forceEmptyState || sessions.length === 0
  const dndActive = sortable && !!onReorder

  const renderRow = (session: SessionInfo) => {
    const rowProps = {
      isPinned: pinned,
      isSelected: session.id === activeSessionId,
      isWorking: workingSessionIdSet.has(session.id),
      onArchive: () => onArchiveSession(session.id),
      onDelete: () => onDeleteSession(session.id),
      onPin: () => onTogglePin(sessionPinId(session)),
      onResume: () => onResumeSession(session.id),
      session
    }

    return sortable ? (
      <SortableSidebarSessionRow key={session.id} {...rowProps} />
    ) : (
      <SidebarSessionRow key={session.id} {...rowProps} />
    )
  }

  const renderRows = (items: SessionInfo[]) => items.map(renderRow)

  const renderSessionList = (items: SessionInfo[]) =>
    dndActive ? (
      <SortableContext items={items.map(s => s.id)} strategy={verticalListSortingStrategy}>
        {renderRows(items)}
      </SortableContext>
    ) : (
      renderRows(items)
    )

  const flatVirtualized = !showEmptyState && !groups?.length && sessions.length >= VIRTUALIZE_THRESHOLD

  let inner: React.ReactNode

  if (showEmptyState) {
    inner = emptyState
  } else if (groups?.length) {
    const groupNodes = groups.map(group =>
      dndActive ? (
        <SortableSidebarWorkspaceGroup
          group={group}
          key={group.id}
          onNewSession={onNewSessionInWorkspace}
          renderRows={renderSessionList}
        />
      ) : (
        <SidebarWorkspaceGroup
          group={group}
          key={group.id}
          onNewSession={onNewSessionInWorkspace}
          renderRows={renderSessionList}
        />
      )
    )

    inner = dndActive ? (
      <SortableContext items={groups.map(g => wsId(g.id))} strategy={verticalListSortingStrategy}>
        {groupNodes}
      </SortableContext>
    ) : (
      groupNodes
    )
  } else if (flatVirtualized) {
    inner = (
      <VirtualSessionList
        activeSessionId={activeSessionId}
        onArchiveSession={onArchiveSession}
        onDeleteSession={onDeleteSession}
        onResumeSession={onResumeSession}
        onTogglePin={onTogglePin}
        pinned={pinned}
        sessions={sessions}
        sortable={sortable}
        workingSessionIdSet={workingSessionIdSet}
      />
    )
  } else {
    inner = renderSessionList(sessions)
  }

  const body =
    dndActive && !showEmptyState ? (
      <DndContext collisionDetection={closestCenter} onDragEnd={onReorder} sensors={dndSensors}>
        {inner}
      </DndContext>
    ) : (
      inner
    )

  // The virtualizer owns its own scroller, so suppress the wrapper's overflow
  // to avoid a double scroll container.
  const resolvedContentClassName = cn(contentClassName, flatVirtualized && 'overflow-y-visible')

  return (
    <SidebarGroup className={rootClassName}>
      <SidebarSectionHeader action={headerAction} label={label} meta={labelMeta} onToggle={onToggle} open={open} />
      {open && (
        <SidebarGroupContent className={resolvedContentClassName}>
          {body}
          {footer}
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  )
}

interface SidebarWorkspaceGroupProps extends React.ComponentProps<'div'> {
  group: SidebarSessionGroup
  renderRows: (sessions: SessionInfo[]) => React.ReactNode
  onNewSession?: (path: null | string) => void
  reorderable?: boolean
  dragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
}

function SidebarWorkspaceGroup({
  group,
  renderRows,
  onNewSession,
  reorderable = false,
  dragging = false,
  dragHandleProps,
  className,
  style,
  ref,
  ...rest
}: SidebarWorkspaceGroupProps) {
  const { t } = useI18n()
  const s = t.sidebar
  const isProfileGroup = group.mode === 'profile'
  const pageStep = isProfileGroup ? PROFILE_INITIAL_PAGE : WORKSPACE_PAGE
  const [open, setOpen] = useState(true)
  const [visibleCount, setVisibleCount] = useState(pageStep)
  const loadedCount = group.sessions.length
  const totalCount = isProfileGroup ? Math.max(group.totalCount ?? loadedCount, loadedCount) : loadedCount
  const visibleSessions = group.sessions.slice(0, visibleCount)
  const hiddenCount = Math.max(0, totalCount - visibleSessions.length)
  const nextCount = Math.min(pageStep, hiddenCount)

  const handleProfileLoadMore = () => {
    const target = visibleCount + pageStep

    setVisibleCount(target)

    if (target > loadedCount && loadedCount < totalCount) {
      group.onLoadMore?.()
    }
  }

  return (
    <div className={cn('heroui-session-group', dragging && 'z-10 opacity-60', className)} ref={ref} style={style} {...rest}>
      <div className="heroui-session-group-header group/workspace">
        <button
          className="heroui-session-group-button"
          onClick={() => setOpen(value => !value)}
          title={group.path ?? undefined}
          type="button"
        >
          {group.color ? (
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
          ) : null}
          <span className="truncate">{group.label}</span>
          <SidebarCount>{isProfileGroup ? countLabel(visibleSessions.length, totalCount) : group.sessions.length}</SidebarCount>
          <DisclosureCaret
            className="text-[var(--muted)] opacity-0 transition group-hover/workspace:opacity-100"
            open={open}
          />
        </button>
        {onNewSession && (
          <button
            aria-label={s.newSessionIn(group.label)}
            className="heroui-sidebar-icon-button opacity-0 group-hover/workspace:opacity-100"
            onClick={() => onNewSession(group.path)}
            title={s.newSessionIn(group.label)}
            type="button"
          >
            <Codicon name="add" size="0.75rem" />
          </button>
        )}
        {isProfileGroup && (
          <button
            aria-label={s.newSessionIn(group.label)}
            className="heroui-sidebar-icon-button opacity-0 group-hover/workspace:opacity-100"
            onClick={() => newSessionInProfile(group.id)}
            title={s.newSessionIn(group.label)}
            type="button"
          >
            <Codicon name="add" size="0.75rem" />
          </button>
        )}
        {reorderable && (
          <span
            {...dragHandleProps}
            aria-label={`Reorder workspace ${group.label}`}
            className="ml-auto -my-0.5 grid w-4 shrink-0 cursor-grab touch-none place-items-center self-stretch overflow-hidden active:cursor-grabbing"
            onClick={event => event.stopPropagation()}
          >
            <Codicon
              className={cn(
                'text-[color-mix(in_srgb,var(--foreground)_38%,transparent)] opacity-0 transition-opacity group-hover/workspace:opacity-80 hover:text-foreground',
                dragging && 'text-foreground opacity-100'
              )}
              name="grabber"
              size="0.75rem"
            />
          </span>
        )}
      </div>
      {open && (
        <>
          {renderRows(visibleSessions)}
          {hiddenCount > 0 && (
            isProfileGroup ? (
              <SidebarLoadMoreRow loading={Boolean(group.loadingMore)} onClick={handleProfileLoadMore} step={nextCount} />
            ) : (
              <button
                aria-label={s.showMoreIn(nextCount, group.label)}
                className="heroui-session-load-more"
                onClick={() => setVisibleCount(count => count + WORKSPACE_PAGE)}
                title={s.showMoreIn(nextCount, group.label)}
                type="button"
              >
                <Codicon className="opacity-70" name="chevron-down" size="0.72rem" />
                <span>{s.loadMoreCount(nextCount)}</span>
              </button>
            )
          )}
        </>
      )}
    </div>
  )
}

interface SortableWorkspaceProps {
  group: SidebarSessionGroup
  renderRows: (sessions: SessionInfo[]) => React.ReactNode
  onNewSession?: (path: null | string) => void
}

function SortableSidebarWorkspaceGroup(props: SortableWorkspaceProps) {
  return <SidebarWorkspaceGroup {...props} {...useSortableBindings(wsId(props.group.id))} />
}

function SidebarCount({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.64rem] font-medium text-[color-mix(in_srgb,var(--foreground)_44%,transparent)]">{children}</span>
}

interface SortableSessionRowProps {
  session: SessionInfo
  isPinned: boolean
  isSelected: boolean
  isWorking: boolean
  onArchive: () => void
  onDelete: () => void
  onPin: () => void
  onResume: () => void
}

function SortableSidebarSessionRow(props: SortableSessionRowProps) {
  return <SidebarSessionRow {...props} {...useSortableBindings(props.session.id)} />
}

interface SidebarLoadMoreRowProps {
  loading: boolean
  onClick: () => void
  step: number
}

function SidebarLoadMoreRow({ loading, onClick, step }: SidebarLoadMoreRowProps) {
  const { t } = useI18n()
  const label = loading ? t.common.loading : step > 0 ? t.sidebar.loadMoreCount(step) : t.sidebar.loadMore

  return (
    <button
      className="heroui-session-load-more"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      <Codicon className="opacity-70" name={loading ? 'loading' : 'chevron-down'} size="0.75rem" spinning={loading} />
      <span>{label}</span>
    </button>
  )
}

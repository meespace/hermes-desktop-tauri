// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createClientSessionState } from '@/lib/chat-runtime'
import { NEW_CHAT_ROUTE, sessionRoute } from '@/app/routes'
import type { ChatMessage } from '@/lib/chat-messages'
import type { SessionInfo, UsageStats } from '@/types/hermes'
import { $pinnedSessionIds } from '@/store/layout'
import {
  $activeSessionId,
  $currentBranch,
  $currentCwd,
  $currentUsage,
  $freshDraftReady,
  $messages,
  $selectedStoredSessionId,
  $sessions,
  $sessionsTotal
} from '@/store/session'

const deleteSession = vi.fn()
const getSessionMessages = vi.fn()
const notify = vi.fn()
const notifyError = vi.fn()
const setApiRequestProfile = vi.fn()
const setSessionArchived = vi.fn()

vi.mock('@/hermes', () => ({
  deleteSession: (...args: unknown[]) => deleteSession(...args),
  getSessionMessages: (...args: unknown[]) => getSessionMessages(...args),
  setApiRequestProfile: (...args: unknown[]) => setApiRequestProfile(...args),
  setSessionArchived: (...args: unknown[]) => setSessionArchived(...args)
}))

vi.mock('@/store/notifications', () => ({
  clearNotifications: vi.fn(),
  notify: (...args: unknown[]) => notify(...args),
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

function makeSession(id: string, title: string): SessionInfo {
  return {
    archived: false,
    cwd: '/workspace',
    ended_at: null,
    id,
    input_tokens: 11,
    is_active: true,
    last_active: 1,
    message_count: 3,
    model: 'hermes-4',
    output_tokens: 22,
    preview: 'preview text',
    source: 'tui',
    started_at: 1,
    title,
    tool_call_count: 0
  }
}

describe('useSessionActions archive rollback', () => {
  beforeEach(() => {
    deleteSession.mockReset()
    getSessionMessages.mockReset()
    notify.mockReset()
    notifyError.mockReset()
    setApiRequestProfile.mockReset()
    setSessionArchived.mockReset()

    $sessions.set([])
    $sessionsTotal.set(0)
    $pinnedSessionIds.set([])
    $selectedStoredSessionId.set(null)
    $activeSessionId.set(null)
    $messages.set([])
    $freshDraftReady.set(false)
    $currentCwd.set('')
    $currentBranch.set('')
    $currentUsage.set({
      calls: 0,
      input: 0,
      output: 0,
      total: 0
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('restores the selected session when archiving fails after optimistic removal', async () => {
    const session = { ...makeSession('session-1', 'Alpha'), profile: 'work' }
    const previousMessages: ChatMessage[] = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }]
    const previousUsage: UsageStats = { calls: 1, input: 12, output: 34, total: 46 }

    $sessions.set([session])
    $sessionsTotal.set(1)
    $pinnedSessionIds.set(['session-1'])
    $selectedStoredSessionId.set('session-1')
    $activeSessionId.set('runtime-1')
    $messages.set(previousMessages)
    $currentUsage.set(previousUsage)
    $currentCwd.set('/workspace')
    $currentBranch.set('main')

    setSessionArchived.mockRejectedValueOnce(new Error('archive failed'))

    const navigate = vi.fn()
    const activeSessionIdRef = { current: 'runtime-1' }
    const busyRef = { current: false }
    const creatingSessionRef = { current: false }
    const selectedStoredSessionIdRef = { current: 'session-1' }

    const { useSessionActions } = await import('./use-session-actions')
    const { result } = renderHook(() =>
      useSessionActions({
        activeSessionId: 'runtime-1',
        activeSessionIdRef,
        busyRef,
        creatingSessionRef,
        ensureSessionState: (_sessionId: string, storedSessionId?: string | null) => createClientSessionState(storedSessionId ?? null),
        getRouteToken: () => 'route-token',
        navigate,
        requestGateway: vi.fn(async () => undefined),
        runtimeIdByStoredSessionIdRef: { current: new Map([['session-1', 'runtime-1']]) },
        selectedStoredSessionId: 'session-1',
        selectedStoredSessionIdRef,
        sessionStateByRuntimeIdRef: { current: new Map() },
        syncSessionStateToView: vi.fn(),
        updateSessionState: vi.fn((sessionId, updater, storedSessionId) =>
          updater(createClientSessionState(storedSessionId ?? null))
        )
      })
    )

    await act(async () => {
      await result.current.archiveSession('session-1')
    })

    expect(setSessionArchived).toHaveBeenCalledWith('session-1', true, 'work')
    expect($sessions.get().map(item => item.id)).toEqual(['session-1'])
    expect($sessionsTotal.get()).toBe(1)
    expect($pinnedSessionIds.get()).toEqual(['session-1'])
    expect($selectedStoredSessionId.get()).toBe('session-1')
    expect(selectedStoredSessionIdRef.current).toBe('session-1')
    expect($activeSessionId.get()).toBe('runtime-1')
    expect(activeSessionIdRef.current).toBe('runtime-1')
    expect($messages.get()).toEqual(previousMessages)
    expect($currentUsage.get()).toEqual(previousUsage)
    expect($currentCwd.get()).toBe('/workspace')
    expect($currentBranch.get()).toBe('main')
    expect($freshDraftReady.get()).toBe(false)
    expect(navigate).toHaveBeenCalledWith(sessionRoute('session-1'), { replace: true })
  })

  it('treats deleting an already-missing selected session as local success', async () => {
    const session = { ...makeSession('session-1', 'Alpha'), profile: 'work' }
    const previousMessages: ChatMessage[] = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }]

    $sessions.set([session])
    $sessionsTotal.set(1)
    $pinnedSessionIds.set(['session-1'])
    $selectedStoredSessionId.set('session-1')
    $activeSessionId.set('runtime-1')
    $messages.set(previousMessages)
    $freshDraftReady.set(false)

    deleteSession.mockRejectedValueOnce(new Error('Session not found'))

    const navigate = vi.fn()
    const activeSessionIdRef = { current: 'runtime-1' }
    const busyRef = { current: false }
    const creatingSessionRef = { current: false }
    const selectedStoredSessionIdRef = { current: 'session-1' }

    const { useSessionActions } = await import('./use-session-actions')
    const { result } = renderHook(() =>
      useSessionActions({
        activeSessionId: 'runtime-1',
        activeSessionIdRef,
        busyRef,
        creatingSessionRef,
        ensureSessionState: (_sessionId: string, storedSessionId?: string | null) => createClientSessionState(storedSessionId ?? null),
        getRouteToken: () => 'route-token',
        navigate,
        requestGateway: vi.fn(async () => undefined),
        runtimeIdByStoredSessionIdRef: { current: new Map([['session-1', 'runtime-1']]) },
        selectedStoredSessionId: 'session-1',
        selectedStoredSessionIdRef,
        sessionStateByRuntimeIdRef: { current: new Map() },
        syncSessionStateToView: vi.fn(),
        updateSessionState: vi.fn((sessionId, updater, storedSessionId) =>
          updater(createClientSessionState(storedSessionId ?? null))
        )
      })
    )

    await act(async () => {
      await result.current.removeSession('session-1')
    })

    expect(deleteSession).toHaveBeenCalledWith('session-1', 'work')
    expect(notifyError).not.toHaveBeenCalled()
    expect($sessions.get()).toEqual([])
    expect($sessionsTotal.get()).toBe(0)
    expect($pinnedSessionIds.get()).toEqual([])
    expect($selectedStoredSessionId.get()).toBeNull()
    expect(selectedStoredSessionIdRef.current).toBeNull()
    expect($activeSessionId.get()).toBeNull()
    expect(activeSessionIdRef.current).toBeNull()
    expect($messages.get()).toEqual([])
    expect($freshDraftReady.get()).toBe(true)
    expect(navigate).toHaveBeenCalledWith(NEW_CHAT_ROUTE, { replace: true })
  })
})

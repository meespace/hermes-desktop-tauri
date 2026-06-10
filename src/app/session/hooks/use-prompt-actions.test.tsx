// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import type { AppendMessage } from '@assistant-ui/react'
import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $sessions, setBusy, setCurrentModel, setCurrentProvider, setMessages, setSessions } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import { usePromptActions } from './use-prompt-actions'

vi.mock('@/hermes', () => ({
  getHermesConfigRecord: vi.fn(async () => ({})),
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  setApiRequestProfile: vi.fn(),
  transcribeAudio: vi.fn()
}))

const RUNTIME_SESSION_ID = 'rt-abc123'

function sessionInfo(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    ended_at: null,
    id: RUNTIME_SESSION_ID,
    input_tokens: 0,
    is_active: true,
    last_active: 0,
    message_count: 3,
    model: null,
    output_tokens: 0,
    preview: null,
    source: null,
    started_at: 0,
    title: 'Old title',
    tool_call_count: 0,
    ...overrides
  }
}

interface HarnessHandle {
  editMessage: (message: AppendMessage) => Promise<void>
  steerPrompt: (text: string) => Promise<boolean>
  submitText: (text: string, options?: { attachments?: never[]; fromQueue?: boolean }) => Promise<boolean>
}

function Harness({
  busyRef,
  onReady,
  onSeedState,
  refreshSessions,
  requestGateway
}: {
  busyRef?: MutableRefObject<boolean>
  onReady: (handle: HarnessHandle) => void
  onSeedState?: (state: Record<string, unknown>) => void
  refreshSessions: () => Promise<void>
  requestGateway: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}) {
  const activeSessionIdRef: MutableRefObject<string | null> = { current: RUNTIME_SESSION_ID }
  const selectedStoredSessionIdRef: MutableRefObject<string | null> = { current: RUNTIME_SESSION_ID }
  const localBusyRef = busyRef ?? { current: false }
  const stateRef = useRef({
    messages: [],
    busy: false,
    awaitingResponse: false,
    interrupted: true,
    turnStartedAt: null
  } as never)

  const actions = usePromptActions({
    activeSessionId: RUNTIME_SESSION_ID,
    activeSessionIdRef,
    branchCurrentSession: async () => true,
    busyRef: localBusyRef,
    createBackendSessionForSend: async () => RUNTIME_SESSION_ID,
    handleSkinCommand: () => '',
    refreshSessions,
    requestGateway,
    selectedStoredSessionIdRef,
    startFreshSessionDraft: () => undefined,
    sttEnabled: false,
    updateSessionState: (_sessionId, updater) => {
      const next = updater(stateRef.current) as unknown as Record<string, unknown>
      stateRef.current = next as never
      onSeedState?.(next)

      return next as never
    }
  })

  useEffect(() => {
    onReady({ editMessage: actions.editMessage, steerPrompt: actions.steerPrompt, submitText: actions.submitText })
  }, [actions.editMessage, actions.steerPrompt, actions.submitText, onReady])

  return null
}

describe('usePromptActions /title', () => {
  beforeEach(() => {
    setSessions(() => [sessionInfo()])
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renames via the session.title RPC, updates the sidebar store, and refreshes', async () => {
    const refreshSessions = vi.fn(async () => undefined)
    const requestGateway = vi.fn(async (method: string) =>
      (method === 'session.title' ? { pending: false, title: 'New title' } : {}) as never
    )

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('/title New title')

    expect(requestGateway).toHaveBeenCalledWith('session.title', {
      session_id: RUNTIME_SESSION_ID,
      title: 'New title'
    })
    expect(requestGateway).not.toHaveBeenCalledWith('slash.exec', expect.anything())
    expect(refreshSessions).toHaveBeenCalledTimes(1)
    expect($sessions.get()[0]?.title).toBe('New title')
  })

  it('falls through to the slash worker for a bare /title', async () => {
    const refreshSessions = vi.fn(async () => undefined)
    const requestGateway = vi.fn(async () => ({ output: 'Title: Old title' }) as never)

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={refreshSessions} requestGateway={requestGateway} />)

    await handle!.submitText('/title')

    expect(requestGateway).not.toHaveBeenCalledWith('session.title', expect.anything())
    expect(requestGateway).toHaveBeenCalledWith('slash.exec', expect.objectContaining({ command: 'title' }))
  })
})

describe('usePromptActions editMessage', () => {
  afterEach(() => {
    cleanup()
    setBusy(false)
    setMessages([])
    vi.restoreAllMocks()
  })

  it('does not resend an edited user message after a completed assistant reply', async () => {
    setBusy(false)
    setMessages([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'old text' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'done' }] }
    ])

    const requestGateway = vi.fn(async () => ({}) as never)
    let handle: HarnessHandle | null = null

    render(<Harness onReady={h => (handle = h)} refreshSessions={async () => undefined} requestGateway={requestGateway} />)

    await handle!.editMessage({
      role: 'user',
      sourceId: 'u1',
      content: [{ type: 'text', text: 'new text' }]
    })

    expect(requestGateway).not.toHaveBeenCalledWith('prompt.submit', expect.anything())
  })

  it('still allows editing and resending a failed assistant turn', async () => {
    setBusy(false)
    setMessages([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'old text' }] },
      { id: 'a1', role: 'assistant', error: 'gateway failed', parts: [{ type: 'text', text: 'failed' }] }
    ])

    const requestGateway = vi.fn(async () => ({}) as never)
    let handle: HarnessHandle | null = null

    render(<Harness onReady={h => (handle = h)} refreshSessions={async () => undefined} requestGateway={requestGateway} />)

    await handle!.editMessage({
      role: 'user',
      sourceId: 'u1',
      content: [{ type: 'text', text: 'new text' }]
    })

    expect(requestGateway).toHaveBeenCalledWith('prompt.submit', {
      session_id: RUNTIME_SESSION_ID,
      text: 'new text'
    })
  })
})

describe('usePromptActions submit / queue drain semantics', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    setCurrentModel('')
    setCurrentProvider('')
    vi.restoreAllMocks()
  })

  it('clears a leftover interrupted flag on a fresh submit', async () => {
    const seeds: Record<string, unknown>[] = []
    const requestGateway = vi.fn(async () => ({}) as never)

    let handle: HarnessHandle | null = null
    render(
      <Harness
        onReady={h => (handle = h)}
        onSeedState={s => seeds.push(s)}
        refreshSessions={async () => undefined}
        requestGateway={requestGateway}
      />
    )

    await handle!.submitText('hello after a stop')

    expect(seeds.length).toBeGreaterThan(0)
    expect(seeds.every(s => s.interrupted === false)).toBe(true)
    expect(requestGateway).toHaveBeenCalledWith('prompt.submit', {
      session_id: RUNTIME_SESSION_ID,
      text: 'hello after a stop'
    })
  })

  it('a fromQueue drain sends even when busyRef is still true on the settle edge', async () => {
    const busyRef = { current: true }
    const requestGateway = vi.fn(async () => ({}) as never)

    let handle: HarnessHandle | null = null
    render(
      <Harness
        busyRef={busyRef}
        onReady={h => (handle = h)}
        refreshSessions={async () => undefined}
        requestGateway={requestGateway}
      />
    )

    const accepted = await handle!.submitText('queued message', { fromQueue: true })

    expect(accepted).toBe(true)
    expect(requestGateway).toHaveBeenCalledWith('prompt.submit', {
      session_id: RUNTIME_SESSION_ID,
      text: 'queued message'
    })
  })

  it('a normal submit still respects the busyRef guard', async () => {
    const busyRef = { current: true }
    const requestGateway = vi.fn(async () => ({}) as never)

    let handle: HarnessHandle | null = null
    render(
      <Harness
        busyRef={busyRef}
        onReady={h => (handle = h)}
        refreshSessions={async () => undefined}
        requestGateway={requestGateway}
      />
    )

    const accepted = await handle!.submitText('should be blocked')

    expect(accepted).toBe(false)
    expect(requestGateway).not.toHaveBeenCalledWith('prompt.submit', expect.anything())
  })

  it('retries a transient backend session busy error during prompt submit', async () => {
    vi.useFakeTimers()

    const requestGateway = vi.fn(async (method: string) => {
      if (method !== 'prompt.submit') {
        return {} as never
      }

      const promptSubmitCalls = requestGateway.mock.calls.filter(call => call[0] === 'prompt.submit').length

      if (promptSubmitCalls === 1) {
        throw new Error('session busy')
      }

      return {} as never
    })

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={async () => undefined} requestGateway={requestGateway} />)

    const pending = handle!.submitText('retry me')
    await vi.advanceTimersByTimeAsync(300)
    const accepted = await pending

    expect(accepted).toBe(true)
    expect(requestGateway.mock.calls.filter(call => call[0] === 'prompt.submit')).toHaveLength(2)
  })

  it('keeps the sidebar session row when a local fast-lane reply bypasses gateway persistence', async () => {
    const hermes = await import('@/hermes')
    vi.mocked(hermes.getHermesConfigRecord).mockResolvedValueOnce({
      providers: {
        'ollama-local': {
          base_url: 'http://127.0.0.1:11434/v1',
          runtime: 'ollama',
          source: 'local'
        }
      }
    })

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        localChat: vi.fn(async () => ({ text: '你好，我在。' }))
      }
    })

    setCurrentProvider('ollama-local')
    setCurrentModel('gemma4')
    setSessions(() => [
      sessionInfo({
        message_count: 0,
        preview: null,
        title: null
      })
    ])

    const requestGateway = vi.fn(async () => ({}) as never)
    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={async () => undefined} requestGateway={requestGateway} />)

    const accepted = await handle!.submitText('你好')

    expect(accepted).toBe(true)
    expect(requestGateway).not.toHaveBeenCalledWith('prompt.submit', expect.anything())
    expect(window.hermesDesktop.localChat).toHaveBeenCalled()
    expect($sessions.get()[0]).toMatchObject({
      id: RUNTIME_SESSION_ID,
      message_count: 2,
      preview: '你好',
      title: '你好'
    })

    delete (window as typeof window & { hermesDesktop?: unknown }).hermesDesktop
  })

  it('streams local fast-lane chunks into the active assistant message', async () => {
    const hermes = await import('@/hermes')
    vi.mocked(hermes.getHermesConfigRecord).mockResolvedValueOnce({
      providers: {
        'ollama-local': {
          base_url: 'http://127.0.0.1:11434/v1',
          runtime: 'ollama',
          source: 'local'
        }
      }
    })

    const states: Record<string, unknown>[] = []
    const localChat = vi.fn(async () => ({ text: 'fallback' }))
    const localChatStream = vi.fn(async (_request, onDelta: (delta: string) => void) => {
      onDelta('你好')
      onDelta('，我在。')

      return { text: '你好，我在。' }
    })

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        localChat,
        localChatStream
      }
    })

    setCurrentProvider('ollama-local')
    setCurrentModel('gemma4')
    setSessions(() => [sessionInfo({ message_count: 0, preview: null, title: null })])

    const requestGateway = vi.fn(async () => ({}) as never)
    let handle: HarnessHandle | null = null
    render(
      <Harness
        onReady={h => (handle = h)}
        onSeedState={state => states.push(state)}
        refreshSessions={async () => undefined}
        requestGateway={requestGateway}
      />
    )

    const accepted = await handle!.submitText('你好')
    const finalState = states.at(-1) as { messages?: Array<{ role: string; parts?: Array<{ text?: string }> }> }
    const assistant = finalState.messages?.find(message => message.role === 'assistant')

    expect(accepted).toBe(true)
    expect(localChatStream).toHaveBeenCalled()
    expect(localChat).not.toHaveBeenCalled()
    expect(requestGateway).not.toHaveBeenCalledWith('prompt.submit', expect.anything())
    expect(assistant?.parts?.[0]?.text).toBe('你好，我在。')

    delete (window as typeof window & { hermesDesktop?: unknown }).hermesDesktop
  })

  it('falls back to non-streaming local chat without keeping partial stream text', async () => {
    const hermes = await import('@/hermes')
    vi.mocked(hermes.getHermesConfigRecord).mockResolvedValueOnce({
      providers: {
        'ollama-local': {
          base_url: 'http://127.0.0.1:11434/v1',
          runtime: 'ollama',
          source: 'local'
        }
      }
    })

    const states: Record<string, unknown>[] = []
    const localChat = vi.fn(async () => ({ text: '完整回复' }))
    const localChatStream = vi.fn(async (_request, onDelta: (delta: string) => void) => {
      onDelta('半截')
      throw new Error('stream dropped')
    })

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        localChat,
        localChatStream
      }
    })

    setCurrentProvider('ollama-local')
    setCurrentModel('gemma4')

    const requestGateway = vi.fn(async () => ({}) as never)
    let handle: HarnessHandle | null = null
    render(
      <Harness
        onReady={h => (handle = h)}
        onSeedState={state => states.push(state)}
        refreshSessions={async () => undefined}
        requestGateway={requestGateway}
      />
    )

    const accepted = await handle!.submitText('你好')
    const finalState = states.at(-1) as { messages?: Array<{ role: string; parts?: Array<{ text?: string }> }> }
    const assistantMessages = finalState.messages?.filter(message => message.role === 'assistant') ?? []

    expect(accepted).toBe(true)
    expect(localChatStream).toHaveBeenCalled()
    expect(localChat).toHaveBeenCalled()
    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0]?.parts?.[0]?.text).toBe('完整回复')

    delete (window as typeof window & { hermesDesktop?: unknown }).hermesDesktop
  })
})

describe('usePromptActions steerPrompt', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('injects trimmed text via session.steer and reports acceptance', async () => {
    const requestGateway = vi.fn(async () => ({ status: 'queued' }) as never)

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={async () => undefined} requestGateway={requestGateway} />)

    expect(await handle!.steerPrompt('  nudge the run  ')).toBe(true)
    expect(requestGateway).toHaveBeenCalledWith('session.steer', {
      session_id: RUNTIME_SESSION_ID,
      text: 'nudge the run'
    })
    expect(requestGateway).not.toHaveBeenCalledWith('prompt.submit', expect.anything())
  })

  it('reports rejection when the gateway has no live tool window', async () => {
    const requestGateway = vi.fn(async () => ({ status: 'rejected' }) as never)

    let handle: HarnessHandle | null = null
    render(<Harness onReady={h => (handle = h)} refreshSessions={async () => undefined} requestGateway={requestGateway} />)

    expect(await handle!.steerPrompt('too late')).toBe(false)
  })
})

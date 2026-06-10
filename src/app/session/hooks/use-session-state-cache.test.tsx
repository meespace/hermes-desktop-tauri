// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $turnStartedAt, setTurnStartedAt } from '@/store/session'

import { useSessionStateCache } from './use-session-state-cache'

type Cache = ReturnType<typeof useSessionStateCache>

function Harness({
  activeSessionId,
  onReady,
  selectedStoredSessionId
}: {
  activeSessionId: string | null
  onReady: (cache: Cache) => void
  selectedStoredSessionId: string | null
}) {
  const busyRef: MutableRefObject<boolean> = { current: false }
  const cache = useSessionStateCache({
    activeSessionId,
    busyRef,
    selectedStoredSessionId,
    setAwaitingResponse: () => undefined,
    setBusy: () => undefined,
    setMessages: () => undefined
  })

  onReady(cache)

  return null
}

describe('useSessionStateCache — per-session turn timer', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0)

      return null as unknown as number
    })
    setTurnStartedAt(null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    setTurnStartedAt(null)
  })

  it("keeps a background session's running turn clock and never mirrors it to the view", () => {
    let cache!: Cache
    render(<Harness activeSessionId="fg-runtime" onReady={c => (cache = c)} selectedStoredSessionId="fg-stored" />)

    const startedAt = 1_700_000_000_000

    act(() => {
      cache.updateSessionState(
        'bg-runtime',
        state => ({ ...state, busy: true, turnStartedAt: startedAt }),
        'bg-stored'
      )
    })

    expect(cache.sessionStateByRuntimeIdRef.current.get('bg-runtime')?.turnStartedAt).toBe(startedAt)
    expect($turnStartedAt.get()).toBeNull()
  })

  it("mirrors the focused session's turn clock into the global atom on view-sync", () => {
    let cache!: Cache
    render(<Harness activeSessionId="fg-runtime" onReady={c => (cache = c)} selectedStoredSessionId="fg-stored" />)

    const startedAt = 1_700_000_111_000

    act(() => {
      cache.updateSessionState(
        'fg-runtime',
        state => ({ ...state, busy: true, turnStartedAt: startedAt }),
        'fg-stored'
      )
    })

    expect($turnStartedAt.get()).toBe(startedAt)
  })

  it('clears the global clock when the focused turn ends', () => {
    let cache!: Cache
    render(<Harness activeSessionId="fg-runtime" onReady={c => (cache = c)} selectedStoredSessionId="fg-stored" />)

    act(() => {
      cache.updateSessionState(
        'fg-runtime',
        state => ({ ...state, busy: true, turnStartedAt: 1_700_000_222_000 }),
        'fg-stored'
      )
    })
    expect($turnStartedAt.get()).toBe(1_700_000_222_000)

    act(() => {
      cache.updateSessionState('fg-runtime', state => ({ ...state, busy: false, turnStartedAt: null }))
    })
    expect($turnStartedAt.get()).toBeNull()
  })
})

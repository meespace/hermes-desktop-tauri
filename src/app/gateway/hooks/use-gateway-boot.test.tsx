// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $desktopBoot } from '@/store/boot'
import { $gatewayState } from '@/store/session'

import { useGatewayBoot } from './use-gateway-boot'

type Listener = (ev: unknown) => void

class FakeWebSocket {
  static OPEN = 1
  static CLOSED = 3
  static mode: 'fail' | 'open' = 'open'
  static instances: FakeWebSocket[] = []

  readyState = 0
  private listeners: Record<string, Set<Listener>> = {}

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
    const willOpen = FakeWebSocket.mode === 'open'
    setTimeout(() => {
      if (willOpen) {
        this.readyState = FakeWebSocket.OPEN
        this.emit('open', {})
      } else {
        this.readyState = FakeWebSocket.CLOSED
        this.emit('error', {})
      }
    }, 0)
  }

  addEventListener(type: string, fn: Listener) {
    ;(this.listeners[type] ??= new Set()).add(fn)
  }

  removeEventListener(type: string, fn: Listener) {
    this.listeners[type]?.delete(fn)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', {})
  }

  drop() {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', {})
  }

  private emit(type: string, ev: unknown) {
    for (const fn of this.listeners[type] ?? []) {
      fn(ev)
    }
  }
}

function fakeDesktop() {
  const conn = {
    authMode: 'token' as const,
    baseUrl: 'https://vps.example.com',
    profile: 'default',
    token: 't',
    wsUrl: 'wss://vps.example.com/api/ws?token=t'
  }

  return {
    getConnection: vi.fn(async () => conn),
    getGatewayWsUrl: vi.fn(async () => conn.wsUrl),
    getBootProgress: vi.fn(async () => ({
      error: null,
      fakeMode: false,
      message: '',
      phase: 'init',
      progress: 0,
      running: true,
      timestamp: Date.now()
    })),
    onBootProgress: vi.fn(() => () => undefined),
    onBackendExit: vi.fn(() => () => undefined),
    onPowerResume: vi.fn(() => () => undefined),
    onWindowStateChanged: vi.fn(() => () => undefined),
    touchBackend: vi.fn(async () => undefined),
    profile: { get: vi.fn(async () => ({ profile: 'default' })) }
  }
}

function Harness() {
  useGatewayBoot({
    handleGatewayEvent: () => undefined,
    onConnectionReady: () => undefined,
    onGatewayReady: () => undefined,
    refreshHermesConfig: async () => undefined,
    refreshSessions: async () => undefined
  })

  return null
}

const originalWebSocket = globalThis.WebSocket

beforeEach(() => {
  vi.useFakeTimers()
  FakeWebSocket.mode = 'open'
  FakeWebSocket.instances = []
  ;(globalThis as { WebSocket: unknown }).WebSocket = FakeWebSocket
  ;(window as { hermesDesktop?: unknown }).hermesDesktop = fakeDesktop()
  $gatewayState.set('idle')
  $desktopBoot.set({
    error: null,
    fakeMode: false,
    message: '',
    phase: 'init',
    progress: 0,
    running: true,
    timestamp: Date.now(),
    visible: true
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  ;(globalThis as { WebSocket: unknown }).WebSocket = originalWebSocket
  delete (window as { hermesDesktop?: unknown }).hermesDesktop
})

async function flushAsync() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

async function advanceBackoff() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000)
  })
}

describe('useGatewayBoot remote reconnect loop', () => {
  it('does not fail desktop boot immediately when the first gateway dial fails after connection info is ready', async () => {
    render(<Harness />)
    FakeWebSocket.mode = 'fail'

    await flushAsync()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect($gatewayState.get()).not.toBe('open')
    expect($desktopBoot.get().error).toBeNull()

    FakeWebSocket.mode = 'open'
    await advanceBackoff()

    expect($gatewayState.get()).toBe('open')
    expect($desktopBoot.get().error).toBeNull()
  })

  it('initial boot against a dead VPS stays connecting until getConnection fails, then surfaces boot error', async () => {
    let rejectConn: (e: Error) => void = () => undefined
    const desktop = fakeDesktop()
    desktop.getConnection = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectConn = reject
        })
    )
    ;(window as { hermesDesktop?: unknown }).hermesDesktop = desktop

    render(<Harness />)
    await flushAsync()

    expect(FakeWebSocket.instances).toHaveLength(0)
    expect($gatewayState.get()).not.toBe('open')
    expect($desktopBoot.get().error).toBeNull()

    await act(async () => {
      rejectConn(new Error('Hermes backend did not become ready: timeout'))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect($desktopBoot.get().error).toBeTruthy()
  })

  it('a remote that drops post-boot retries without immediately surfacing boot error', async () => {
    render(<Harness />)
    await flushAsync()

    expect($gatewayState.get()).toBe('open')
    expect($desktopBoot.get().error).toBeNull()
    expect(FakeWebSocket.instances).toHaveLength(1)

    FakeWebSocket.mode = 'fail'
    act(() => FakeWebSocket.instances[0].drop())
    await flushAsync()
    await advanceBackoff()

    expect($gatewayState.get()).not.toBe('open')
    expect($desktopBoot.get().error).toBeNull()
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1)
  })

  it('after a prolonged drop the hook raises a recoverable boot error', async () => {
    render(<Harness />)
    await flushAsync()

    FakeWebSocket.mode = 'fail'
    act(() => FakeWebSocket.instances[0].drop())
    await flushAsync()

    for (let i = 0; i < 8; i += 1) {
      await advanceBackoff()
    }

    expect($desktopBoot.get().error).toBeTruthy()
  })

  it('a successful reconnect clears the recoverable error', async () => {
    render(<Harness />)
    await flushAsync()

    FakeWebSocket.mode = 'fail'
    act(() => FakeWebSocket.instances[0].drop())
    await flushAsync()
    for (let i = 0; i < 8; i += 1) {
      await advanceBackoff()
    }
    expect($desktopBoot.get().error).toBeTruthy()

    FakeWebSocket.mode = 'open'
    await advanceBackoff()

    expect($gatewayState.get()).toBe('open')
    expect($desktopBoot.get().error).toBeNull()
  })
})

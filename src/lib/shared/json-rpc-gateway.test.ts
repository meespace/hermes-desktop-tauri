import { describe, expect, it } from 'vitest'

import { JsonRpcGatewayClient } from '@/lib/shared/json-rpc-gateway'

type Listener = (...args: any[]) => void

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.CONNECTING
  private listeners = new Map<string, Set<Listener>>()

  addEventListener(type: string, listener: Listener, options?: { once?: boolean }) {
    const wrapped = options?.once
      ? ((...args: any[]) => {
          this.removeEventListener(type, wrapped)
          listener(...args)
        }) as Listener
      : listener

    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }

    this.listeners.get(type)?.add(wrapped)
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', { code: 1006, reason: '', wasClean: false })
  }

  send() {}

  emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

function settleWithin<T>(promise: Promise<T>, ms = 60) {
  return Promise.race([
    promise.then(
      value => ({ kind: 'resolved' as const, value }),
      error => ({ kind: 'rejected' as const, error })
    ),
    new Promise<{ kind: 'timeout' }>(resolve => setTimeout(() => resolve({ kind: 'timeout' }), ms))
  ])
}

describe('JsonRpcGatewayClient.connect', () => {
  it('supports an async socket factory', async () => {
    const socket = new FakeWebSocket()
    const client = new JsonRpcGatewayClient({
      socketFactory: async () => {
        queueMicrotask(() => {
          socket.readyState = FakeWebSocket.OPEN
          socket.emit('open')
        })
        return socket as unknown as WebSocket
      }
    })

    await expect(client.connect('ws://127.0.0.1:9122/api/ws?token=test')).resolves.toBeUndefined()
    expect(client.connectionState).toBe('open')
  })

  it('rejects when the socket closes before opening', async () => {
    const socket = new FakeWebSocket()
    const client = new JsonRpcGatewayClient({
      socketFactory: () => socket as unknown as WebSocket
    })

    const pending = client.connect('ws://127.0.0.1:9122/api/ws?token=test')
    socket.emit('close', { code: 1006, reason: 'closed', wasClean: false })

    const outcome = await settleWithin(pending)

    expect(outcome.kind).toBe('rejected')
  })

  it('times out a hung websocket connect attempt', async () => {
    const socket = new FakeWebSocket()
    const client = new JsonRpcGatewayClient({
      socketFactory: () => socket as unknown as WebSocket,
      connectTimeoutMs: 25
    } as ConstructorParameters<typeof JsonRpcGatewayClient>[0])

    const outcome = await settleWithin(client.connect('ws://127.0.0.1:9122/api/ws?token=test'), 80)

    expect(outcome).toMatchObject({ kind: 'rejected' })
  })
})

import { describe, expect, it, vi } from 'vitest'

import { createTauriWebSocketAdapter } from '@/lib/tauri-websocket'

type PluginMessage =
  | { type: 'Binary'; data: number[] }
  | { type: 'Close'; data: { code: number; reason: string } | null }
  | { type: 'Ping'; data: number[] }
  | { type: 'Pong'; data: number[] }
  | { type: 'Text'; data: string }

class FakePluginSocket {
  readonly send = vi.fn(async (_message: string) => undefined)
  readonly disconnect = vi.fn(async () => undefined)
  private readonly listeners = new Set<(message: PluginMessage) => void>()

  addListener(cb: (message: PluginMessage) => void) {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  emit(message: PluginMessage) {
    for (const listener of this.listeners) {
      listener(message)
    }
  }
}

function flushMicrotasks() {
  return new Promise<void>(resolve => queueMicrotask(resolve))
}

describe('createTauriWebSocketAdapter', () => {
  it('adapts plugin lifecycle and messages into browser websocket events', async () => {
    const pluginSocket = new FakePluginSocket()
    const socket = createTauriWebSocketAdapter(pluginSocket)
    const openListener = vi.fn()
    const messageListener = vi.fn()
    const closeListener = vi.fn()

    socket.addEventListener('open', openListener)
    socket.addEventListener('message', messageListener)
    socket.addEventListener('close', closeListener)

    await flushMicrotasks()

    expect(socket.readyState).toBe(WebSocket.OPEN)
    expect(openListener).toHaveBeenCalledTimes(1)

    socket.send('{"jsonrpc":"2.0"}')
    expect(pluginSocket.send).toHaveBeenCalledWith('{"jsonrpc":"2.0"}')

    pluginSocket.emit({ type: 'Text', data: '{"ok":true}' })
    expect(messageListener).toHaveBeenCalledTimes(1)
    expect(messageListener.mock.calls[0]?.[0]?.data).toBe('{"ok":true}')

    socket.close()
    await flushMicrotasks()
    await Promise.resolve()

    expect(pluginSocket.disconnect).toHaveBeenCalledTimes(1)
    expect(socket.readyState).toBe(WebSocket.CLOSED)
    expect(closeListener).toHaveBeenCalledTimes(1)
    expect(closeListener.mock.calls[0]?.[0]?.code).toBe(1000)
  })

  it('decodes utf-8 binary messages into websocket text events', async () => {
    const pluginSocket = new FakePluginSocket()
    const socket = createTauriWebSocketAdapter(pluginSocket)
    const messageListener = vi.fn()

    socket.addEventListener('message', messageListener)
    await flushMicrotasks()

    const payload = '{"jsonrpc":"2.0","method":"event","params":{"type":"message.delta","payload":{"text":"您好"}}}'
    pluginSocket.emit({ type: 'Binary', data: Array.from(new TextEncoder().encode(payload)) })

    expect(messageListener).toHaveBeenCalledTimes(1)
    expect(messageListener.mock.calls[0]?.[0]?.data).toBe(payload)
  })
})

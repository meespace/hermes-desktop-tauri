type PluginSocketMessage =
  | { type: 'Binary'; data: number[] }
  | { type: 'Close'; data: { code: number; reason: string } | null }
  | { type: 'Ping'; data: number[] }
  | { type: 'Pong'; data: number[] }
  | { type: 'Text'; data: string }

export type PluginSocketLike = {
  addListener: (cb: (message: PluginSocketMessage) => void) => () => void
  disconnect: () => Promise<void>
  send: (message: string) => Promise<void>
}

const utf8Decoder = new TextDecoder()

const WS_CONNECTING = 0
const WS_OPEN = 1
const WS_CLOSING = 2
const WS_CLOSED = 3
type ReadyState = typeof WS_CONNECTING | typeof WS_OPEN | typeof WS_CLOSING | typeof WS_CLOSED

export function isTauriRuntime() {
  try {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  } catch {
    return false
  }
}

class TauriPluginWebSocketAdapter {
  readyState: ReadyState = WS_CONNECTING

  private readonly target = new EventTarget()
  private readonly detachPluginListener: () => void

  constructor(private readonly pluginSocket: PluginSocketLike) {
    this.detachPluginListener = pluginSocket.addListener(message => {
      this.handlePluginMessage(message)
    })

    queueMicrotask(() => {
      if (this.readyState !== WS_CONNECTING) {
        return
      }

      this.readyState = WS_OPEN
      this.target.dispatchEvent(new Event('open'))
    })
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (!listener) {
      return
    }

    this.target.addEventListener(type, listener, options)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ) {
    if (!listener) {
      return
    }

    this.target.removeEventListener(type, listener, options)
  }

  send(data: string) {
    if (this.readyState !== WS_OPEN) {
      throw new Error('socket is not open')
    }

    void this.pluginSocket.send(data).catch(error => {
      this.target.dispatchEvent(new Event('error'))
      this.finalizeClose(1011, error instanceof Error ? error.message : String(error))
    })
  }

  close() {
    if (this.readyState === WS_CLOSING || this.readyState === WS_CLOSED) {
      return
    }

    this.readyState = WS_CLOSING
    void this.pluginSocket
      .disconnect()
      .catch(() => undefined)
      .finally(() => {
        this.finalizeClose(1000, 'Disconnected by client')
      })
  }

  private handlePluginMessage(message: PluginSocketMessage) {
    switch (message.type) {
      case 'Text':
        this.target.dispatchEvent(new MessageEvent('message', { data: message.data }))
        break
      case 'Binary':
        this.target.dispatchEvent(new MessageEvent('message', { data: utf8Decoder.decode(new Uint8Array(message.data)) }))
        break
      case 'Close':
        this.finalizeClose(message.data?.code ?? 1000, message.data?.reason ?? '')
        break
      default:
        break
    }
  }

  private finalizeClose(code: number, reason: string) {
    if (this.readyState === WS_CLOSED) {
      return
    }

    this.readyState = WS_CLOSED
    this.detachPluginListener()
    this.target.dispatchEvent(new CloseEvent('close', { code, reason }))
  }
}

export function createTauriWebSocketAdapter(pluginSocket: PluginSocketLike): WebSocket {
  return new TauriPluginWebSocketAdapter(pluginSocket) as unknown as WebSocket
}

export async function createTauriWebSocket(url: string): Promise<WebSocket> {
  const { default: TauriWebSocket } = await import('@tauri-apps/plugin-websocket')
  const pluginSocket = await TauriWebSocket.connect(url)
  return createTauriWebSocketAdapter(pluginSocket as PluginSocketLike)
}

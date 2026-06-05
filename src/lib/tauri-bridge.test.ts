import { afterEach, describe, expect, it, vi } from 'vitest'

const savedWindow = globalThis.window
const browserStore = new Map<string, string>()

function installBrowserWindow() {
  globalThis.window = {
    addEventListener: vi.fn(),
    location: {
      href: 'http://127.0.0.1:4173/',
      host: '127.0.0.1:4173',
      hostname: '127.0.0.1',
      protocol: 'http:',
    },
    navigator: {
      mediaDevices: {
        getUserMedia: vi.fn()
      }
    },
    localStorage: {
      getItem: key => browserStore.get(key) ?? null,
      setItem: (key, value) => void browserStore.set(key, value),
      removeItem: key => void browserStore.delete(key),
    },
    removeEventListener: vi.fn(),
  } as typeof window
}

afterEach(() => {
  if (savedWindow === undefined) {
    delete globalThis.window
  } else {
    globalThis.window = savedWindow
  }
  browserStore.clear()
  vi.resetModules()
})

describe('getBrowserGatewayWsUrl', () => {
  it('uses the browser proxy websocket endpoint for local preview', async () => {
    installBrowserWindow()

    const { getBrowserGatewayWsUrl } = await import('./tauri-bridge')
    const url = getBrowserGatewayWsUrl()

    expect(url).toBe(
      'ws://127.0.0.1:4173/__hermes_gateway_proxy__/api/ws?token='
    )
  })
})

describe('browser bridge fallbacks', () => {
  it('exposes desktop-like settings and image storage', async () => {
    installBrowserWindow()

    const bridgeModule = await import('./tauri-bridge')
    const bridge = window.hermesDesktop

    expect(bridge.settings).toBeDefined()
    expect(await bridge.settings.getDefaultProjectDir()).toEqual({
      defaultLabel: '~/hermes-projects',
      dir: null
    })

    const saved = await bridge.saveImageBuffer(new Uint8Array([137, 80, 78, 71]), '.png')
    expect(saved).toMatch(/^browser:\/composer-images\//)
    expect(await bridge.readFileDataUrl(saved)).toMatch(/^data:image\/png;base64,/)

    void bridgeModule
  })

  it('requests browser microphone access when available', async () => {
    installBrowserWindow()
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop: vi.fn() }]
    }))
    ;(window.navigator.mediaDevices.getUserMedia as unknown as typeof getUserMedia) = getUserMedia

    const { requestMicrophoneAccess } = await import('./tauri-bridge')
    await expect(window.hermesDesktop.requestMicrophoneAccess()).resolves.toBe(true)
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  })

  it('does not treat missing microphone devices as a permission denial', async () => {
    installBrowserWindow()
    const getUserMedia = vi.fn(async () => {
      const error = new Error('No microphone')
      error.name = 'NotFoundError'
      throw error
    })
    ;(window.navigator.mediaDevices.getUserMedia as unknown as typeof getUserMedia) = getUserMedia

    await import('./tauri-bridge')
    await expect(window.hermesDesktop.requestMicrophoneAccess()).resolves.toBe(true)
  })

  it('returns false when the browser explicitly denies microphone permission', async () => {
    installBrowserWindow()
    const getUserMedia = vi.fn(async () => {
      const error = new Error('Denied')
      error.name = 'NotAllowedError'
      throw error
    })
    ;(window.navigator.mediaDevices.getUserMedia as unknown as typeof getUserMedia) = getUserMedia

    await import('./tauri-bridge')
    await expect(window.hermesDesktop.requestMicrophoneAccess()).resolves.toBe(false)
  })

  it('uses the browser notification API when available', async () => {
    installBrowserWindow()
    const notificationCtor = vi.fn()
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(notificationCtor, { permission: 'granted' })
    })

    await import('./tauri-bridge')
    await expect(window.hermesDesktop.notify({ body: 'Body', title: 'Title' })).resolves.toBe(true)
    expect(notificationCtor).toHaveBeenCalledWith('Title', {
      body: 'Body',
      silent: false
    })
  })

  it('returns false when the tauri notification fallback reports unsupported', async () => {
    installBrowserWindow()
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    })

    const notificationCtor = vi.fn()
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Object.assign(notificationCtor, { permission: 'denied' })
    })

    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'notify') {
        return false
      }

      return undefined
    })

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke
    }))
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async () => () => {})
    }))

    await import('./tauri-bridge')

    await expect(window.hermesDesktop.notify({ body: 'Body', title: 'Title' })).resolves.toBe(false)
    expect(notificationCtor).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledWith('notify', {
      body: 'Body',
      silent: false,
      title: 'Title'
    })
  })

  it('forwards desktop update apply options to tauri', async () => {
    installBrowserWindow()
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    })

    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'apply_updates') {
        return { ok: true }
      }

      return undefined
    })

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke
    }))
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async () => () => {})
    }))

    await import('./tauri-bridge')

    await expect(window.hermesDesktop.updates.apply({ dirtyStrategy: 'stash' })).resolves.toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('apply_updates', {
      opts: { dirtyStrategy: 'stash' }
    })
  })

  it('unwraps structured link-title responses to the string title', async () => {
    installBrowserWindow()
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    })

    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'fetch_link_title') {
        return {
          ok: true,
          title: 'Structured Title'
        }
      }

      return undefined
    })

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke
    }))
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async () => () => {})
    }))

    await import('./tauri-bridge')

    await expect(window.hermesDesktop.fetchLinkTitle('https://example.com')).resolves.toBe('Structured Title')
  })

  it('subscribes update progress listeners in tauri mode', async () => {
    installBrowserWindow()
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {}
    })

    const unlisten = vi.fn()
    const listenMock = vi.fn(async (_event: string, handler: (event: { payload: unknown }) => void) => {
      handler({
        payload: {
          at: 1,
          error: null,
          message: 'Downloading update',
          percent: 50,
          stage: 'fetch'
        }
      })
      return unlisten
    })

    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async () => undefined)
    }))
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: listenMock
    }))

    await import('./tauri-bridge')

    const callback = vi.fn()
    const dispose = window.hermesDesktop.updates.onProgress(callback)

    await Promise.resolve()
    await Promise.resolve()

    expect(listenMock).toHaveBeenCalledWith('hermes:updates:progress', expect.any(Function))
    expect(callback).toHaveBeenCalledWith({
      at: 1,
      error: null,
      message: 'Downloading update',
      percent: 50,
      stage: 'fetch'
    })

    dispose()

    expect(unlisten).toHaveBeenCalledTimes(1)
  })
})

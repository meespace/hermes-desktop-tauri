import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopUpdateStatus } from '@/global'

const checkSpy = vi.fn<() => Promise<DesktopUpdateStatus>>()
const getVersionSpy = vi.fn()
const onProgressSpy = vi.fn(() => vi.fn())

const updatesModule = await import('./updates')
const { $desktopVersion, $updateStatus, checkUpdates, startUpdatePoller, stopUpdatePoller } = updatesModule

const status = (over: Partial<DesktopUpdateStatus> = {}): DesktopUpdateStatus => ({
  supported: true,
  behind: 3,
  targetSha: 'sha-a',
  fetchedAt: 0,
  ...over
})

describe('manual update flow', () => {
  beforeEach(() => {
    checkSpy.mockReset()
    checkSpy.mockResolvedValue(status())
    getVersionSpy.mockReset()
    getVersionSpy.mockResolvedValue({
      appVersion: '0.1.0',
      electronVersion: 'tauri',
      hermesRoot: '/tmp/hermes',
      nodeVersion: 'rust',
      platform: 'darwin'
    })
    onProgressSpy.mockClear()
    $desktopVersion.set(null)
    $updateStatus.set(null)

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        hermesDesktop: {
          getVersion: getVersionSpy,
          updates: {
            apply: vi.fn(),
            check: checkSpy,
            getBranch: vi.fn(),
            onProgress: onProgressSpy,
            setBranch: vi.fn()
          }
        }
      }
    })
  })

  afterEach(() => {
    stopUpdatePoller()
  })

  it('does not auto-check when the update bridge starts', async () => {
    startUpdatePoller()
    await Promise.resolve()
    await Promise.resolve()

    expect(checkSpy).not.toHaveBeenCalled()
    expect(onProgressSpy).toHaveBeenCalledTimes(1)
    expect(getVersionSpy).toHaveBeenCalledTimes(1)
  })

  it('checks only when explicitly asked', async () => {
    const next = await checkUpdates()

    expect(checkSpy).toHaveBeenCalledTimes(1)
    expect(next?.behind).toBe(3)
    expect($updateStatus.get()?.behind).toBe(3)
  })
})

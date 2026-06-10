// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const cancelBootstrap = vi.fn()
const getBootstrapState = vi.fn()
const getRecentLogs = vi.fn()
const onBootstrapEvent = vi.fn(() => undefined)
const openExternal = vi.fn()
const resetBootstrap = vi.fn()
const revealLogs = vi.fn()
const writeText = vi.fn()
const reloadSpy = vi.fn()

describe('DesktopInstallOverlay', () => {
  beforeEach(() => {
    cancelBootstrap.mockReset()
    cancelBootstrap.mockResolvedValue({ cancelled: true, ok: true })
    getBootstrapState.mockReset()
    getRecentLogs.mockReset()
    getRecentLogs.mockResolvedValue({ lines: ['bootstrap log\n'], path: '/Users/demo/.hermes/logs/desktop.log' })
    onBootstrapEvent.mockReset()
    onBootstrapEvent.mockReturnValue(() => undefined)
    openExternal.mockReset()
    openExternal.mockResolvedValue(undefined)
    resetBootstrap.mockReset()
    resetBootstrap.mockResolvedValue({ ok: true })
    revealLogs.mockReset()
    revealLogs.mockResolvedValue({ ok: true, path: '/Users/demo/.hermes/logs/desktop.log' })
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        cancelBootstrap,
        getBootstrapState,
        getRecentLogs,
        onBootstrapEvent,
        openExternal,
        resetBootstrap,
        revealLogs
      }
    })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy }
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText
      }
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows the packaged install failure state with the real log path and log actions', async () => {
    getBootstrapState.mockResolvedValue({
      active: false,
      completedAt: Date.now(),
      error: 'Install failed',
      log: [{ line: 'bootstrap log', stage: 'deps', ts: Date.now() }],
      manifest: {
        protocolVersion: 1,
        stages: [{ name: 'deps' }],
        type: 'manifest'
      },
      startedAt: Date.now() - 1000,
      stages: {
        deps: { durationMs: 1000, error: 'boom', json: null, startedAt: Date.now() - 1000, state: 'failed' }
      },
      unsupportedPlatform: null
    })

    const { DesktopInstallOverlay } = await import('./desktop-install-overlay')
    render(<DesktopInstallOverlay />)

    expect(await screen.findByText('Installation failed')).toBeTruthy()
    expect(await screen.findByText('/Users/demo/.hermes/logs/desktop.log')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open logs' }))
    await waitFor(() => expect(revealLogs).toHaveBeenCalledTimes(1))
  })

  it('shows the unsupported-platform branch and opens install docs', async () => {
    getBootstrapState.mockResolvedValue({
      active: false,
      completedAt: null,
      error: null,
      log: [],
      manifest: null,
      startedAt: null,
      stages: {},
      unsupportedPlatform: {
        activeRoot: '/Users/demo/.hermes',
        docsUrl: 'https://example.com/install',
        installCommand: 'curl -fsSL https://example.com/install.sh | bash',
        platform: 'darwin'
      }
    })

    const { DesktopInstallOverlay } = await import('./desktop-install-overlay')
    render(<DesktopInstallOverlay />)

    const title = await screen.findByText('Hermes needs a one-time install')
    const intro = screen.getByText(/Hermes CLI was not found/i)
    const installLabel = screen.getByText('Install command')

    expect(title).toBeTruthy()
    expect(intro.className).toContain('text-[var(--muted)]')
    expect(installLabel.className).toContain('text-[var(--muted)]')
    fireEvent.click(screen.getByRole('button', { name: 'View install docs' }))

    await waitFor(() => expect(openExternal).toHaveBeenCalledWith('https://example.com/install'))
  })
})

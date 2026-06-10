// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $desktopBoot } from '@/store/boot'
import { $desktopOnboarding } from '@/store/onboarding'

const applyConnectionConfig = vi.fn()
const getBootstrapState = vi.fn()
const getConnectionConfig = vi.fn()
const getRecentLogs = vi.fn()
const oauthLoginConnectionConfig = vi.fn()
const onBootstrapEvent = vi.fn(() => undefined)
const probeConnectionConfig = vi.fn()
const repairBootstrap = vi.fn()
const resetBootstrap = vi.fn()
const revealLogs = vi.fn()
const reloadSpy = vi.fn()

describe('BootFailureOverlay', () => {
  beforeEach(() => {
    applyConnectionConfig.mockReset()
    applyConnectionConfig.mockResolvedValue({ mode: 'local' })
    getBootstrapState.mockReset()
    getBootstrapState.mockResolvedValue({
      active: false,
      completedAt: null,
      error: null,
      log: [],
      manifest: null,
      startedAt: null,
      stages: {},
      unsupportedPlatform: null
    })
    getConnectionConfig.mockReset()
    getConnectionConfig.mockResolvedValue({
      envOverride: false,
      mode: 'local',
      profile: null,
      remoteAuthMode: 'token',
      remoteOauthConnected: false,
      remoteTokenPreview: null,
      remoteTokenSet: false,
      remoteUrl: ''
    })
    getRecentLogs.mockReset()
    getRecentLogs.mockResolvedValue({ lines: ['line one\n', 'line two\n'], path: '/tmp/desktop.log' })
    oauthLoginConnectionConfig.mockReset()
    oauthLoginConnectionConfig.mockResolvedValue({ baseUrl: 'https://remote.example', connected: true, ok: true })
    onBootstrapEvent.mockReset()
    onBootstrapEvent.mockReturnValue(() => undefined)
    probeConnectionConfig.mockReset()
    probeConnectionConfig.mockResolvedValue({
      authMode: 'oauth',
      baseUrl: 'https://remote.example',
      error: null,
      providers: [],
      reachable: true,
      version: '1.0.0'
    })
    repairBootstrap.mockReset()
    repairBootstrap.mockResolvedValue({ ok: true })
    resetBootstrap.mockReset()
    resetBootstrap.mockResolvedValue({ ok: true })
    revealLogs.mockReset()
    revealLogs.mockResolvedValue({ ok: true, path: '/tmp/desktop.log' })

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        applyConnectionConfig,
        getBootstrapState,
        getConnectionConfig,
        getRecentLogs,
        oauthLoginConnectionConfig,
        onBootstrapEvent,
        probeConnectionConfig,
        repairBootstrap,
        resetBootstrap,
        revealLogs
      }
    })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy }
    })

    $desktopBoot.set({
      error: 'gateway failed to start',
      fakeMode: false,
      message: 'Desktop boot failed',
      phase: 'renderer.error',
      progress: 80,
      running: false,
      timestamp: Date.now(),
      visible: true
    })
    $desktopOnboarding.set({
      configured: false,
      flow: { status: 'idle' },
      manual: false,
      mode: 'oauth',
      providers: null,
      reason: null,
      requested: false,
      firstRunSkipped: false
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders recovery actions and expands recent logs', async () => {
    const { BootFailureOverlay } = await import('./boot-failure-overlay')
    render(<BootFailureOverlay />)

    expect(await screen.findByText("Hermes couldn't start")).toBeTruthy()
    const repairHint = screen.getByText(/Repair re-runs the installer/i)
    const logToggle = screen.getByRole('button', { name: /show recent logs/i })

    expect(repairHint.className).toContain('text-[var(--muted)]')
    expect(logToggle.className).toContain('text-[var(--muted)]')

    fireEvent.click(logToggle)
    expect(await screen.findByText(/line one/)).toBeTruthy()
  })

  it('switches back to local gateway and reloads the app', async () => {
    const { BootFailureOverlay } = await import('./boot-failure-overlay')
    render(<BootFailureOverlay />)

    fireEvent.click(await screen.findByRole('button', { name: 'Use local gateway' }))

    await waitFor(() => expect(applyConnectionConfig).toHaveBeenCalledWith({ mode: 'local' }))
    expect(reloadSpy).toHaveBeenCalledTimes(0)
  })
})

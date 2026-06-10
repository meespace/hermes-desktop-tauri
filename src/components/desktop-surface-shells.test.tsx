// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $desktopBoot } from '@/store/boot'
import { $desktopOnboarding } from '@/store/onboarding'
import { $notifications } from '@/store/notifications'

const getBootstrapState = vi.fn()
const getRecentLogs = vi.fn()
const onBootstrapEvent = vi.fn(() => undefined)

describe('desktop surface shells', () => {
  beforeEach(() => {
    getBootstrapState.mockReset()
    getRecentLogs.mockReset()
    onBootstrapEvent.mockReset()
    onBootstrapEvent.mockReturnValue(() => undefined)

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        getBootstrapState,
        getRecentLogs,
        onBootstrapEvent
      }
    })
  })

  afterEach(() => {
    cleanup()
    $notifications.set([])
    vi.clearAllMocks()
  })

  it('renders notification stack with a stable HeroUI notification shell', async () => {
    const { NotificationStack } = await import('./notifications')

    $notifications.set([
      {
        createdAt: Date.now(),
        detail: 'Connected via local gateway',
        id: 'n1',
        kind: 'info',
        message: 'Gateway connected'
      }
    ])

    render(<NotificationStack />)

    const stack = document.querySelector('[data-slot="notification-stack"]')
    const item = document.querySelector('[data-slot="notification-item"]')
    const description = document.querySelector('[data-slot="alert-description"]')

    expect(stack?.className).toContain('pointer-events-none')
    expect(item?.className).toContain('bg-[var(--overlay)]')
    expect(item?.className).toContain('shadow-[var(--overlay-shadow)]')
    expect(item?.className).toContain('backdrop-blur-md')
    expect(description?.className).toContain('text-[var(--muted)]')
    expect(await screen.findByText('Gateway connected')).toBeTruthy()

    screen.getByText('Details').click()

    const dismissButton = screen.getByRole('button', { name: 'Dismiss notification' })
    const copyDetailButton = screen.getByRole('button', { name: 'Copy detail' })

    expect(dismissButton.className).toContain('text-[var(--muted)]')
    expect(dismissButton.className).toContain('hover:bg-[var(--surface-secondary)]')
    expect(copyDetailButton.className).toContain('text-[var(--muted)]')
    expect(copyDetailButton.className).toContain('hover:bg-[var(--surface-secondary)]')
  })

  it('renders the install overlay inside a stable HeroUI shell', async () => {
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
    getRecentLogs.mockResolvedValue({ lines: ['bootstrap log\n'], path: '/Users/demo/.hermes/logs/desktop.log' })

    const { DesktopInstallOverlay } = await import('./desktop-install-overlay')
    render(<DesktopInstallOverlay />)

    expect(await screen.findByText('Installation failed')).toBeTruthy()

    const card = document.querySelector('[data-slot="desktop-install-overlay-card"]')
    expect(card?.className).toContain('bg-[var(--overlay)]')
    expect(card?.className).toContain('shadow-[var(--overlay-shadow)]')
  })

  it('renders the boot failure overlay inside a stable HeroUI shell', async () => {
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
    getRecentLogs.mockResolvedValue({ lines: ['line one\n'], path: '/tmp/desktop.log' })

    const { BootFailureOverlay } = await import('./boot-failure-overlay')
    render(<BootFailureOverlay />)

    expect(await screen.findByText("Hermes couldn't start")).toBeTruthy()

    const card = document.querySelector('[data-slot="boot-failure-overlay-card"]')
    expect(card?.className).toContain('bg-[var(--overlay)]')
    expect(card?.className).toContain('shadow-[var(--overlay-shadow)]')
  })
})

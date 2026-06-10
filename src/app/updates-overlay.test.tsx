// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopUpdateStatus } from '@/global'

import { $updateApply, $updateChecking, $updateOverlayOpen, $updateStatus } from '@/store/updates'

const applySpy = vi.fn()
const checkSpy = vi.fn<() => Promise<DesktopUpdateStatus | null>>()
const writeClipboardText = vi.fn()

vi.mock('@/store/updates', async () => {
  const actual = await vi.importActual<typeof import('@/store/updates')>('@/store/updates')

  return {
    ...actual,
    applyUpdates: () => applySpy(),
    checkUpdates: () => checkSpy()
  }
})

vi.mock('@/components/ui/copy-button', () => ({
  writeClipboardText: (...args: unknown[]) => writeClipboardText(...args)
}))

describe('UpdatesOverlay', () => {
  beforeEach(() => {
    applySpy.mockReset()
    applySpy.mockResolvedValue({ ok: true })
    checkSpy.mockReset()
    checkSpy.mockResolvedValue(null)
    writeClipboardText.mockReset()
    writeClipboardText.mockResolvedValue(undefined)
    $updateApply.set({
      applying: false,
      command: null,
      error: null,
      log: [],
      message: '',
      percent: null,
      stage: 'idle'
    })
    $updateChecking.set(false)
    $updateOverlayOpen.set(true)
    $updateStatus.set(null)
  })

  afterEach(() => {
    cleanup()
    $updateApply.set({
      applying: false,
      command: null,
      error: null,
      log: [],
      message: '',
      percent: null,
      stage: 'idle'
    })
    $updateChecking.set(false)
    $updateOverlayOpen.set(false)
    $updateStatus.set(null)
  })

  it('shows legacy packaged-updater states as manual Tauri update steps', async () => {
    $updateStatus.set({
      behind: 0,
      fetchedAt: Date.now(),
      message: 'This Tauri build does not use the official Hermes Desktop updater.',
      reason: 'packaged-updater',
      supported: true
    })

    const { UpdatesOverlay } = await import('./updates-overlay')
    render(<UpdatesOverlay />)

    expect(await screen.findByText('Manual Tauri update')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Update now' }))

    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(1))
  })

  it('shows the manual update command and copies it', async () => {
    $updateApply.set({
      applying: false,
      command: 'hermes update --branch feature/gui-parity',
      error: null,
      log: [],
      message: 'hermes update --branch feature/gui-parity',
      percent: null,
      stage: 'manual'
    })

    const { UpdatesOverlay } = await import('./updates-overlay')
    render(<UpdatesOverlay />)

    expect(await screen.findByText('Update from your terminal')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))

    await waitFor(() =>
      expect(writeClipboardText).toHaveBeenCalledWith('hermes update --branch feature/gui-parity')
    )
  })

  it('renders packaged-build manual guidance as plain text instead of a fake shell command', async () => {
    $updateApply.set({
      applying: false,
      command: 'Open https://github.com/meespace/hermes-desktop-tauri/releases and reinstall the latest package for your platform.',
      error: null,
      log: [],
      message: 'Open https://github.com/meespace/hermes-desktop-tauri/releases and reinstall the latest package for your platform.',
      percent: null,
      stage: 'manual'
    })

    const { UpdatesOverlay } = await import('./updates-overlay')
    render(<UpdatesOverlay />)

    expect(
      await screen.findByText(
        'Open https://github.com/meespace/hermes-desktop-tauri/releases and reinstall the latest package for your platform.'
      )
    ).toBeTruthy()
    expect(screen.queryByText('$')).toBeNull()
  })

  it('renders the idle update prompt with surfaced panel chrome', async () => {
    $updateStatus.set({
      behind: 2,
      commits: [
        { body: 'Refined the desktop shell', id: 'abc123', subject: 'Refine shell chrome' },
        { body: 'Aligned update prompts', id: 'def456', subject: 'Polish updater copy' }
      ],
      fetchedAt: Date.now(),
      reason: 'git',
      supported: true
    })

    const { UpdatesOverlay } = await import('./updates-overlay')
    const { container } = render(<UpdatesOverlay />)

    const summaryPanel = document.body.querySelector('[data-slot="updates-overlay-summary-panel"]')
    const laterButton = screen.getByRole('button', { name: 'Maybe later' })

    expect(summaryPanel?.className).toContain('bg-[var(--surface)]')
    expect(summaryPanel?.className).toContain('border-[var(--border)]')
    expect(summaryPanel?.className).toContain('shadow-[var(--surface-shadow)]')
    expect(laterButton.className).toContain('text-[var(--muted)]')
  })
})

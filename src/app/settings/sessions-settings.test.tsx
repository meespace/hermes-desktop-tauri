// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deleteSession = vi.fn()
const listSessions = vi.fn()
const setSessionArchived = vi.fn()
const notify = vi.fn()
const notifyError = vi.fn()
const triggerHaptic = vi.fn()
const setSessions = vi.fn()
const setDefaultProjectDir = vi.fn()

vi.mock('@/hermes', () => ({
  deleteSession: (...args: unknown[]) => deleteSession(...args),
  listSessions: (...args: unknown[]) => listSessions(...args),
  setSessionArchived: (...args: unknown[]) => setSessionArchived(...args)
}))

vi.mock('@/store/notifications', () => ({
  notify: (...args: unknown[]) => notify(...args),
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

vi.mock('@/lib/haptics', () => ({
  triggerHaptic: (...args: unknown[]) => triggerHaptic(...args)
}))

vi.mock('@/store/session', () => ({
  setDefaultProjectDir: (...args: unknown[]) => setDefaultProjectDir(...args),
  setSessions: (...args: unknown[]) => setSessions(...args)
}))

describe('SessionsSettings', () => {
  beforeEach(() => {
    deleteSession.mockReset()
    listSessions.mockReset()
    setSessionArchived.mockReset()
    notify.mockReset()
    notifyError.mockReset()
    triggerHaptic.mockReset()
    setSessions.mockReset()
    setDefaultProjectDir.mockReset()
    listSessions.mockResolvedValue({ sessions: [] })

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        settings: {
          getDefaultProjectDir: vi.fn().mockResolvedValue({
            defaultLabel: '/Users/demo/hermes-projects',
            dir: '/Users/demo/workspace'
          }),
          pickDefaultProjectDir: vi.fn().mockResolvedValue({
            canceled: false,
            dir: '/Users/demo/new-workspace'
          }),
          setDefaultProjectDir: vi.fn().mockResolvedValue({
            dir: '/Users/demo/new-workspace'
          })
        }
      }
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lets the user choose a new default project directory', async () => {
    const { SessionsSettings } = await import('./sessions-settings')
    render(<SessionsSettings query="" />)

    expect(await screen.findAllByText('/Users/demo/workspace')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Change' }))

    await waitFor(() =>
      expect(window.hermesDesktop.settings.setDefaultProjectDir).toHaveBeenCalledWith('/Users/demo/new-workspace')
    )
    expect(setDefaultProjectDir).toHaveBeenCalledWith('/Users/demo/new-workspace')
    expect(notify).toHaveBeenCalledWith({
      durationMs: 2_000,
      kind: 'success',
      message: 'Default project directory updated'
    })
  })

  it('clears the saved default project directory', async () => {
    ;(window.hermesDesktop.settings.setDefaultProjectDir as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ dir: null })

    const { SessionsSettings } = await import('./sessions-settings')
    render(<SessionsSettings query="" />)

    expect(await screen.findByRole('button', { name: 'Clear' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(window.hermesDesktop.settings.setDefaultProjectDir).toHaveBeenCalledWith(null))
    expect(setDefaultProjectDir).toHaveBeenCalledWith('')
  })
})

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let desktopVersion = { appVersion: '0.6.4' }
let updateApply = { applying: false, stage: 'idle' as const }
let updateChecking = false
let updateStatus = {
  behind: 0,
  branch: 'main',
  currentSha: 'abcdef1234567',
  fetchedAt: Date.now(),
  supported: true
}

const checkUpdates = vi.fn()
const openUpdatesWindow = vi.fn()
const refreshDesktopVersion = vi.fn()
const openRepository = vi.fn()

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@/store/updates', () => ({
  $desktopVersion: { get: () => desktopVersion },
  $updateApply: { get: () => updateApply },
  $updateChecking: { get: () => updateChecking },
  $updateStatus: { get: () => updateStatus },
  checkUpdates: () => checkUpdates(),
  openUpdatesWindow: () => openUpdatesWindow(),
  refreshDesktopVersion: () => refreshDesktopVersion()
}))

describe('AboutSettings HeroUI shells', () => {
  beforeEach(() => {
    desktopVersion = { appVersion: '0.6.4' }
    updateApply = { applying: false, stage: 'idle' }
    updateChecking = false
    updateStatus = {
      behind: 0,
      branch: 'main',
      currentSha: 'abcdef1234567',
      fetchedAt: Date.now(),
      supported: true
    }
    checkUpdates.mockReset()
    openUpdatesWindow.mockReset()
    refreshDesktopVersion.mockReset()
    openRepository.mockReset()
    window.hermesDesktop = {
      updates: {
        getSources: vi.fn(async () => ({
          desktopRepoUrl: 'https://example.com/hermes-desktop-community'
        })),
        openRepository: (...args: unknown[]) => openRepository(...args)
      }
    } as typeof window.hermesDesktop
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows manual desktop release guidance with a repository shortcut', async () => {
    const { AboutSettings } = await import('./about-settings')
    render(<AboutSettings />)

    expect(screen.getByText('Hermes Desktop Community')).toBeTruthy()
    const versionLabel = screen.getByText('Version 0.6.4')
    const description = screen.getByText(/Desktop app releases stay manual/i)
    const openRepositoryButton = screen.getByRole('button', { name: 'Open repository' })
    const wechatImage = screen.getByRole('img', { name: 'WeChat' })
    const officialAccountImage = screen.getByRole('img', { name: 'Official Account' })

    expect(versionLabel.className).toContain('text-[var(--muted)]')
    expect(description.textContent).toMatch(/Desktop app releases stay manual/i)
    expect(screen.getByText('WeChat & Official Account')).toBeTruthy()
    expect(screen.getByText('Scan to add the author on WeChat')).toBeTruthy()
    expect(screen.getByText('Scan to follow the official account')).toBeTruthy()
    expect(wechatImage.getAttribute('src')).toContain('author-wechat-qr.png')
    expect(officialAccountImage.getAttribute('src')).toContain('official-account-qr.png')
    expect(screen.queryByRole('button', { name: 'Check now' })).toBeNull()
    expect(screen.queryByText('Release notes')).toBeNull()

    fireEvent.click(openRepositoryButton)
    expect(openRepository).toHaveBeenCalledTimes(1)
  })
})

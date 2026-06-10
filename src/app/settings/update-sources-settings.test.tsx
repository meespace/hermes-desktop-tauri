// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { UpdateSourcesSettings } from './update-sources-settings'

const notify = vi.fn()
const notifyError = vi.fn()

vi.mock('@/store/notifications', () => ({
  notify: (...args: unknown[]) => notify(...args),
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

afterEach(() => {
  cleanup()
  notify.mockReset()
  notifyError.mockReset()
})

describe('UpdateSourcesSettings', () => {
  it('renders Hermes Agent manager copy from i18n in English locale', async () => {
    const checkHermesAgentUpdate = vi
      .fn()
      .mockResolvedValueOnce({
        branch: 'manual',
        currentCommit: null,
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        ok: true,
        message: 'Hermes CLI is installed on this machine. Hermes Desktop Community will use that system installation directly.',
        source: 'gitee',
        updateAvailable: true
      })
      .mockResolvedValueOnce({
        branch: 'manual',
        currentCommit: null,
        currentVersion: '0.2.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        ok: true,
        message: 'Hermes CLI is installed on this machine. Hermes Desktop Community will use that system installation directly.',
        source: 'gitee',
        updateAvailable: false
      })
    const installHermesAgent = vi.fn(async () => ({
      branch: 'manual',
      command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
      currentCommit: null,
      currentVersion: '0.1.0',
      installed: true,
      latestCommit: null,
      latestVersion: null,
      message: 'Copy install command.',
      manual: true,
      ok: true,
      source: 'gitee',
      updateAvailable: false
    }))
    const repairHermesAgent = vi.fn(async () => ({
      branch: 'manual',
      command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
      currentCommit: null,
      currentVersion: '0.1.0',
      installed: true,
      latestCommit: null,
      latestVersion: null,
      message: 'Copy repair command.',
      manual: true,
      ok: true,
      source: 'gitee',
      updateAvailable: false
    }))
    const updateHermesAgent = vi.fn(async () => ({
      branch: 'manual',
      currentCommit: null,
      currentVersion: '0.2.0',
      installed: true,
      latestCommit: null,
      latestVersion: null,
      message: 'Hermes CLI upgraded successfully.',
      ok: true,
      source: 'gitee',
      updateAvailable: false
    }))
    const writeClipboard = vi.fn(async () => true)
    const setSources = vi.fn(async (state: unknown) => state)

    window.hermesDesktop = {
      checkHermesAgentUpdate,
      installHermesAgent,
      repairHermesAgent,
      updateHermesAgent,
      writeClipboard,
      updates: {
        getSources: vi.fn(async () => ({
          agentGitCustomUrl: '',
          agentGitSource: 'gitee',
          desktopRepoUrl: 'https://example.com/repo',
          npmCustomUrl: '',
          npmSource: 'npmjs',
          pythonCustomUrl: '',
          pythonSource: 'pypi'
        })),
        openRepository: vi.fn(async () => undefined),
        setSources
      }
    } as typeof window.hermesDesktop

    render(
      <I18nProvider configClient={null} initialLocale="en">
        <UpdateSourcesSettings query="" />
      </I18nProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('System Hermes manager')).toBeTruthy()
    })

    expect(
      screen.getByText(
        'The desktop app no longer installs a second managed Hermes. These actions inspect your current system Hermes, generate install and repair commands, and can upgrade the installed CLI directly.'
      )
    ).toBeTruthy()
    expect(screen.getByText('NousResearch/hermes-agent')).toBeTruthy()
    expect(screen.getByText('gitee hermes-agent sync mirror (30min)')).toBeTruthy()
    expect(screen.getByText('gitcode hermes-agent sync mirror (30min)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy repair command' })).toBeTruthy()
    const upgradeButton = screen.getByRole('button', { name: 'Upgrade now' })
    expect(upgradeButton).toBeTruthy()
    expect(upgradeButton.hasAttribute('disabled')).toBe(false)
    expect(screen.getByText('Status: Update available')).toBeTruthy()
    expect(screen.getByText('Source: gitee')).toBeTruthy()
    expect(screen.getByText('Branch: manual')).toBeTruthy()

    fireEvent.click(upgradeButton)

    await waitFor(() => {
      expect(updateHermesAgent).toHaveBeenCalledTimes(1)
      expect(setSources).toHaveBeenCalledTimes(1)
      expect(checkHermesAgentUpdate).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Version: 0.2.0')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Upgrade now' }).hasAttribute('disabled')).toBe(true)
    })

    expect(writeClipboard).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith({
      kind: 'success',
      title: 'Hermes Agent action completed',
      message: 'Hermes CLI upgraded successfully.'
    })
    expect(installHermesAgent).not.toHaveBeenCalled()
    expect(repairHermesAgent).not.toHaveBeenCalled()
  })

  it('surfaces one-click Hermes upgrade failures as errors without copying commands', async () => {
    const checkHermesAgentUpdate = vi.fn(async () => ({
      branch: 'manual',
      currentCommit: null,
      currentVersion: '0.1.0',
      installed: true,
      latestCommit: null,
      latestVersion: null,
      ok: true,
      message: 'Hermes CLI is installed on this machine. Hermes Desktop Community will use that system installation directly.',
      source: 'gitee',
      updateAvailable: true
    }))
    const updateHermesAgent = vi.fn(async () => {
      throw new Error('Hermes CLI update failed.')
    })
    const writeClipboard = vi.fn(async () => true)

    window.hermesDesktop = {
      checkHermesAgentUpdate,
      installHermesAgent: vi.fn(async () => ({
        branch: 'manual',
        command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
        currentCommit: null,
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        message: 'Copy install command.',
        manual: true,
        ok: true,
        source: 'gitee',
        updateAvailable: false
      })),
      repairHermesAgent: vi.fn(async () => ({
        branch: 'manual',
        command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
        currentCommit: null,
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        message: 'Copy repair command.',
        manual: true,
        ok: true,
        source: 'gitee',
        updateAvailable: false
      })),
      updateHermesAgent,
      writeClipboard,
      updates: {
        getSources: vi.fn(async () => ({
          agentGitCustomUrl: '',
          agentGitSource: 'gitee',
          desktopRepoUrl: 'https://example.com/repo',
          npmCustomUrl: '',
          npmSource: 'npmjs',
          pythonCustomUrl: '',
          pythonSource: 'pypi'
        })),
        openRepository: vi.fn(async () => undefined),
        setSources: vi.fn(async (state: unknown) => state)
      }
    } as typeof window.hermesDesktop

    render(
      <I18nProvider configClient={null} initialLocale="en">
        <UpdateSourcesSettings query="" />
      </I18nProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Upgrade now' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade now' }))

    await waitFor(() => {
      expect(updateHermesAgent).toHaveBeenCalledTimes(1)
    })

    expect(writeClipboard).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalled()
  })

  it('disables the upgrade button when System Hermes is already up to date', async () => {
    window.hermesDesktop = {
      checkHermesAgentUpdate: vi.fn(async () => ({
        branch: 'main',
        currentCommit: 'def5678',
        currentVersion: '0.2.0',
        installed: true,
        latestCommit: 'def5678',
        latestVersion: '0.2.0',
        ok: true,
        message: 'System Hermes is up to date on main.',
        source: 'gitee',
        updateAvailable: false
      })),
      installHermesAgent: vi.fn(async () => ({
        branch: 'manual',
        command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
        currentCommit: null,
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        message: 'Copy install command.',
        manual: true,
        ok: true,
        source: 'gitee',
        updateAvailable: false
      })),
      repairHermesAgent: vi.fn(async () => ({
        branch: 'manual',
        command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
        currentCommit: null,
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        message: 'Copy repair command.',
        manual: true,
        ok: true,
        source: 'gitee',
        updateAvailable: false
      })),
      updateHermesAgent: vi.fn(async () => ({
        branch: 'main',
        currentCommit: 'def5678',
        currentVersion: '0.2.0',
        installed: true,
        latestCommit: 'def5678',
        latestVersion: '0.2.0',
        message: 'Hermes CLI upgraded successfully.',
        ok: true,
        source: 'gitee',
        updateAvailable: false
      })),
      updates: {
        getSources: vi.fn(async () => ({
          agentGitCustomUrl: '',
          agentGitSource: 'gitee',
          desktopRepoUrl: 'https://example.com/repo',
          npmCustomUrl: '',
          npmSource: 'npmjs',
          pythonCustomUrl: '',
          pythonSource: 'pypi'
        })),
        openRepository: vi.fn(async () => undefined),
        setSources: vi.fn(async (state: unknown) => state)
      }
    } as typeof window.hermesDesktop

    render(
      <I18nProvider configClient={null} initialLocale="en">
        <UpdateSourcesSettings query="" />
      </I18nProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('System Hermes is up to date on main.')).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: 'Upgrade now' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows live Hermes upgrade progress so the action does not look frozen', async () => {
    let progressCallback: ((payload: {
      at: number
      error: string | null
      message: string
      percent: number | null
      stage: 'update' | 'done'
    }) => void) | null = null
    let finishUpgrade: (() => void) | null = null

    const checkHermesAgentUpdate = vi
      .fn()
      .mockResolvedValueOnce({
        branch: 'main',
        currentCommit: 'abc1234',
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: 'def5678',
        latestVersion: '0.2.0',
        ok: true,
        message: '20 commits behind upstream/main.',
        source: 'gitee',
        updateAvailable: true
      })
      .mockResolvedValueOnce({
        branch: 'main',
        currentCommit: 'def5678',
        currentVersion: '0.2.0',
        installed: true,
        latestCommit: 'def5678',
        latestVersion: '0.2.0',
        ok: true,
        message: 'Hermes CLI upgraded successfully.',
        source: 'gitee',
        updateAvailable: false
      })
    const updateHermesAgent = vi.fn(
      () =>
        new Promise(resolve => {
          finishUpgrade = () => {
            progressCallback?.({
              at: Date.now(),
              error: null,
              message: 'Hermes CLI upgraded successfully.',
              percent: 100,
              stage: 'done'
            })

            resolve({
              branch: 'main',
              currentCommit: 'def5678',
              currentVersion: '0.2.0',
              installed: true,
              latestCommit: 'def5678',
              latestVersion: '0.2.0',
              message: 'Hermes CLI upgraded successfully.',
              ok: true,
              source: 'gitee',
              updateAvailable: false
            })
          }

          progressCallback?.({
            at: Date.now(),
            error: null,
            message: 'Fetching from upstream...',
            percent: 35,
            stage: 'update'
          })
        })
    )

    window.hermesDesktop = {
      checkHermesAgentUpdate,
      installHermesAgent: vi.fn(async () => ({
        branch: 'manual',
        command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
        currentCommit: null,
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        message: 'Copy install command.',
        manual: true,
        ok: true,
        source: 'gitee',
        updateAvailable: false
      })),
      repairHermesAgent: vi.fn(async () => ({
        branch: 'manual',
        command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
        currentCommit: null,
        currentVersion: '0.1.0',
        installed: true,
        latestCommit: null,
        latestVersion: null,
        message: 'Copy repair command.',
        manual: true,
        ok: true,
        source: 'gitee',
        updateAvailable: false
      })),
      updateHermesAgent,
      updates: {
        getSources: vi.fn(async () => ({
          agentGitCustomUrl: '',
          agentGitSource: 'gitee',
          desktopRepoUrl: 'https://example.com/repo',
          npmCustomUrl: '',
          npmSource: 'npmjs',
          pythonCustomUrl: '',
          pythonSource: 'pypi'
        })),
        onProgress: vi.fn(callback => {
          progressCallback = callback
          return () => {
            progressCallback = null
          }
        }),
        openRepository: vi.fn(async () => undefined),
        setSources: vi.fn(async (state: unknown) => state)
      }
    } as typeof window.hermesDesktop

    render(
      <I18nProvider configClient={null} initialLocale="en">
        <UpdateSourcesSettings query="" />
      </I18nProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Upgrade now' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade now' }))

    await waitFor(() => {
      expect(screen.getByText('Fetching from upstream...')).toBeTruthy()
      expect(screen.getByText('35%')).toBeTruthy()
    })

    finishUpgrade?.()

    await waitFor(() => {
      expect(screen.getByText('Update complete')).toBeTruthy()
      expect(screen.getAllByText('Hermes CLI upgraded successfully.').length).toBeGreaterThan(0)
      expect(screen.getByText('100%')).toBeTruthy()
    })
  })

  it('shows an explicit compatibility message when Hermes Agent manager commands are unavailable', async () => {
    window.hermesDesktop = {
      updates: {
        getSources: vi.fn(async () => ({
          agentGitCustomUrl: '',
          agentGitSource: 'gitee',
          desktopRepoUrl: 'https://example.com/repo',
          npmCustomUrl: '',
          npmSource: 'npmjs',
          pythonCustomUrl: '',
          pythonSource: 'pypi'
        })),
        openRepository: vi.fn(async () => undefined),
        setSources: vi.fn(async (state: unknown) => state)
      }
    } as typeof window.hermesDesktop

    render(
      <I18nProvider configClient={null} initialLocale="zh">
        <UpdateSourcesSettings query="" />
      </I18nProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('当前桌面端还没有接上 Hermes Agent 管理命令。请重启应用，或重新构建并更新 src-tauri 后再试。')).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: '检查更新' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制修复命令' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '复制安装命令' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps Tsinghua visible but disabled and normalizes legacy Python source selections to PyPI', async () => {
    const setSources = vi.fn(async (state: unknown) => state)

    window.hermesDesktop = {
      updates: {
        getSources: vi.fn(async () => ({
          agentGitCustomUrl: '',
          agentGitSource: 'gitee',
          desktopRepoUrl: 'https://example.com/repo',
          npmCustomUrl: '',
          npmSource: 'npmjs',
          pythonCustomUrl: '',
          pythonSource: 'tsinghua'
        })),
        openRepository: vi.fn(async () => undefined),
        setSources
      }
    } as typeof window.hermesDesktop

    render(
      <I18nProvider configClient={null} initialLocale="zh">
        <UpdateSourcesSettings query="" />
      </I18nProvider>
    )

    const disabledTsinghua = await screen.findByRole('button', { name: /清华源/i })
    expect(disabledTsinghua.hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(setSources).toHaveBeenCalledWith(
        expect.objectContaining({
          pythonSource: 'pypi'
        })
      )
    })
  })
})

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getElevenLabsVoices = vi.fn()
const getHermesConfigDefaults = vi.fn()
const getHermesConfigRecord = vi.fn()
const getHermesConfigSchema = vi.fn()
const saveHermesConfig = vi.fn()

vi.mock('@/hermes', () => ({
  getElevenLabsVoices: () => getElevenLabsVoices(),
  getHermesConfigDefaults: () => getHermesConfigDefaults(),
  getHermesConfigRecord: () => getHermesConfigRecord(),
  getHermesConfigSchema: () => getHermesConfigSchema(),
  saveHermesConfig: (...args: unknown[]) => saveHermesConfig(...args)
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('./model-settings', () => ({
  ModelSettings: () => <div data-testid="model-settings" />
}))

describe('ConfigSettings HeroUI shells', () => {
  beforeEach(() => {
    getHermesConfigRecord.mockResolvedValue({
      terminal: {
        cwd: '/Users/demo/projects/'.repeat(12),
        persistent_shell: true
      }
    })
    getHermesConfigDefaults.mockResolvedValue({})
    getHermesConfigSchema.mockResolvedValue({
      fields: {
        'terminal.cwd': {
          description: 'Default project folder for tool and terminal work.',
          type: 'text'
        },
        'terminal.persistent_shell': {
          description: 'Keep shell state between commands when the backend supports it.',
          type: 'boolean'
        }
      }
    })
    getElevenLabsVoices.mockResolvedValue({ available: false, voices: [] })
    saveHermesConfig.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders config helper copy and textarea surfaces with HeroUI tokens', async () => {
    const { ConfigSettings } = await import('./config-settings')
    render(
      <ConfigSettings
        activeSectionId="workspace"
        importInputRef={createRef<HTMLInputElement>()}
        query=""
      />
    )

    const offOnLabel = await screen.findByText('On')
    const textarea = screen.getByDisplayValue(/\/Users\/demo\/projects\//)

    expect(offOnLabel.className).toContain('text-[var(--muted)]')
    expect(textarea.className).toContain('bg-[var(--surface)]')
  })
})

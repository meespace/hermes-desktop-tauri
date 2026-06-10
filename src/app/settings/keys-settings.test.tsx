// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { KeysSettings } from './keys-settings'

const getEnvVars = vi.fn()
const setEnvVar = vi.fn()
const deleteEnvVar = vi.fn()
const revealEnvVar = vi.fn()

vi.mock('@/hermes', () => ({
  getEnvVars: () => getEnvVars(),
  setEnvVar: (key: string, value: string) => setEnvVar(key, value),
  deleteEnvVar: (key: string) => deleteEnvVar(key),
  revealEnvVar: (key: string) => revealEnvVar(key)
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  getEnvVars.mockResolvedValue({
    OPENROUTER_API_KEY: {
      advanced: false,
      category: 'provider',
      description: 'OpenRouter API key',
      is_password: true,
      is_set: true,
      redacted_value: 'sk-o...1234',
      tools: [],
      url: 'https://openrouter.ai/keys'
    },
    OPENAI_BASE_URL: {
      advanced: false,
      category: 'provider',
      description: 'OpenAI-compatible base URL',
      is_password: false,
      is_set: true,
      redacted_value: 'http.../v1',
      tools: [],
      url: null
    },
    DEEPSEEK_API_KEY: {
      advanced: false,
      category: 'provider',
      description: 'DeepSeek API key',
      is_password: true,
      is_set: false,
      redacted_value: null,
      tools: [],
      url: null
    }
  })
})

describe('KeysSettings', () => {
  it('shows local endpoint as its own group and expands configured groups by default', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <KeysSettings query="" />
      </I18nProvider>
    )

    expect(await screen.findByText('API key / custom provider')).toBeTruthy()
    expect(screen.getByText('Local / self-hosted')).toBeTruthy()
    expect(screen.getByText('OpenRouter API key')).toBeTruthy()
    expect(screen.getByText('OpenAI-compatible base URL')).toBeTruthy()
  })
})

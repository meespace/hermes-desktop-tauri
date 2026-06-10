// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { ProvidersSettings } from './providers-settings'

const listOAuthProviders = vi.fn()
const getGlobalModelOptions = vi.fn()
const getEnvVars = vi.fn()
const startManualProviderOAuth = vi.fn()

vi.mock('@/hermes', () => ({
  listOAuthProviders: () => listOAuthProviders(),
  getGlobalModelOptions: () => getGlobalModelOptions(),
  getEnvVars: () => getEnvVars()
}))

vi.mock('@/store/onboarding', async () => {
  const nanostores = await import('nanostores')
  return {
    $desktopOnboarding: nanostores.atom({ manual: false }),
    startManualProviderOAuth: (providerId: string) => startManualProviderOAuth(providerId)
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  listOAuthProviders.mockResolvedValue({
    providers: [
      { id: 'nous', name: 'Nous', flow: 'browser', status: { logged_in: true } },
      { id: 'qwen-oauth', name: 'Qwen', flow: 'browser', status: { logged_in: false } }
    ]
  })

  getGlobalModelOptions.mockResolvedValue({
    providers: [
      { slug: 'openrouter', name: 'OpenRouter', auth_type: 'api_key', key_env: 'OPENROUTER_API_KEY', models: [] },
      { slug: 'deepseek', name: 'DeepSeek', auth_type: 'api_key', key_env: 'DEEPSEEK_API_KEY', models: [] }
    ]
  })

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
    DEEPSEEK_API_KEY: {
      advanced: false,
      category: 'provider',
      description: 'DeepSeek API key',
      is_password: true,
      is_set: false,
      redacted_value: null,
      tools: [],
      url: 'https://platform.deepseek.com/api_keys'
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
    }
  })
})

describe('ProvidersSettings', () => {
  it('groups providers into oauth, api key, and local sections with visible statuses', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <ProvidersSettings onOpenApiKeys={vi.fn()} query="" />
      </I18nProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Built-in account login')).toBeTruthy()
    })

    expect(screen.getByText('API key / custom provider')).toBeTruthy()
    expect(screen.getByText('Local / self-hosted')).toBeTruthy()
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Configured').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Not configured').length).toBeGreaterThan(0)
    expect(screen.getByText('OpenAI-compatible endpoint')).toBeTruthy()
  })

  it('routes oauth rows to manual provider auth and key rows to API key management', async () => {
    const onOpenApiKeys = vi.fn()

    render(
      <I18nProvider configClient={null} initialLocale="en">
        <ProvidersSettings onOpenApiKeys={onOpenApiKeys} query="" />
      </I18nProvider>
    )

    const oauthRow = await screen.findByRole('button', { name: /Nous/i })
    fireEvent.click(oauthRow)

    expect(startManualProviderOAuth).toHaveBeenCalledWith('nous')

    const keyRow = screen.getByRole('button', { name: /OpenRouter/i })
    fireEvent.click(keyRow)

    expect(onOpenApiKeys).toHaveBeenCalled()
  })
})

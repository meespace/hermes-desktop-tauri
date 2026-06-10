// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getGlobalModelOptionsMock = vi.fn()
const startManualOnboardingMock = vi.fn()

vi.mock('@/hermes', () => ({
  getGlobalModelOptions: (...args: unknown[]) => getGlobalModelOptionsMock(...args)
}))

vi.mock('@/store/onboarding', () => ({
  startManualOnboarding: () => startManualOnboardingMock()
}))

describe('ModelPickerDialog HeroUI shells', () => {
  beforeEach(() => {
    getGlobalModelOptionsMock.mockReset()
    startManualOnboardingMock.mockReset()
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        disconnect() {}
        observe() {}
        unobserve() {}
      }
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders surfaced overlay/header/footer tokens for the picker shell', async () => {
    getGlobalModelOptionsMock.mockResolvedValue({
      model: 'gpt-4.1',
      provider: 'openai',
      providers: [
        {
          models: ['gpt-4.1'],
          name: 'OpenAI',
          pricing: {
            'gpt-4.1': { free: false, input: '5', output: '15' }
          },
          slug: 'openai',
          total_models: 1
        }
      ]
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })

    const { ModelPickerDialog } = await import('./model-picker')

    render(
      <QueryClientProvider client={queryClient}>
        <ModelPickerDialog
          currentModel="gpt-4.1"
          currentProvider="openai"
          onOpenChange={vi.fn()}
          onSelect={vi.fn()}
          open
        />
      </QueryClientProvider>
    )

    expect(await screen.findByText('OpenAI')).toBeTruthy()

    const content = document.querySelector('[data-slot="dialog-content"]')
    const header = document.querySelector('[data-slot="dialog-header"]')
    const footer = document.querySelector('[data-slot="dialog-footer"]')
    const persistLabel = screen.getByText('Persist globally').closest('label')

    expect(content?.className).toContain('bg-[var(--overlay)]')
    expect(content?.className).toContain('shadow-[var(--overlay-shadow)]')
    expect(header?.className).toContain('border-[var(--separator)]')
    expect(header?.className).toContain('bg-[var(--surface)]')
    expect(footer?.className).toContain('border-[var(--separator)]')
    expect(footer?.className).toContain('bg-[var(--surface)]')
    expect(persistLabel?.className).toContain('text-[var(--muted)]')
  })
})

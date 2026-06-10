// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $visibleModels } from '@/store/model-visibility'

const getGlobalModelOptionsMock = vi.fn()

vi.mock('@/hermes', () => ({
  getGlobalModelOptions: (...args: unknown[]) => getGlobalModelOptionsMock(...args)
}))

describe('ModelVisibilityDialog', () => {
  beforeEach(() => {
    getGlobalModelOptionsMock.mockReset()
    $visibleModels.set(null)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the HeroUI dialog shell and provider list', async () => {
    getGlobalModelOptionsMock.mockResolvedValue({
      providers: [
        {
          models: ['gpt-4.1', 'gpt-4.1-fast'],
          name: 'OpenAI',
          slug: 'openai'
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

    const { ModelVisibilityDialog } = await import('./model-visibility-dialog')

    render(
      <QueryClientProvider client={queryClient}>
        <ModelVisibilityDialog onOpenChange={vi.fn()} onOpenProviders={vi.fn()} open sessionId={null} />
      </QueryClientProvider>
    )

    expect(await screen.findByText('OpenAI')).toBeTruthy()
    expect(screen.getByPlaceholderText('Search models')).toBeTruthy()
    expect(screen.getByText('Add provider…')).toBeTruthy()

    const content = document.querySelector('[data-slot="dialog-content"]')
    expect(content?.className).toContain('shadow-[var(--overlay-shadow)]')
    expect(content?.className).toContain('bg-[var(--overlay)]')
  })
})

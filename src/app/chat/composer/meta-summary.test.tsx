// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  COMPOSER_META_ATTACHED_CLASS,
  COMPOSER_META_STACKED_CLASS,
  ComposerMetaSummary
} from './meta-summary'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      composer: {
        meta: {
          contextSuggestions: (count: number) => `${count} context suggestions`,
          quickModels: (count: number) => `${count} quick models`,
          editingQueuedTurn: 'Editing queued turn in composer'
        }
      }
    }
  })
}))

describe('composer meta summary layout', () => {
  it('renders the attached wide layout with metadata outside the input body', () => {
    const { container } = render(
      <ComposerMetaSummary
        composerHint="Enter send · Shift+Enter newline"
        modelLabel="sensenova-6.7-flash-lite"
        modelTitle="SenseNova · sensenova-6.7-flash-lite"
        quickSwitchCount={8}
        stacked={false}
        suggestionCount={2}
      />
    )

    const attached = container.querySelector('[data-slot="composer-meta-attached"]')

    expect(attached?.className).toContain(COMPOSER_META_ATTACHED_CLASS)
    expect(attached?.className).toContain('flex-nowrap')
    expect(attached?.className).toContain('overflow-hidden')
    expect(screen.getByText('2 context suggestions')).toBeTruthy()
    expect(screen.getByText('8 quick models')).toBeTruthy()
  })

  it('renders the stacked fallback layout for narrow composers', () => {
    const { container } = render(
      <ComposerMetaSummary
        composerHint="Enter send · Shift+Enter newline"
        modelLabel="sensenova-6.7-flash-lite"
        modelTitle="SenseNova · sensenova-6.7-flash-lite"
        quickSwitchCount={3}
        stacked
        suggestionCount={1}
      />
    )

    const stacked = container.querySelector('[data-slot="composer-meta-stacked"]')

    expect(stacked?.className).toContain(COMPOSER_META_STACKED_CLASS)
    expect(screen.getByText('1 context suggestions')).toBeTruthy()
    expect(screen.getByText('3 quick models')).toBeTruthy()
  })
})

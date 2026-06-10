// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { COMPLETION_DRAWER_CLASS, COMPLETION_DRAWER_ROW_CLASS } from './completion-drawer'
import { ComposerTriggerPopover } from './trigger-popover'

describe('composer completion drawer HeroUI shells', () => {
  it('uses overlay surfaces and muted row chrome', () => {
    expect(COMPLETION_DRAWER_CLASS).toContain('border-[var(--border)]')
    expect(COMPLETION_DRAWER_CLASS).toContain('bg-[var(--overlay)]')
    expect(COMPLETION_DRAWER_CLASS).toContain('shadow-[var(--overlay-shadow)]')
    expect(COMPLETION_DRAWER_ROW_CLASS).toContain('hover:bg-[var(--surface-secondary)]')
    expect(COMPLETION_DRAWER_ROW_CLASS).toContain('data-[highlighted]:bg-[var(--surface-secondary)]')
  })

  it('renders highlighted trigger rows inside the HeroUI shell', () => {
    render(
      <ComposerTriggerPopover
        activeIndex={0}
        items={[
          {
            description: 'Reference the main app entry',
            id: 'file-src-app',
            label: '@file:src/app.tsx',
            metadata: {
              display: '@file:src/app.tsx',
              meta: 'Reference the main app entry'
            },
            type: 'file'
          }
        ]}
        kind="@"
        loading={false}
        onHover={vi.fn()}
        onPick={vi.fn()}
      />
    )

    const option = screen.getByRole('button', { name: /@file:src\/app\.tsx/i })
    const hint = screen.getByText('Reference the main app entry')

    expect(option.className).toContain('bg-[var(--surface-secondary)]')
    expect(hint.className).toContain('text-[var(--muted)]')
  })
})

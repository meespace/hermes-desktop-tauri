// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ComposerControls } from './controls'

describe('chat composer HeroUI shells', () => {
  it('renders muted secondary chrome for composer ghost controls', () => {
    render(
      <ComposerControls
        busy={false}
        busyAction="stop"
        canSubmit
        conversation={{
          active: false,
          level: 0,
          muted: false,
          status: 'idle',
          onEnd: vi.fn(),
          onStart: vi.fn(),
          onStopTurn: vi.fn(),
          onToggleMute: vi.fn()
        }}
        disabled={false}
        hasComposerPayload
        onDictate={vi.fn()}
        state={{
          model: { canSwitch: true, loading: false, model: 'gpt-4.1', provider: 'openai', quickModels: [] },
          tools: { enabled: true, label: 'Add context', suggestions: [] },
          voice: { active: false, enabled: true }
        }}
        voiceStatus="idle"
      />
    )

    const dictationButton = screen.getByRole('button', { name: 'Voice dictation' })

    expect(dictationButton.className).toContain('text-[var(--muted)]')
    expect(dictationButton.className).toContain('hover:bg-[var(--surface-secondary)]')
    expect(dictationButton.className).toContain('hover:text-foreground')
  })
})

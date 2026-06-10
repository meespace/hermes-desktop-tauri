// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setTheme = vi.fn()
const setMode = vi.fn()
let toolViewMode: 'product' | 'technical' = 'product'

vi.mock('@nanostores/react', () => ({
  useStore: () => toolViewMode
}))

vi.mock('@/lib/haptics', () => ({
  triggerHaptic: vi.fn()
}))

vi.mock('@/store/tool-view', () => ({
  $toolViewMode: {},
  setToolViewMode: vi.fn()
}))

vi.mock('@/themes/context', () => ({
  useTheme: () => ({
    availableThemes: [
      {
        description: 'Warm paper contrast for long sessions.',
        label: 'Paper',
        name: 'paper'
      },
      {
        description: 'Cool slate palette with muted chat chrome.',
        label: 'Slate',
        name: 'slate'
      }
    ],
    mode: 'light',
    setMode,
    setTheme,
    themeName: 'paper'
  })
}))

vi.mock('@/themes/presets', () => ({
  BUILTIN_THEMES: {
    paper: {
      colors: {
        background: '#fffaf1',
        border: '#e6dcc6',
        foreground: '#2c241b',
        muted: '#f2e8d2',
        mutedForeground: '#7a6c5b',
        sidebarBackground: '#f7edd8',
        sidebarBorder: '#dfd1b8',
        userBubble: '#efe2c8',
        userBubbleBorder: '#dbc7a5'
      }
    },
    slate: {
      colors: {
        background: '#f7f8fb',
        border: '#d5d9e3',
        foreground: '#182033',
        muted: '#edf0f6',
        mutedForeground: '#5b6478',
        sidebarBackground: '#e8ecf4',
        sidebarBorder: '#cfd5e2',
        userBubble: '#e3e8f3',
        userBubbleBorder: '#c2cbdd'
      }
    }
  }
}))

describe('AppearanceSettings HeroUI shells', () => {
  beforeEach(() => {
    toolViewMode = 'product'
    setTheme.mockReset()
    setMode.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders helper copy with unified muted theme tokens', async () => {
    const { AppearanceSettings } = await import('./appearance-settings')
    render(<AppearanceSettings />)

    const colorModeHelp = screen.getByText('Choose the language for the desktop interface.')
    const toolModeHelp = screen.getByText('Product hides raw tool payloads; Technical shows full input and output.')
    const themeHelp = screen.getByText('Desktop palettes only. The selected mode is applied on top.')

    expect(colorModeHelp.className).toContain('text-[var(--muted)]')
    expect(toolModeHelp.className).toContain('text-[var(--muted)]')
    expect(themeHelp.className).toContain('text-[var(--muted)]')
  })
})

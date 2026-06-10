// @vitest-environment jsdom

import '@/test/mock-local-storage'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILTIN_THEMES } from '@/themes/presets'

vi.mock('./app/index', async () => {
  const React = await import('react')
  const { useTheme } = await import('@/themes/context')

  function ThemeProbe() {
    const { mode, setMode } = useTheme()

    return (
      <div>
        <div data-testid="theme-mode">{mode}</div>
        <button aria-label="switch-dark" onClick={() => setMode('dark')} type="button">
          Switch to dark
        </button>
      </div>
    )
  }

  return { default: ThemeProbe, __esModule: true, React }
})

describe('App theme wiring', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-hermes-mode')
    document.documentElement.removeAttribute('data-hermes-theme')

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn()
      }))
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('wraps the app in ThemeProvider so mode changes update document theme state', async () => {
    const { default: App } = await import('./App')

    render(<App />)

    expect(screen.getByTestId('theme-mode').textContent).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'switch-dark' }))

    await waitFor(() => expect(screen.getByTestId('theme-mode').textContent).toBe('dark'))
    expect(window.localStorage.getItem('hermes-desktop-mode-v1')).toBe('dark')
    expect(document.documentElement.dataset.hermesMode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('keeps explicit dark mode active even when a dark palette background is bright', async () => {
    const { default: App } = await import('./App')
    const originalDarkColors = BUILTIN_THEMES.nous.darkColors

    BUILTIN_THEMES.nous.darkColors = {
      ...originalDarkColors,
      background: '#f8f6ef',
      card: '#fffdf7',
      popover: '#fffaf2',
      sidebarBackground: '#f2eee3'
    }

    try {
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: 'switch-dark' }))

      await waitFor(() => expect(screen.getByTestId('theme-mode').textContent).toBe('dark'))
      expect(document.documentElement.dataset.hermesMode).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    } finally {
      BUILTIN_THEMES.nous.darkColors = originalDarkColors
    }
  })
})

// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { StatusbarControls } from './statusbar-controls'
import { titlebarButtonClass, titlebarHeaderBaseClass, titlebarHeaderShadowClass } from './titlebar'
import { TitlebarControls } from './titlebar-controls'

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@/store/haptics', () => {
  let muted = false

  return {
    $hapticsMuted: { get: () => muted },
    toggleHapticsMuted: () => {
      muted = !muted
    }
  }
})

vi.mock('@/store/layout', () => ({
  $fileBrowserOpen: { get: () => false },
  $sidebarOpen: { get: () => true },
  toggleFileBrowserOpen: vi.fn(),
  toggleSidebarOpen: vi.fn()
}))

vi.mock('@/lib/haptics', () => ({
  triggerHaptic: vi.fn()
}))

describe('desktop chrome shells', () => {
  it('exposes HeroUI titlebar shell tokens', () => {
    expect(titlebarButtonClass).toContain('shrink-0')
    expect(titlebarButtonClass).toContain('bg-transparent')
    expect(titlebarButtonClass).toContain('hover:bg-[var(--workbench-hover)]')
    expect(titlebarHeaderBaseClass).toContain('bg-transparent')
    expect(titlebarHeaderBaseClass).not.toContain('border-b')
    expect(titlebarHeaderShadowClass).toContain("after:from-[color-mix(in_srgb,var(--surface)_42%,transparent)]")
  })

  it('renders statusbar with HeroUI footer surface tokens', () => {
    const { container } = render(
      <MemoryRouter>
        <StatusbarControls
          items={[
            {
              id: 'session',
              label: 'Ready',
              variant: 'action'
            }
          ]}
          leftItems={[
            {
              detail: 'main',
              id: 'branch',
              label: 'Branch',
              variant: 'text'
            }
          ]}
        />
      </MemoryRouter>
    )

    const footer = container.querySelector('footer')
    const readyButton = screen.getByRole('button', { name: 'Ready' })

    expect(footer?.className).toContain('border-[var(--separator)]')
    expect(footer?.className).toContain('bg-[color-mix(in_srgb,var(--surface)_90%,white_10%)]')
    expect(footer?.className).toContain('shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface)_92%,white_8%)]')
    expect(readyButton.className).toContain('hover:bg-[var(--surface-secondary)]')
    expect(readyButton.className).toContain('text-[var(--muted)]')
  })

  it('renders titlebar controls with HeroUI button shells', () => {
    render(
      <MemoryRouter>
        <TitlebarControls commandCenterOpen={false} onOpenSearch={vi.fn()} onOpenSettings={vi.fn()} />
      </MemoryRouter>
    )

    const profilesButton = screen.getByRole('button', { name: /Profiles/ })

    expect(profilesButton.className).toContain('rounded-[0.46rem]')
    expect(profilesButton.className).toContain('bg-transparent')
    expect(profilesButton.className).toContain('hover:bg-[var(--workbench-hover)]')
  })

  it('suppresses the fixed pane-tools cluster when tools are embedded into shell content', () => {
    render(
      <MemoryRouter>
        <TitlebarControls
          hideGlobalTools
          onOpenSearch={vi.fn()}
          onOpenSettings={vi.fn()}
          tools={[
            {
              icon: <span aria-hidden="true">X</span>,
              id: 'preview-close',
              label: 'Close preview',
              onSelect: vi.fn()
            }
          ]}
        />
      </MemoryRouter>
    )

    expect(screen.queryByLabelText('Pane controls')).toBeNull()
  })
})

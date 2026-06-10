// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./overlays/overlay-search-input', () => ({
  PageSearchInput: ({ placeholder }: { placeholder: string }) => <div data-testid="page-search-input">{placeholder}</div>
}))

const layoutState = vi.hoisted(() => ({
  sidebarOpen: true
}))

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@/store/layout', () => ({
  $sidebarOpen: { get: () => layoutState.sidebarOpen },
  setSidebarOpen: vi.fn()
}))

vi.mock('@/components/ui/codicon', () => ({
  Codicon: ({ name }: { name: string }) => <span data-testid="codicon">{name}</span>
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      shell: {
        showSidebar: 'Show sidebar'
      }
    }
  })
}))

vi.mock('@/lib/haptics', () => ({
  triggerHaptic: vi.fn()
}))

describe('PageSearchShell theme surfaces', () => {
  it('uses workbench muted panel tokens for the shared page header chrome', async () => {
    const { PageSearchShell } = await import('./page-search-shell')
    const { container } = render(
      <PageSearchShell headerTitle="Skills" onSearchChange={vi.fn()} searchPlaceholder="Search" searchValue="">
        <div>content</div>
      </PageSearchShell>
    )

    const header = container.querySelector('section > div > div') as HTMLElement

    expect(header.className).toContain('bg-[var(--workbench-panel-muted-bg)]')
    expect(header.className).not.toContain('white_12%')
  })

  it('renders a header-owned sidebar restore button when requested and the sidebar is collapsed', async () => {
    layoutState.sidebarOpen = false
    const { PageSearchShell } = await import('./page-search-shell')
    const { getByRole } = render(
      <PageSearchShell
        headerTitle="Skills"
        onSearchChange={vi.fn()}
        searchPlaceholder="Search"
        searchValue=""
        showSidebarRestoreButton
      >
        <div>content</div>
      </PageSearchShell>
    )

    expect(getByRole('button', { name: 'Show sidebar' })).toBeTruthy()
    layoutState.sidebarOpen = true
  })
})

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const shellSurfaceLayoutState = vi.hoisted(() => ({
  sidebarOpen: true
}))

const shellSurfaceSessionState = vi.hoisted(() => ({
  currentCwd: '/tmp/hermes-workspace',
  defaultProjectDir: ''
}))

const titlebarControlsState = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>
}))

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@/components/pane-shell', () => ({
  PaneShell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="pane-shell">
      {children}
    </div>
  )
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({
    children,
    className,
    style
  }: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
  }) => (
    <div className={className} data-testid="sidebar-provider" style={style}>
      {children}
    </div>
  )
}))

vi.mock('@/store/layout', () => ({
  $fileBrowserOpen: { get: () => false },
  $sidebarOpen: { get: () => shellSurfaceLayoutState.sidebarOpen },
  $sidebarWidth: { get: () => 224 },
  FILE_BROWSER_DEFAULT_WIDTH: '320px',
  FILE_BROWSER_PANE_ID: 'file-browser',
  setSidebarOpen: vi.fn()
}))

vi.mock('@/store/panes', () => ({
  $paneWidthOverride: () => ({ get: () => undefined })
}))

vi.mock('@/store/session', () => ({
  $connection: { get: () => null },
  $currentCwd: { get: () => shellSurfaceSessionState.currentCwd },
  $defaultProjectDir: { get: () => shellSurfaceSessionState.defaultProjectDir },
  $gatewayState: { get: () => 'open' }
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      shell: {
        workspaceModeLabel: 'Run mode',
        workspacePathLabel: 'Workspace'
      },
      sidebar: {
        gatewayLocal: 'Local',
        gatewayOffline: 'Offline',
        gatewayStarting: 'Starting',
        workspaceNone: 'No workspace'
      }
    }
  })
}))

vi.mock('./titlebar-controls', () => ({
  TitlebarControls: (props: Record<string, unknown>) => {
    titlebarControlsState.props = props

    return (
      <div data-testid="titlebar-controls">
        {props.leftContext as React.ReactNode}
      </div>
    )
  }
}))

vi.mock('./statusbar-controls', () => ({
  StatusbarControls: () => <div data-testid="statusbar-controls" />
}))

afterEach(() => {
  cleanup()
  shellSurfaceLayoutState.sidebarOpen = true
  shellSurfaceSessionState.currentCwd = '/tmp/hermes-workspace'
  shellSurfaceSessionState.defaultProjectDir = ''
  titlebarControlsState.props = null
})

describe('shell surfaces', () => {
  it('renders the runtime app shell with HeroUI root surface tokens', async () => {
    const { AppShell } = await import('./app-shell')
    const { container, getByTestId } = render(
      <MemoryRouter>
        <AppShell onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    const provider = getByTestId('sidebar-provider')

    expect(provider.className).toContain('bg-[var(--workbench-shell-bg)]')
    expect(container.querySelector('[data-tauri-drag-region]')?.parentElement).toBe(provider)
    expect(container.querySelector('main')?.className).toContain('pt-(--titlebar-height)')
    expect(getByTestId('pane-shell').className).not.toContain('pt-(--titlebar-height)')
  })

  it('renders titlebar context with run mode and the real workspace path', async () => {
    const { AppShell } = await import('./app-shell')

    render(
      <MemoryRouter>
        <AppShell onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(screen.getByText('Run mode')).toBeTruthy()
    expect(screen.getByText('Local')).toBeTruthy()
    expect(screen.getByText('Workspace')).toBeTruthy()
    expect(screen.getByText('/tmp/hermes-workspace')).toBeTruthy()
  })

  it('falls back to the saved default project directory when current cwd is empty', async () => {
    shellSurfaceSessionState.currentCwd = ''
    shellSurfaceSessionState.defaultProjectDir = '/Users/demo/default-workspace'
    const { AppShell } = await import('./app-shell')

    render(
      <MemoryRouter>
        <AppShell onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(screen.getByText('/Users/demo/default-workspace')).toBeTruthy()
  })

  it('anchors the left workspace header to the workspace edge instead of the sidebar edge', async () => {
    const { AppShell } = await import('./app-shell')

    render(
      <MemoryRouter>
        <AppShell onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(titlebarControlsState.props).toMatchObject({
      leftPosition: {
        left: 'calc(var(--shell-sidebar-workspace-anchor) + var(--shell-main-header-inset))'
      }
    })
  })

  it('keeps the left workspace header clear of mac traffic lights when the sidebar is collapsed', async () => {
    shellSurfaceLayoutState.sidebarOpen = false
    const { AppShell } = await import('./app-shell')

    render(
      <MemoryRouter>
        <AppShell onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(titlebarControlsState.props).toMatchObject({
      leftPosition: {
        left: 'calc(var(--shell-sidebar-workspace-anchor) + var(--shell-main-header-inset))'
      }
    })
  })

  it('keeps the titlebar controls mounted for collapsed non-chat views', async () => {
    shellSurfaceLayoutState.sidebarOpen = false
    const { AppShell } = await import('./app-shell')

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppShell embedTitlebarTools onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(screen.getByTestId('titlebar-controls')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show sidebar' })).toBeNull()
  })

  it('does not add a duplicate shell-level restore button on chat routes', async () => {
    shellSurfaceLayoutState.sidebarOpen = false
    const { AppShell } = await import('./app-shell')

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell embedTitlebarTools onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: 'Show sidebar' })).toBeNull()
  })

  it('does not render the shell-level restore button on header-owned page routes', async () => {
    shellSurfaceLayoutState.sidebarOpen = false
    const { AppShell } = await import('./app-shell')

    render(
      <MemoryRouter initialEntries={['/skills']}>
        <AppShell embedTitlebarTools onOpenSearch={vi.fn()} onOpenSettings={vi.fn()}>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: 'Show sidebar' })).toBeNull()
  })

  it('renders the fallback shell with surfaced sidebar chrome', async () => {
    const { Shell } = await import('../shell')
    const { container } = render(
      <Shell>
        <div>content</div>
      </Shell>
    )

    const root = container.firstElementChild
    const sidebar = container.querySelector('aside')

    expect(root?.className).toContain('bg-[var(--surface)]')
    expect(sidebar?.className).toContain('border-[var(--separator)]')
    expect(sidebar?.className).toContain('bg-[var(--surface)]')
  })
})

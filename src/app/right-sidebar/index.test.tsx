// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RightSidebarPane } from './index'

const sidebarState = vi.hoisted(() => ({
  activeTab: 'terminal',
  currentBranch: '',
  currentCwd: '/tmp/hermes',
  fileBrowserOpen: true,
  terminalTakeover: true
}))

const rightSidebarTranslations = {
  changeWorkingDirectory: 'Change working directory',
  clickToChangeFolder: 'Click to change folder',
  fileSystem: 'File System',
  noFolderSelected: 'No folder selected',
  openFolder: 'Open folder',
  openDifferentFolder: 'Open different folder',
  previewUnavailable: 'Preview unavailable',
  rightSidebar: 'Right Sidebar',
  terminal: 'Terminal'
} as const

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      rightSidebar: rightSidebarTranslations
    }
  })
}))

vi.mock('@/store/layout', () => ({
  $fileBrowserOpen: { get: () => sidebarState.fileBrowserOpen }
}))

vi.mock('@/store/preview', () => ({
  setCurrentSessionPreviewTarget: vi.fn()
}))

vi.mock('@/store/session', () => ({
  $currentBranch: { get: () => sidebarState.currentBranch },
  $currentCwd: { get: () => sidebarState.currentCwd }
}))

vi.mock('./store', () => ({
  $rightSidebarTab: { get: () => sidebarState.activeTab },
  $terminalTakeover: { get: () => sidebarState.terminalTakeover },
  setRightSidebarTab: vi.fn()
}))

vi.mock('./files/use-project-tree', () => ({
  useProjectTree: () => ({
    collapseAll: vi.fn(),
    collapseNonce: 0,
    data: [],
    loadChildren: vi.fn(),
    openState: {},
    refreshRoot: vi.fn(),
    rootError: null,
    rootLoading: false,
    setNodeOpen: vi.fn()
  })
}))

vi.mock('./files/tree', () => ({
  ProjectTree: () => <div data-testid="project-tree" />
}))

vi.mock('./terminal/persistent', () => ({
  TerminalSlot: () => <div data-testid="terminal-slot" />
}))

vi.mock('../shell/sidebar-label', () => ({
  SidebarPanelLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>
}))

vi.mock('@/components/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}))

vi.mock('@/components/ui/codicon', () => ({
  Codicon: ({ name }: { name: string }) => <span data-codicon={name} />
}))

vi.mock('@/components/ui/loader', () => ({
  Loader: () => <div data-testid="loader" />
}))

afterEach(() => {
  cleanup()
})

describe('RightSidebarPane titlebar tools', () => {
  it('does not rebuild the titlebar group on identical rerenders during terminal takeover', () => {
    const setTitlebarToolGroup = vi.fn()

    const rendered = render(
      <RightSidebarPane
        onActivateFile={vi.fn()}
        onActivateFolder={vi.fn()}
        onChangeCwd={vi.fn()}
        setTitlebarToolGroup={setTitlebarToolGroup}
      />
    )

    const initialCalls = setTitlebarToolGroup.mock.calls.length

    rendered.rerender(
      <RightSidebarPane
        onActivateFile={vi.fn()}
        onActivateFolder={vi.fn()}
        onChangeCwd={vi.fn()}
        setTitlebarToolGroup={setTitlebarToolGroup}
      />
    )

    expect(setTitlebarToolGroup).toHaveBeenCalledTimes(initialCalls)
  })
})

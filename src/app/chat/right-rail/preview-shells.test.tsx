// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatPreviewRail } from './preview'

const previewRailMock = vi.hoisted(() => ({
  closeRightRail: vi.fn(),
  closeRightRailTab: vi.fn(),
  layoutState: {
    activeTabId: 'preview'
  },
  previewState: {
    fileTabs: [
      {
        id: 'file:readme',
        target: { kind: 'file' as const, label: 'README.md', path: '/tmp/README.md', source: '/tmp/README.md' }
      }
    ],
    previewReloadRequest: 0,
    previewTarget: {
      kind: 'url' as const,
      label: 'Preview',
      source: 'http://127.0.0.1:4173',
      url: 'http://127.0.0.1:4173'
    }
  },
  selectRightRailTab: vi.fn()
}))

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@/store/layout', () => ({
  $rightRailActiveTabId: { get: () => previewRailMock.layoutState.activeTabId },
  RIGHT_RAIL_PREVIEW_TAB_ID: 'preview',
  selectRightRailTab: previewRailMock.selectRightRailTab
}))

vi.mock('@/store/preview', () => ({
  $filePreviewTabs: { get: () => previewRailMock.previewState.fileTabs },
  $previewReloadRequest: { get: () => previewRailMock.previewState.previewReloadRequest },
  $previewTarget: { get: () => previewRailMock.previewState.previewTarget },
  closeRightRail: previewRailMock.closeRightRail,
  closeRightRailTab: previewRailMock.closeRightRailTab
}))

vi.mock('./preview-pane', () => ({
  PreviewPane: ({ target }: { target: { label?: string } }) => <div data-testid="preview-pane">{target.label}</div>
}))

describe('chat preview rail HeroUI shells', () => {
  beforeEach(() => {
    previewRailMock.closeRightRail.mockReset()
    previewRailMock.closeRightRailTab.mockReset()
    previewRailMock.selectRightRailTab.mockReset()
    previewRailMock.layoutState.activeTabId = 'preview'
  })

  it('uses surfaced tabs and muted close actions', () => {
    const setTitlebarToolGroup = vi.fn()
    const { container } = render(<ChatPreviewRail setTitlebarToolGroup={setTitlebarToolGroup} />)

    const rail = container.querySelector('aside')
    const inactiveTab = screen.getByRole('tab', { name: 'README.md' }).parentElement

    expect(rail?.className).toContain('border-[var(--workbench-divider)]')
    expect(rail?.className).toContain('bg-[var(--workbench-panel-bg)]')
    expect(inactiveTab?.className).toContain('hover:bg-[var(--workbench-hover)]')
    expect(inactiveTab?.className).toContain('text-[var(--muted)]')
    expect(setTitlebarToolGroup).toHaveBeenCalledWith(
      'preview-rail',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'preview-rail-close',
          label: 'Close Preview'
        })
      ])
    )
  })
})

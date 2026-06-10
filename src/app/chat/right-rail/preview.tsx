import { useStore } from '@nanostores/react'
import { useEffect, useMemo } from 'react'

import type { SetTitlebarToolGroup } from '@/app/shell/titlebar-controls'
import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import {
  $rightRailActiveTabId,
  RIGHT_RAIL_PREVIEW_TAB_ID,
  type RightRailTabId,
  selectRightRailTab
} from '@/store/layout'
import {
  $filePreviewTabs,
  $previewReloadRequest,
  $previewTarget,
  closeRightRail,
  closeRightRailTab,
  type PreviewTarget
} from '@/store/preview'

import { PreviewPane } from './preview-pane'

export const PREVIEW_RAIL_MIN_WIDTH = '18rem'
export const PREVIEW_RAIL_MAX_WIDTH = '38rem'

const INTRINSIC = `clamp(${PREVIEW_RAIL_MIN_WIDTH}, 36vw, 32rem)`

// Track for <Pane id="preview">. Folds the intrinsic clamp with a min-floor
// against --chat-min-width so the chat surface never gets squeezed below it.
// Subtracts the project browser width so preview yields rather than crushing
// the chat when both right-side panes are open.
export const PREVIEW_RAIL_PANE_WIDTH = `min(${INTRINSIC}, max(0rem, calc(100vw - var(--pane-chat-sidebar-width) - var(--pane-file-browser-width, 0rem) - var(--chat-min-width))))`

interface ChatPreviewRailProps {
  onRestartServer?: (url: string, context?: string) => Promise<string>
  setTitlebarToolGroup?: SetTitlebarToolGroup
}

interface RailTab {
  id: RightRailTabId
  label: string
  target: PreviewTarget
}

function tabLabelFor(target: PreviewTarget): string {
  const value = target.label || target.path || target.source || target.url
  const tail = value.split(/[\\/]/).filter(Boolean).at(-1)

  return tail || value || 'Preview'
}

export function ChatPreviewRail({ onRestartServer, setTitlebarToolGroup }: ChatPreviewRailProps) {
  const previewReloadRequest = useStore($previewReloadRequest)
  const activeTabId = useStore($rightRailActiveTabId)
  const filePreviewTabs = useStore($filePreviewTabs)
  const previewTarget = useStore($previewTarget)

  const tabs = useMemo<readonly RailTab[]>(
    () => [
      ...(previewTarget ? [{ id: RIGHT_RAIL_PREVIEW_TAB_ID, label: 'Preview', target: previewTarget } as RailTab] : []),
      ...filePreviewTabs.map(({ id, target }) => ({ id, label: tabLabelFor(target), target }) as RailTab)
    ],
    [filePreviewTabs, previewTarget]
  )

  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? tabs[0]
  const showTabStrip = tabs.length > 1

  useEffect(() => {
    if (activeTab && activeTab.id !== activeTabId) {
      selectRightRailTab(activeTab.id)
    }
  }, [activeTab, activeTabId])

  useEffect(() => {
    if (!setTitlebarToolGroup || !activeTab) {
      return
    }

    setTitlebarToolGroup('preview-rail', [
      {
        icon: <Codicon name="close" />,
        id: 'preview-rail-close',
        label: showTabStrip ? `Close ${activeTab.label}` : 'Close preview pane',
        onSelect: () => {
          if (showTabStrip) {
            closeRightRailTab(activeTab.id)
            return
          }

          closeRightRail()
        },
        title: showTabStrip ? `Close ${activeTab.label}` : 'Close preview pane'
      }
    ])

    return () => setTitlebarToolGroup('preview-rail', [])
  }, [activeTab, setTitlebarToolGroup, showTabStrip])

  if (!activeTab) {
    return null
  }

  const isPreview = activeTab.id === RIGHT_RAIL_PREVIEW_TAB_ID

  return (
    <aside
      className="relative flex h-full w-full min-w-0 flex-col overflow-hidden border-l border-[var(--workbench-divider)] bg-[var(--workbench-panel-bg)] text-[var(--muted)] shadow-[inset_0.0625rem_0_0_color-mix(in_srgb,var(--foreground)_2.5%,transparent)] backdrop-blur-xl"
    >
      {showTabStrip ? (
        <div className="group/rail-tabs flex h-(--titlebar-height) shrink-0 border-b border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--workbench-panel-muted-bg)_94%,transparent)] backdrop-blur-xl">
          <div
            className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            {tabs.map(tab => {
              const active = tab.id === activeTab.id

              return (
                <div
                  className={cn(
                    'group/tab relative flex h-full min-w-0 max-w-48 shrink-0 items-center text-[0.675rem] font-medium [-webkit-app-region:no-drag] last:border-r last:border-[var(--workbench-divider)]',
                    active
                      ? 'bg-[var(--workbench-panel-bg)] text-foreground [--tab-bg:color-mix(in_srgb,var(--workbench-panel-bg)_94%,transparent)]'
                      : 'border-r border-[var(--workbench-divider)] text-[var(--muted)] [--tab-bg:color-mix(in_srgb,var(--workbench-panel-bg)_90%,transparent)] hover:bg-[var(--workbench-hover)] hover:text-foreground'
                  )}
                  key={tab.id}
                  onAuxClick={event => {
                    if (event.button !== 1) return
                    event.preventDefault()
                    closeRightRailTab(tab.id)
                  }}
                  onMouseDown={event => {
                    if (event.button === 1) event.preventDefault()
                  }}
                >
                  {active && (
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-[var(--workbench-panel-stroke)]" />
                  )}
                  <button
                    aria-selected={active}
                    className="flex h-full min-w-0 max-w-full items-center overflow-hidden pl-3 pr-3 text-left outline-none"
                    onClick={() => selectRightRailTab(tab.id)}
                    role="tab"
                    title={tab.label}
                    type="button"
                  >
                    <span className="block min-w-0 truncate">{tab.label}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <PreviewPane
          embedded
          onRestartServer={isPreview ? onRestartServer : undefined}
          reloadRequest={previewReloadRequest}
          setTitlebarToolGroup={setTitlebarToolGroup}
          target={activeTab.target}
        />
      </div>
    </aside>
  )
}

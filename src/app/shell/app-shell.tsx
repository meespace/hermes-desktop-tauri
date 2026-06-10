import { useStore } from '@nanostores/react'
import { useCallback, useEffect, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { useSyncExternalStore } from 'react'

import { PaneShell } from '@/components/pane-shell'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useI18n } from '@/i18n'
import {
  $fileBrowserOpen,
  $sidebarWidth,
  $sidebarOpen,
  FILE_BROWSER_DEFAULT_WIDTH,
  FILE_BROWSER_PANE_ID,
  setSidebarOpen
} from '@/store/layout'
import { $paneWidthOverride } from '@/store/panes'
import { $connection, $currentCwd, $defaultProjectDir, $gatewayState, setDefaultProjectDir } from '@/store/session'

import { StatusbarControls, type StatusbarItem } from './statusbar-controls'
import { TITLEBAR_HEIGHT, titlebarControlsPosition } from './titlebar'
import { TitlebarControls, type TitlebarTool } from './titlebar-controls'

interface AppShellProps {
  children: ReactNode
  commandCenterOpen?: boolean
  embedTitlebarTools?: boolean
  leftStatusbarItems?: readonly StatusbarItem[]
  leftTitlebarTools?: readonly TitlebarTool[]
  onOpenSettings: () => void
  onOpenSearch: () => void
  overlays?: ReactNode
  statusbarItems?: readonly StatusbarItem[]
  titlebarTools?: readonly TitlebarTool[]
}

// Renderer-side fallback so layout snaps even when the main-process fullscreen event
// hasn't landed yet (e.g. dev reloads, before the IPC bridge is wired).
function subscribeWindowSize(cb: () => void) {
  window.addEventListener('resize', cb)
  window.addEventListener('fullscreenchange', cb)

  return () => {
    window.removeEventListener('resize', cb)
    window.removeEventListener('fullscreenchange', cb)
  }
}

const viewportIsFullscreen = () =>
  window.innerWidth >= window.screen.width && window.innerHeight >= window.screen.height

const titlebarDragExclusionSelector = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[data-tauri-no-drag]',
  '[role="button"]'
].join(',')

function workspacePathFromCwd(cwd: string): string | null {
  const trimmed = cwd.trim()

  if (!trimmed || trimmed === '.') {
    return null
  }

  return trimmed
}

async function startCurrentWindowDrag() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().startDragging()
}

export function AppShell({
  children,
  commandCenterOpen = false,
  leftStatusbarItems,
  leftTitlebarTools,
  onOpenSettings,
  onOpenSearch,
  overlays,
  statusbarItems,
  titlebarTools
}: AppShellProps) {
  const { t } = useI18n()
  const sidebarOpen = useStore($sidebarOpen)
  const sidebarWidth = useStore($sidebarWidth)
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const fileBrowserWidthOverride = useStore($paneWidthOverride(FILE_BROWSER_PANE_ID))
  const connection = useStore($connection)
  const currentCwd = useStore($currentCwd).trim()
  const defaultProjectDir = useStore($defaultProjectDir).trim()
  const gatewayState = useStore($gatewayState)
  const viewportFullscreen = useSyncExternalStore(subscribeWindowSize, viewportIsFullscreen, () => false)
  const isFullscreen = Boolean(connection?.isFullscreen) || viewportFullscreen
  const titlebarControls = titlebarControlsPosition(connection?.windowButtonPosition, isFullscreen)
  // Width Windows/Linux reserve for the OS-painted min/max/close overlay (zero
  // on macOS, where window controls sit on the left and are reported via
  // windowButtonPosition instead). The right tool cluster has to clear them.
  const nativeOverlayWidth = connection?.nativeOverlayWidth ?? 0
  const titlebarToolsRight = nativeOverlayWidth > 0 ? `${nativeOverlayWidth}px` : '0.75rem'

  const titlebarContentInset = sidebarOpen
    ? 0
    : titlebarControls.left + TITLEBAR_HEIGHT + Math.round(TITLEBAR_HEIGHT / 2)

  // The static system cluster (haptics, profiles, settings, right-sidebar) is
  // hardcoded in TitlebarControls. Pane-supplied tools (preview's group) render
  // in a separate cluster anchored further left.
  //
  // Width math has to include the `gap-x-1` (0.25rem) between buttons:
  // N buttons + (N - 1) inner gaps, plus one extra 0.25rem of breathing room
  // between the pane-tool cluster and the system cluster so they don't sit
  // flush against each other. Modeled as N gaps (N - 1 inner + 1 trailing)
  // to keep the formula generic for any pane-tool count.
  const SYSTEM_TOOL_COUNT = 4
  const paneToolCount = titlebarTools?.filter(tool => !tool.hidden).length ?? 0
  const systemToolsWidth = `calc(${SYSTEM_TOOL_COUNT} * (var(--titlebar-control-size) + 0.25rem))`

  const fileBrowserWidth =
    fileBrowserWidthOverride !== undefined ? `${fileBrowserWidthOverride}px` : FILE_BROWSER_DEFAULT_WIDTH

  // Where the pane-tool cluster's right edge sits, measured from the inner
  // titlebar padding (--titlebar-tools-right). Two anchors:
  //   - file-browser closed → flush against static cluster's left edge
  //   - file-browser open   → flush against the file-browser pane's left edge
  //                           (= preview pane's right edge)
  const previewToolbarGap = fileBrowserOpen ? fileBrowserWidth : systemToolsWidth
  const workspacePath = workspacePathFromCwd(currentCwd) ?? workspacePathFromCwd(defaultProjectDir)
  const gatewayBadge = gatewayState === 'open' ? t.sidebar.gatewayLocal : gatewayState === 'opening' ? t.sidebar.gatewayStarting : t.sidebar.gatewayOffline
  const leftHeaderPosition = {
    left: 'calc(var(--shell-sidebar-workspace-anchor) + var(--shell-main-header-inset))'
  }

  // Used by the drag region to know where the rightmost interactive element
  // ends. When pane tools are present, that's `gap + paneCount * controlSize
  // + paneCount * 0.25rem` (the leftmost button is at `tools-right + gap +
  // paneCount * (size + gap-x-1)`). Otherwise the static cluster's footprint
  // is enough.
  const titlebarToolsWidth =
    paneToolCount > 0
      ? `calc(${previewToolbarGap} + ${paneToolCount} * (var(--titlebar-control-size) + 0.25rem))`
      : systemToolsWidth
  const handleTitlebarMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.detail > 1) {
        return
      }

      const target = event.target instanceof Element ? event.target : null
      if (target?.closest(titlebarDragExclusionSelector)) {
        return
      }

      void startCurrentWindowDrag().catch(() => undefined)
    },
    []
  )

  useEffect(() => {
    if (workspacePath || typeof window === 'undefined') {
      return
    }

    const settings = window.hermesDesktop?.settings

    if (!settings) {
      return
    }

    let alive = true

    void settings.getDefaultProjectDir().then(result => {
      if (!alive) {
        return
      }

      setDefaultProjectDir(result.dir ?? '')
    })

    return () => {
      alive = false
    }
  }, [workspacePath])

  return (
    <SidebarProvider
      className="h-screen min-h-0 flex-col bg-[var(--workbench-shell-bg)] text-[var(--foreground)]"
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
      style={
        {
          // Alias for shadcn <Sidebar> descendants. Resolves to the chat-sidebar
          // pane track via PaneShell's emitted --pane-chat-sidebar-width.
          '--sidebar-width': 'var(--pane-chat-sidebar-width)',
          '--titlebar-height': `${TITLEBAR_HEIGHT}px`,
          '--titlebar-content-inset': `${titlebarContentInset}px`,
          '--titlebar-controls-left': `${titlebarControls.left}px`,
          '--titlebar-controls-top': `${titlebarControls.top}px`,
          '--titlebar-tools-right': titlebarToolsRight,
          '--titlebar-tools-width': titlebarToolsWidth,
          '--shell-sidebar-workspace-anchor': `${sidebarWidth}px`,
          // Mirrors the chat workspace header's left padding:
          // outer shell p-1 (0.25rem) + card border (1px) + header px-2 (0.5rem).
          '--shell-main-header-inset': 'calc(0.25rem + 1px + 0.5rem)',
          // Anchor for the pane-tool cluster's right edge in TitlebarControls.
          // Sourced from the layout store rather than the PaneShell-emitted
          // --pane-*-width vars because the titlebar is a sibling of PaneShell
          // and CSS variables resolve at the consumer's scope.
          '--shell-preview-toolbar-gap': previewToolbarGap
        } as CSSProperties
      }
    >
      <div
        aria-label="Window titlebar"
        className="pointer-events-auto fixed inset-x-0 top-0 z-60 h-(--titlebar-height) cursor-default select-none border-b border-[color-mix(in_srgb,var(--workbench-divider)_42%,transparent)] bg-[color-mix(in_srgb,var(--workbench-shell-bg)_94%,transparent)] shadow-[0_1px_0_color-mix(in_srgb,var(--foreground)_2%,transparent)] backdrop-blur-xl [-webkit-app-region:drag]"
        data-tauri-drag-region
        onMouseDown={handleTitlebarMouseDown}
        role="presentation"
      />

      <TitlebarControls
        commandCenterOpen={commandCenterOpen}
        hideGlobalTools={false}
        leftContext={
          <div
            aria-label="Workspace context"
            className="pointer-events-none flex h-[var(--titlebar-control-height)] min-w-0 items-center gap-4 overflow-hidden text-[0.69rem] text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]"
          >
            <span className="shrink-0">
              <span className="text-[color-mix(in_srgb,var(--foreground)_46%,transparent)]">
                {t.shell.workspaceModeLabel}
              </span>
              <span aria-hidden="true" className="px-1 text-[color-mix(in_srgb,var(--foreground)_28%,transparent)]">
                :
              </span>
              <span className="font-semibold text-[var(--accent)]">{gatewayBadge}</span>
            </span>
            <span className="min-w-0 truncate" title={workspacePath ?? t.sidebar.workspaceNone}>
              <span className="shrink-0 text-[color-mix(in_srgb,var(--foreground)_46%,transparent)]">
                {t.shell.workspacePathLabel}
              </span>
              <span aria-hidden="true" className="px-1 text-[color-mix(in_srgb,var(--foreground)_28%,transparent)]">
                :
              </span>
              <span className="text-[color-mix(in_srgb,var(--foreground)_78%,transparent)]">
                {workspacePath ?? t.sidebar.workspaceNone}
              </span>
            </span>
          </div>
        }
        leftPosition={leftHeaderPosition}
        leftTools={leftTitlebarTools}
        onOpenSearch={onOpenSearch}
        onOpenSettings={onOpenSettings}
        tools={titlebarTools}
      />

      <main className="relative z-3 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--workbench-shell-bg)] pt-(--titlebar-height) transition-none">
        <PaneShell className="min-h-0 flex-1">
          {children}
        </PaneShell>

        <StatusbarControls items={statusbarItems} leftItems={leftStatusbarItems} />
      </main>

      {overlays}
    </SidebarProvider>
  )
}

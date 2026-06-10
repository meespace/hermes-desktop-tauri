import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'

import type { SetTitlebarToolGroup, TitlebarTool } from '@/app/shell/titlebar-controls'
import { ErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { cn } from '@/lib/utils'
import { $fileBrowserOpen } from '@/store/layout'
import { notifyError } from '@/store/notifications'
import { setCurrentSessionPreviewTarget } from '@/store/preview'
import { $currentBranch, $currentCwd } from '@/store/session'

import { SidebarPanelLabel } from '../shell/sidebar-label'

import { ProjectTree } from './files/tree'
import { useProjectTree } from './files/use-project-tree'
import { $rightSidebarTab, $terminalTakeover, type RightSidebarTabId, setRightSidebarTab } from './store'
import { TerminalSlot } from './terminal/persistent'

interface RightSidebarPaneProps {
  onActivateFile: (path: string) => void
  onActivateFolder: (path: string) => void
  onChangeCwd: (path: string) => Promise<void> | void
  setTitlebarToolGroup?: SetTitlebarToolGroup
}

interface RightSidebarTab {
  icon: string
  id: RightSidebarTabId
  labelKey: 'fileSystem' | 'terminal'
}

const RIGHT_SIDEBAR_TABS: readonly RightSidebarTab[] = [
  { id: 'files', labelKey: 'fileSystem', icon: 'files' },
  { id: 'terminal', labelKey: 'terminal', icon: 'terminal' }
]

export function RightSidebarPane({
  onActivateFile,
  onActivateFolder,
  onChangeCwd,
  setTitlebarToolGroup
}: RightSidebarPaneProps) {
  const { t } = useI18n()
  const activeTab = useStore($rightSidebarTab)
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const terminalTakeover = useStore($terminalTakeover)
  const currentBranch = useStore($currentBranch).trim()
  const currentCwd = useStore($currentCwd).trim()
  const hasCwd = currentCwd.length > 0

  const cwdName = hasCwd
    ? (currentCwd
        .split(/[\\/]+/)
        .filter(Boolean)
        .pop() ?? currentCwd)
    : t.rightSidebar.noFolderSelected

  const { collapseAll, collapseNonce, data, loadChildren, openState, refreshRoot, rootError, rootLoading, setNodeOpen } =
    useProjectTree(currentCwd)

  const canCollapse = Object.values(openState).some(Boolean)
  const effectiveTab: RightSidebarTabId = terminalTakeover ? 'files' : activeTab
  const tabs = useMemo(
    () => (terminalTakeover ? RIGHT_SIDEBAR_TABS.filter(tab => tab.id !== 'terminal') : RIGHT_SIDEBAR_TABS),
    [terminalTakeover]
  )

  const chooseFolder = async () => {
    const selected = await window.hermesDesktop?.selectPaths({
      defaultPath: hasCwd ? currentCwd : undefined,
      directories: true,
      multiple: false,
      title: t.rightSidebar.changeWorkingDirectory
    })

    if (selected?.[0]) {
      await onChangeCwd(selected[0])
    }
  }

  const previewFile = async (path: string) => {
    try {
      const preview = await normalizeOrLocalPreviewTarget(path, currentCwd || undefined)

      if (!preview) {
        throw new Error(`Could not preview ${path}`)
      }

      setCurrentSessionPreviewTarget(preview, 'file-browser', path)
    } catch (error) {
      notifyError(error, t.rightSidebar.previewUnavailable)
    }
  }

  useEffect(() => {
    if (!setTitlebarToolGroup || !fileBrowserOpen) {
      return
    }

    const tools: TitlebarTool[] = tabs.map(tab => {
      const label = t.rightSidebar[tab.labelKey]

      return {
        active: tab.id === effectiveTab,
        icon: <Codicon name={tab.icon} />,
        id: `right-sidebar-${tab.id}`,
        label,
        onSelect: () => setRightSidebarTab(tab.id),
        title: label
      }
    })

    setTitlebarToolGroup('right-sidebar', tools)

    return () => setTitlebarToolGroup('right-sidebar', [])
  }, [effectiveTab, fileBrowserOpen, setTitlebarToolGroup, t.rightSidebar, tabs])

  return (
    <aside
      aria-label={t.rightSidebar.rightSidebar}
      className="relative flex h-full w-full min-w-0 flex-col overflow-hidden border-l border-[var(--workbench-divider)] bg-[var(--workbench-panel-bg)] text-[var(--muted)] shadow-[inset_0.0625rem_0_0_color-mix(in_srgb,var(--foreground)_2.5%,transparent)] backdrop-blur-xl"
    >
      {effectiveTab === 'terminal' ? (
        <TerminalSlot />
      ) : (
        <FilesystemTab
          branch={currentBranch}
          canCollapse={canCollapse}
          collapseNonce={collapseNonce}
          cwd={currentCwd}
          cwdName={cwdName}
          data={data}
          error={rootError}
          hasCwd={hasCwd}
          loading={rootLoading}
          onActivateFile={onActivateFile}
          onActivateFolder={onActivateFolder}
          onChangeFolder={chooseFolder}
          onCollapseAll={collapseAll}
          onLoadChildren={loadChildren}
          onNodeOpenChange={setNodeOpen}
          onPreviewFile={previewFile}
          onRefresh={() => void refreshRoot()}
          openState={openState}
        />
      )}
    </aside>
  )
}

interface FilesystemTabProps extends FileTreeBodyProps {
  branch: string
  canCollapse: boolean
  cwdName: string
  hasCwd: boolean
  onChangeFolder: () => Promise<void> | void
  onCollapseAll: () => void
  onRefresh: () => void
}

const HEADER_ACTION_CLASS =
  'size-7 shrink-0 rounded-[calc(var(--radius)*1.5)] border border-transparent text-[var(--muted)] shadow-none transition-[background-color,border-color,color,box-shadow] hover:border-[var(--border)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--focus)_22%,transparent)]'

const HEADER_ACTION_REVEAL_CLASS = `${HEADER_ACTION_CLASS} pointer-events-none opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within/project-header:pointer-events-auto group-focus-within/project-header:opacity-100 group-hover/project-header:pointer-events-auto group-hover/project-header:opacity-100`

function FilesystemTab({
  branch,
  canCollapse,
  collapseNonce,
  cwd,
  cwdName,
  data,
  error,
  hasCwd,
  loading,
  onActivateFile,
  onActivateFolder,
  onChangeFolder,
  onCollapseAll,
  onLoadChildren,
  onNodeOpenChange,
  onPreviewFile,
  onRefresh,
  openState
}: FilesystemTabProps) {
  const { t } = useI18n()

  return (
    <div className="group/project-header flex min-h-0 flex-1 flex-col">
      <RightSidebarSectionHeader>
        <button
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[calc(var(--radius)*1.25)] border border-transparent px-1 text-left text-[var(--foreground)]/84 transition-[background-color,border-color,color] hover:border-[var(--border)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
          onClick={() => void onChangeFolder()}
          title={hasCwd ? `${cwd} - ${t.rightSidebar.clickToChangeFolder}` : t.rightSidebar.openFolder}
          type="button"
        >
          <SidebarPanelLabel>{cwdName}</SidebarPanelLabel>
          {branch ? (
            <span className="ml-auto hidden min-w-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted)] shadow-[var(--field-shadow)] sm:inline-flex">
              <Codicon className="shrink-0" name="git-branch" size="0.6875rem" />
              <span className="truncate">{branch}</span>
            </span>
          ) : null}
        </button>
        <Button
          aria-label={t.rightSidebar.openFolder}
          className={HEADER_ACTION_CLASS}
          onClick={() => void onChangeFolder()}
          size="icon"
          title={hasCwd ? t.rightSidebar.openDifferentFolder : t.rightSidebar.openFolder}
          variant="ghost"
        >
          <Codicon name="folder-opened" size="0.8125rem" />
        </Button>
        <Button
          aria-label={t.rightSidebar.collapseAllFolders}
          className={HEADER_ACTION_REVEAL_CLASS}
          disabled={!hasCwd || !canCollapse}
          onClick={onCollapseAll}
          size="icon"
          title={t.rightSidebar.collapseAllFolders}
          variant="ghost"
        >
          <Codicon name="collapse-all" size="0.8125rem" />
        </Button>
        <Button
          aria-label={t.rightSidebar.refreshTree}
          className={HEADER_ACTION_REVEAL_CLASS}
          disabled={!hasCwd || loading}
          onClick={onRefresh}
          size="icon"
          title={t.rightSidebar.refreshTree}
          variant="ghost"
        >
          <Codicon name="refresh" size="0.8125rem" spinning={loading} />
        </Button>
      </RightSidebarSectionHeader>
      <FileTreeBody
        collapseNonce={collapseNonce}
        cwd={cwd}
        data={data}
        error={error}
        loading={loading}
        onActivateFile={onActivateFile}
        onActivateFolder={onActivateFolder}
        onLoadChildren={onLoadChildren}
        onNodeOpenChange={onNodeOpenChange}
        onPreviewFile={onPreviewFile}
        openState={openState}
      />
    </div>
  )
}

export function RightSidebarSectionHeader({ children }: { children: ReactNode }) {
  return <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--separator)] px-2.5">{children}</div>
}

interface FileTreeBodyProps {
  collapseNonce: number
  cwd: string
  data: ReturnType<typeof useProjectTree>['data']
  error: string | null
  loading: boolean
  onActivateFile: (path: string) => void
  onActivateFolder: (path: string) => void
  onLoadChildren: (id: string) => void | Promise<void>
  onNodeOpenChange: (id: string, open: boolean) => void
  onPreviewFile?: (path: string) => void
  openState: ReturnType<typeof useProjectTree>['openState']
}

function FileTreeBody({
  collapseNonce,
  cwd,
  data,
  error,
  loading,
  onActivateFile,
  onActivateFolder,
  onLoadChildren,
  onNodeOpenChange,
  onPreviewFile,
  openState
}: FileTreeBodyProps) {
  const { t } = useI18n()

  if (!cwd) {
    return <EmptyState body={t.rightSidebar.noProjectDescription} title={t.rightSidebar.noProject} />
  }

  if (error) {
    return <EmptyState body={t.rightSidebar.unreadableDescription(error)} title={t.rightSidebar.unreadable} />
  }

  if (loading && data.length === 0) {
    return <FileTreeLoadingState />
  }

  if (data.length === 0) {
    return <EmptyState body={t.rightSidebar.emptyDescription} title={t.rightSidebar.empty} />
  }

  return (
    <ErrorBoundary
      fallback={({ reset }) => (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <EmptyState body={t.rightSidebar.treeErrorDescription} title={t.rightSidebar.treeError} />
          <button
            className="text-[0.68rem] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            onClick={reset}
            type="button"
          >
            {t.rightSidebar.tryAgain}
          </button>
        </div>
      )}
      key={cwd}
      label="file-tree"
    >
      <ProjectTree
        collapseNonce={collapseNonce}
        cwd={cwd}
        data={data}
        onActivateFile={onActivateFile}
        onActivateFolder={onActivateFolder}
        onLoadChildren={onLoadChildren}
        onNodeOpenChange={onNodeOpenChange}
        onPreviewFile={onPreviewFile}
        openState={openState}
      />
    </ErrorBoundary>
  )
}

function FileTreeLoadingState() {
  const { t } = useI18n()

  return (
    <div aria-label={t.rightSidebar.loadingFileTree} className="grid min-h-0 flex-1 place-items-center px-3" role="status">
      <Loader
        aria-hidden="true"
        className="size-8 text-[var(--muted)]"
        pathSteps={180}
        role="presentation"
        strokeScale={0.68}
        type="spiral-search"
      />
    </div>
  )
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{title}</div>
      <div className="text-[0.68rem] leading-relaxed text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]">
        {body}
      </div>
    </div>
  )
}

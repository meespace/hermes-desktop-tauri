import {
  type AppendMessage,
  AssistantRuntimeProvider,
  ExportedMessageRepository,
  type ThreadMessage
} from '@assistant-ui/react'
import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import type * as React from 'react'
import { Suspense, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { Backdrop } from '@/components/Backdrop'
import { PromptOverlays } from '@/components/prompt-overlays'
import { Thread } from '@/components/assistant-ui/thread'
import { NotificationStack } from '@/components/notifications'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { getGlobalModelOptions, type HermesGateway } from '@/hermes'
import { useI18n } from '@/i18n'
import type { ChatMessage } from '@/lib/chat-messages'
import { quickModelOptions, sessionTitle, toRuntimeMessage } from '@/lib/chat-runtime'
import { resolveAssistantDisplayName } from '@/lib/chat-speakers'
import { useIncrementalExternalStoreRuntime } from '@/lib/incremental-external-store-runtime'
import { cn } from '@/lib/utils'
import type { ComposerAttachment } from '@/store/composer'
import { $pinnedSessionIds, $sidebarOpen, toggleSidebarOpen } from '@/store/layout'
import { $activeProfile, $gatewaySwapTarget } from '@/store/profile'
import {
  $activeSessionId,
  $awaitingResponse,
  $busy,
  $contextSuggestions,
  $currentCwd,
  $currentModel,
  $currentProvider,
  $freshDraftReady,
  $gatewayState,
  $introPersonality,
  $introSeed,
  $messages,
  $selectedStoredSessionId,
  $sessions
} from '@/store/session'
import type { ModelOptionsResponse } from '@/types/hermes'

import { routeSessionId } from '../routes'
import type { TitlebarTool } from '../shell/titlebar-controls'
import { titlebarButtonClass } from '../shell/titlebar'
import { ChatDropOverlay } from './chat-drop-overlay'
import { ChatBar, ChatBarFallback } from './composer'
import { requestComposerInsert, requestComposerInsertRefs } from './composer/focus'
import {
  droppedFileInlineRef,
  type SessionDragPayload,
  sessionInlineRef
} from './composer/inline-refs'
import type { ChatBarState } from './composer/types'
import type { DroppedFile } from './hooks/use-composer-actions'
import { useFileDropZone } from './hooks/use-file-drop-zone'
import { SessionActionsMenu } from './sidebar/session-actions-menu'
import { lastVisibleMessageIsUser, threadLoadingState } from './thread-loading'
import { ChatSwapOverlay } from './chat-swap-overlay'

interface ChatViewProps extends Omit<React.ComponentProps<'div'>, 'onSubmit'> {
  gateway: HermesGateway | null
  onToggleSelectedPin: () => void
  onDeleteSelectedSession: () => void
  onCancel: () => Promise<void> | void
  onAddContextRef: (refText: string, label?: string, detail?: string) => void
  onAddUrl: (url: string) => void
  onBranchInNewChat: (messageId: string) => void
  maxVoiceRecordingSeconds?: number
  onAttachImageBlob: (blob: Blob) => Promise<boolean | void> | boolean | void
  onAttachDroppedItems: (candidates: DroppedFile[]) => Promise<boolean | void> | boolean | void
  onPasteClipboardImage: () => void
  onPickFiles: () => void
  onPickFolders: () => void
  onPickImages: () => void
  onRemoveAttachment: (id: string) => void
  onSteer: (text: string) => Promise<boolean> | boolean
  onSubmit: (
    text: string,
    options?: { attachments?: ComposerAttachment[]; fromQueue?: boolean }
  ) => Promise<boolean> | boolean
  onThreadMessagesChange: (messages: readonly ThreadMessage[]) => void
  onEdit: (message: AppendMessage) => Promise<void>
  onReload: (parentId: string | null) => Promise<void>
  onTranscribeAudio?: (audio: Blob) => Promise<string>
  onOpenSettings: () => void
  titlebarTools?: readonly TitlebarTool[]
}

interface ChatHeaderProps {
  activeSessionId: null | string
  isRoutedSessionView: boolean
  onDeleteSelectedSession: () => void
  onToggleSelectedPin: () => void
  selectedSessionId: null | string
}

function formatUpdatedLabel(unixSeconds?: number | null): string {
  if (!unixSeconds) {
    return 'Updated just now'
  }

  const deltaSeconds = Math.max(0, Math.round(Date.now() / 1000 - unixSeconds))

  if (deltaSeconds < 60) {
    return 'Updated just now'
  }

  if (deltaSeconds < 3600) {
    return `Updated ${Math.round(deltaSeconds / 60)}m ago`
  }

  if (deltaSeconds < 86400) {
    return `Updated ${Math.round(deltaSeconds / 3600)}h ago`
  }

  return `Updated ${Math.round(deltaSeconds / 86400)}d ago`
}

function ChatHeader({
  activeSessionId,
  isRoutedSessionView,
  onDeleteSelectedSession,
  onToggleSelectedPin,
  selectedSessionId
}: ChatHeaderProps) {
  const { t } = useI18n()
  const sessions = useStore($sessions)
  const pinnedSessionIds = useStore($pinnedSessionIds)
  const sidebarOpen = useStore($sidebarOpen)
  const activeStoredSession = sessions.find(session => session.id === selectedSessionId) || null
  const title = activeStoredSession ? sessionTitle(activeStoredSession) : 'New session'
  const selectedIsPinned = selectedSessionId ? pinnedSessionIds.includes(selectedSessionId) : false
  const workspaceLabel = activeStoredSession?.cwd?.split(/[\\/]/).filter(Boolean).pop() || 'Workspace'
  const updatedLabel = formatUpdatedLabel(activeStoredSession?.last_active ?? activeStoredSession?.started_at)
  const sourceLabel = (activeStoredSession?.source || 'local').toUpperCase()

  return (
    <header
      className={cn(
        'pointer-events-auto relative z-3 flex h-[var(--titlebar-height)] shrink-0 items-center border-b border-[color-mix(in_srgb,var(--workbench-divider)_38%,transparent)] bg-transparent px-2 [-webkit-app-region:drag]',
        isRoutedSessionView && 'shadow-none'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 [-webkit-app-region:no-drag]">
          {!sidebarOpen ? (
            <button
              aria-label={t.shell.showSidebar}
              className={cn(titlebarButtonClass, 'grid place-items-center shrink-0')}
              onClick={() => toggleSidebarOpen()}
              title={t.shell.showSidebar}
              type="button"
            >
              <Codicon name="layout-sidebar-left" size="0.82rem" />
            </button>
          ) : null}
          <SessionActionsMenu
            align="start"
            onDelete={selectedSessionId ? onDeleteSelectedSession : undefined}
            onPin={selectedSessionId ? onToggleSelectedPin : undefined}
            pinned={selectedIsPinned}
            sessionId={selectedSessionId || activeSessionId || ''}
            sideOffset={8}
            title={title}
          >
            <Button
              className="h-7 min-w-0 items-center gap-1.5 rounded-[0.5rem] border border-transparent bg-transparent px-1.5 py-0 text-left text-[color-mix(in_srgb,var(--foreground)_82%,transparent)] transition-[background-color,border-color,color] hover:bg-[var(--workbench-hover)] hover:text-foreground data-[state=open]:bg-[var(--workbench-hover)] data-[state=open]:text-foreground"
              type="button"
              variant="ghost"
            >
              <span
                aria-hidden="true"
                className="block size-2 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_8%,transparent)]"
              />
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <h2 className="max-w-[34rem] truncate text-[0.82rem] font-semibold leading-none tracking-[-0.02em]">
                  {title}
                </h2>
                <span className="hidden truncate text-[0.63rem] font-normal text-[color-mix(in_srgb,var(--foreground)_46%,transparent)] md:block">
                  {updatedLabel}
                </span>
                <Codicon className="shrink-0 text-[var(--muted)]" name="chevron-down" size="0.72rem" />
              </span>
            </Button>
          </SessionActionsMenu>
        </div>
        <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 [-webkit-app-region:no-drag]">
          <div className="flex min-w-0 items-center justify-end gap-1.5 overflow-hidden">
            <span className="hidden min-w-0 max-w-[7rem] items-center rounded-full bg-[color-mix(in_srgb,var(--foreground)_3.5%,transparent)] px-2 text-[0.6rem] font-medium text-[color-mix(in_srgb,var(--foreground)_58%,transparent)] min-[46rem]:inline-flex">
              <span className="truncate">{workspaceLabel}</span>
            </span>
            <span className="hidden shrink-0 items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] px-2 text-[0.6rem] font-semibold text-[var(--accent)] min-[36rem]:inline-flex">
              {sourceLabel}
            </span>
            {selectedIsPinned ? (
              <span className="hidden size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] text-[var(--muted)] min-[42rem]:grid">
                <Codicon name="pinned" size="0.72rem" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

export function ChatView({
  className,
  gateway,
  onToggleSelectedPin,
  onDeleteSelectedSession,
  onCancel,
  onAddContextRef,
  onAddUrl,
  onAttachImageBlob,
  onAttachDroppedItems,
  onBranchInNewChat,
  maxVoiceRecordingSeconds,
  onPasteClipboardImage,
  onPickFiles,
  onPickFolders,
  onPickImages,
  onOpenSettings,
  onRemoveAttachment,
  onSteer,
  onSubmit,
  onThreadMessagesChange,
  onEdit,
  onReload,
  onTranscribeAudio
}: ChatViewProps) {
  const location = useLocation()
  const activeSessionId = useStore($activeSessionId)
  const awaitingResponse = useStore($awaitingResponse)
  const busy = useStore($busy)
  const contextSuggestions = useStore($contextSuggestions)
  const currentCwd = useStore($currentCwd)
  const currentModel = useStore($currentModel)
  const currentProvider = useStore($currentProvider)
  const freshDraftReady = useStore($freshDraftReady)
  const gatewayState = useStore($gatewayState)
  const gatewayOpen = gatewayState === 'open'
  const gatewaySwapTarget = useStore($gatewaySwapTarget)
  const activeProfile = useStore($activeProfile)
  const introPersonality = useStore($introPersonality)
  const introSeed = useStore($introSeed)
  const messages = useStore($messages)
  const selectedSessionId = useStore($selectedStoredSessionId)
  const sessions = useStore($sessions)
  const runtimeMessageCacheRef = useRef(new WeakMap<ChatMessage, ThreadMessage>())
  const isRoutedSessionView = Boolean(routeSessionId(location.pathname))
  const selectedStoredSession = sessions.find(session => session.id === selectedSessionId) || null
  const assistantDisplayName = resolveAssistantDisplayName(selectedStoredSession?.profile || activeProfile)

  const showIntro =
    freshDraftReady && !isRoutedSessionView && !selectedSessionId && !activeSessionId && messages.length === 0

  // Session is still loading if the route references a session we haven't
  // resumed yet. Once `activeSessionId` is set (runtime has resumed), the
  // session exists — even if it has zero messages (a brand-new routed
  // session). The flicker where `busy` flips true briefly during hydrate
  // is handled by `threadLoadingState`'s last-visible-user gate.
  const loadingSession = isRoutedSessionView && messages.length === 0 && !activeSessionId
  const threadLoading = threadLoadingState(loadingSession, busy, awaitingResponse, lastVisibleMessageIsUser(messages))
  const showChatBar = !loadingSession
  const threadKey = selectedSessionId || activeSessionId || (isRoutedSessionView ? location.pathname : 'new')

  const modelOptionsQuery = useQuery<ModelOptionsResponse>({
    queryKey: ['model-options', activeSessionId || 'global'],
    queryFn: () => {
      if (!activeSessionId) {
        return getGlobalModelOptions()
      }

      if (!gateway) {
        throw new Error('Hermes gateway unavailable')
      }

      return gateway.request<ModelOptionsResponse>('model.options', { session_id: activeSessionId })
    },
    enabled: gatewayOpen
  })

  const quickModels = useMemo(
    () => quickModelOptions(modelOptionsQuery.data, currentProvider, currentModel),
    [currentModel, currentProvider, modelOptionsQuery.data]
  )

  const chatBarState = useMemo<ChatBarState>(
    () => ({
      model: {
        model: currentModel,
        provider: currentProvider,
        canSwitch: gatewayOpen,
        loading: !gatewayOpen || (!currentModel && !currentProvider),
        quickModels
      },
      tools: {
        enabled: true,
        label: 'Add context',
        suggestions: contextSuggestions
      },
      voice: {
        enabled: true,
        active: false
      }
    }),
    [contextSuggestions, currentModel, currentProvider, gatewayOpen, quickModels]
  )

  const runtimeMessageRepository = useMemo(() => {
    const items: { message: ThreadMessage; parentId: string | null }[] = []
    const branchParentByGroup = new Map<string, string | null>()
    let visibleParentId: string | null = null
    let headId: string | null = null

    for (const message of messages) {
      let parentId = visibleParentId

      if (message.role === 'assistant' && message.branchGroupId) {
        if (!branchParentByGroup.has(message.branchGroupId)) {
          branchParentByGroup.set(message.branchGroupId, visibleParentId)
        }

        parentId = branchParentByGroup.get(message.branchGroupId) ?? null
      }

      const cachedMessage = runtimeMessageCacheRef.current.get(message)
      const runtimeMessage = cachedMessage ?? toRuntimeMessage(message)

      if (!cachedMessage) {
        runtimeMessageCacheRef.current.set(message, runtimeMessage)
      }

      items.push({ message: runtimeMessage, parentId })

      if (!message.hidden) {
        visibleParentId = message.id
        headId = message.id
      }
    }

    return ExportedMessageRepository.fromBranchableArray(items, { headId })
  }, [messages])

  const runtime = useIncrementalExternalStoreRuntime<ThreadMessage>({
    messageRepository: runtimeMessageRepository,
    isRunning: busy,
    setMessages: onThreadMessagesChange,
    onNew: async () => {
      // Submission is handled explicitly by ChatBar.
      // Keeping this no-op avoids duplicate prompt.submit calls.
    },
    onEdit,
    onCancel: async () => onCancel(),
    onReload
  })

  // Drop files anywhere in the conversation area, not just on the composer
  // input — appending the same inline `@file:` ref chips the composer drop
  // produces (vs. attachment cards) so both surfaces behave identically.
  const onDropFiles = useCallback(
    (candidates: DroppedFile[]) => {
      const refs = candidates
        .map(candidate => droppedFileInlineRef(candidate, currentCwd))
        .filter((ref): ref is string => Boolean(ref))

      if (refs.length) {
        requestComposerInsert(refs.join(' '), { mode: 'inline', target: 'main' })
      }
    },
    [currentCwd]
  )

  const onDropSession = useCallback((session: SessionDragPayload) => {
    requestComposerInsertRefs([sessionInlineRef(session)], { target: 'main' })
  }, [])

  const { dragKind, dropHandlers } = useFileDropZone({ enabled: showChatBar, onDropFiles, onDropSession })

  return (
    <div
      className={cn(
        'relative isolate flex h-full min-w-0 flex-col overflow-hidden bg-[var(--workbench-shell-bg)]',
        className
      )}
    >
      <Backdrop />
      <NotificationStack />
      <div className="relative min-h-0 flex-1 p-1">
        <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[0.72rem] border border-[color-mix(in_srgb,var(--workbench-panel-stroke)_82%,transparent)] bg-[var(--workbench-panel-bg)] shadow-none">
          <ChatHeader
            activeSessionId={activeSessionId}
            isRoutedSessionView={isRoutedSessionView}
            onDeleteSelectedSession={onDeleteSelectedSession}
            onToggleSelectedPin={onToggleSelectedPin}
            selectedSessionId={selectedSessionId}
          />
          <PromptOverlays />

          <div
            className="relative min-h-0 max-w-full flex-1 overflow-hidden bg-[var(--workbench-canvas-bg)] contain-[layout_paint]"
            {...dropHandlers}
          >
            <AssistantRuntimeProvider runtime={runtime}>
              <Thread
                assistantDisplayName={assistantDisplayName}
                clampToComposer={showChatBar}
                cwd={currentCwd}
                gateway={gateway}
                intro={showIntro ? { personality: introPersonality, seed: introSeed } : undefined}
                loading={threadLoading}
                messages={messages}
                onBranchInNewChat={onBranchInNewChat}
                onCancel={onCancel}
                sessionId={activeSessionId}
                sessionKey={threadKey}
              />
              {showChatBar && (
                <Suspense fallback={<ChatBarFallback />}>
                  <ChatBar
                    busy={busy}
                    cwd={currentCwd}
                    disabled={!gatewayOpen}
                    focusKey={activeSessionId}
                    gateway={gateway}
                    maxRecordingSeconds={maxVoiceRecordingSeconds}
                    onAddContextRef={onAddContextRef}
                    onAddUrl={onAddUrl}
                    onAttachDroppedItems={onAttachDroppedItems}
                    onAttachImageBlob={onAttachImageBlob}
                    onCancel={onCancel}
                    onPasteClipboardImage={onPasteClipboardImage}
                    onPickFiles={onPickFiles}
                    onPickFolders={onPickFolders}
                    onPickImages={onPickImages}
                    onRemoveAttachment={onRemoveAttachment}
                    onSteer={onSteer}
                    onSubmit={onSubmit}
                    onTranscribeAudio={onTranscribeAudio}
                    queueSessionKey={selectedSessionId || activeSessionId}
                    sessionId={activeSessionId}
                    state={chatBarState}
                  />
                </Suspense>
              )}
            </AssistantRuntimeProvider>
            <ChatDropOverlay kind={dragKind} />
            <ChatSwapOverlay profile={gatewaySwapTarget} />
          </div>
        </div>
      </div>
    </div>
  )
}

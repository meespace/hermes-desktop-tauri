// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChatView } from './index'

const chatViewMock = vi.hoisted(() => ({
  chatBarProps: null as null | Record<string, unknown>,
  sessions: [
    {
      archived: false,
      cwd: '/tmp/hermes',
      ended_at: null,
      id: 'session-1',
      input_tokens: 0,
      is_active: false,
      last_active: 1,
      message_count: 1,
      model: 'gpt-4.1',
      output_tokens: 0,
      preview: null,
      source: 'local',
      started_at: 1,
      title: 'Desktop Shell',
      tool_call_count: 0
    }
  ]
}))

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null })
}))

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => children,
  ExportedMessageRepository: {
    fromBranchableArray: vi.fn(() => ({}))
  }
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn()
}))

vi.mock('@/components/Backdrop', () => ({
  Backdrop: () => <div data-testid="backdrop" />
}))

vi.mock('@/components/prompt-overlays', () => ({
  PromptOverlays: () => null
}))

vi.mock('@/components/assistant-ui/thread', () => ({
  Thread: () => <div data-testid="thread" />
}))

vi.mock('@/components/notifications', () => ({
  NotificationStack: () => <div data-testid="notifications" />
}))

vi.mock('@/hermes', () => ({
  getGlobalModelOptions: vi.fn(async () => null),
  setApiRequestProfile: vi.fn()
}))

vi.mock('@/lib/incremental-external-store-runtime', () => ({
  useIncrementalExternalStoreRuntime: () => ({})
}))

vi.mock('@/store/layout', () => ({
  $sidebarOpen: { get: vi.fn(() => true) },
  $fileBrowserOpen: { get: vi.fn(() => false) },
  $pinnedSessionIds: { get: vi.fn(() => ['session-1']) },
  toggleSidebarOpen: vi.fn(),
  toggleFileBrowserOpen: vi.fn()
}))

vi.mock('@/store/profile', () => ({
  $activeGatewayProfile: { get: () => 'default' },
  $activeProfile: { get: () => 'default' },
  $gatewaySwapTarget: { get: () => null },
  $profileColors: { get: () => ({}) },
  $profiles: { get: () => [] },
  ALL_PROFILES: '__all__',
  refreshActiveProfile: vi.fn(async () => undefined),
  selectProfile: vi.fn(),
  setShowAllProfiles: vi.fn()
}))

vi.mock('@/store/session', () => ({
  $activeSessionId: { get: () => null },
  $awaitingResponse: { get: () => false },
  $busy: { get: () => false },
  $contextSuggestions: { get: () => [] },
  $currentCwd: { get: () => '/tmp/hermes' },
  $currentModel: { get: () => 'gpt-4.1' },
  $currentProvider: { get: () => 'openai' },
  $freshDraftReady: { get: () => false },
  $gatewayState: { get: () => 'open' },
  $introPersonality: { get: () => 'default' },
  $introSeed: { get: () => 'seed' },
  $messages: { get: () => [] },
  $selectedStoredSessionId: { get: () => 'session-1' },
  $sessions: { get: () => chatViewMock.sessions }
}))

vi.mock('../routes', () => ({
  routeSessionId: vi.fn(() => null)
}))

vi.mock('../shell/titlebar', async importOriginal => {
  const actual = await importOriginal<typeof import('../shell/titlebar')>()
  return actual
})

vi.mock('./composer', () => ({
  ChatBar: (props: Record<string, unknown>) => {
    chatViewMock.chatBarProps = props
    return <div data-testid="chat-bar" />
  },
  ChatBarFallback: () => <div data-testid="chat-bar-fallback" />
}))

vi.mock('./chat-swap-overlay', () => ({
  ChatSwapOverlay: () => null
}))

vi.mock('./sidebar/session-actions-menu', () => ({
  SessionActionsMenu: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('./thread-loading', () => ({
  lastVisibleMessageIsUser: () => false,
  threadLoadingState: () => undefined
}))

describe('chat view HeroUI shells', () => {
  it('renders surfaced chat chrome for the header trigger and main panel', () => {
    const { container } = render(
      <ChatView
        gateway={null}
        onAddContextRef={vi.fn()}
        onAddUrl={vi.fn()}
        onAttachDroppedItems={vi.fn()}
        onAttachImageBlob={vi.fn()}
        onBranchInNewChat={vi.fn()}
        onCancel={vi.fn()}
        onDeleteSelectedSession={vi.fn()}
        onEdit={vi.fn()}
        onPasteClipboardImage={vi.fn()}
        onPickFiles={vi.fn()}
        onPickFolders={vi.fn()}
        onPickImages={vi.fn()}
        onReload={vi.fn()}
        onRemoveAttachment={vi.fn()}
        onSubmit={vi.fn(async () => true)}
        onThreadMessagesChange={vi.fn()}
        onToggleSelectedPin={vi.fn()}
      />
    )

    const root = container.firstElementChild
    const sessionButton = screen.getByRole('button', { name: /Desktop Shell/ })

    expect(root?.className).toContain('bg-[var(--workbench-shell-bg)]')
    expect(sessionButton.className).toContain('text-[color-mix(in_srgb,var(--foreground)_82%,transparent)]')
    expect(sessionButton.className).toContain('hover:bg-[var(--workbench-hover)]')
    expect(sessionButton.className).toContain('data-[state=open]:bg-[var(--workbench-hover)]')
  })

  it('does not duplicate app controls inside the chat header', () => {
    render(
      <ChatView
        gateway={null}
        onAddContextRef={vi.fn()}
        onAddUrl={vi.fn()}
        onAttachDroppedItems={vi.fn()}
        onAttachImageBlob={vi.fn()}
        onBranchInNewChat={vi.fn()}
        onCancel={vi.fn()}
        onDeleteSelectedSession={vi.fn()}
        onEdit={vi.fn()}
        onPasteClipboardImage={vi.fn()}
        onPickFiles={vi.fn()}
        onPickFolders={vi.fn()}
        onPickImages={vi.fn()}
        onReload={vi.fn()}
        onRemoveAttachment={vi.fn()}
        onSubmit={vi.fn(async () => true)}
        onThreadMessagesChange={vi.fn()}
        onToggleSelectedPin={vi.fn()}
      />
    )

    expect(screen.queryByLabelText('App controls')).toBeNull()
  })

  it('leaves pane-scoped tools to the shell titlebar instead of the chat header', () => {
    render(
      <ChatView
        gateway={null}
        onAddContextRef={vi.fn()}
        onAddUrl={vi.fn()}
        onAttachDroppedItems={vi.fn()}
        onAttachImageBlob={vi.fn()}
        onBranchInNewChat={vi.fn()}
        onCancel={vi.fn()}
        onDeleteSelectedSession={vi.fn()}
        onEdit={vi.fn()}
        onPasteClipboardImage={vi.fn()}
        onPickFiles={vi.fn()}
        onPickFolders={vi.fn()}
        onPickImages={vi.fn()}
        onReload={vi.fn()}
        onRemoveAttachment={vi.fn()}
        onSubmit={vi.fn(async () => true)}
        onThreadMessagesChange={vi.fn()}
        onToggleSelectedPin={vi.fn()}
        titlebarTools={[
          {
            icon: <span aria-hidden="true">X</span>,
            id: 'preview-close',
            label: 'Close preview',
            onSelect: vi.fn()
          }
        ]}
      />
    )

    expect(screen.queryByRole('button', { name: 'Close preview' })).toBeNull()
    expect(screen.queryByLabelText('Pane controls')).toBeNull()
  })

  it('surfaces a sidebar restore button when the left rail is collapsed', async () => {
    const { $sidebarOpen } = await import('@/store/layout')
    vi.mocked($sidebarOpen.get).mockReturnValue(false)

    render(
      <ChatView
        gateway={null}
        onAddContextRef={vi.fn()}
        onAddUrl={vi.fn()}
        onAttachDroppedItems={vi.fn()}
        onAttachImageBlob={vi.fn()}
        onBranchInNewChat={vi.fn()}
        onCancel={vi.fn()}
        onDeleteSelectedSession={vi.fn()}
        onEdit={vi.fn()}
        onPasteClipboardImage={vi.fn()}
        onPickFiles={vi.fn()}
        onPickFolders={vi.fn()}
        onPickImages={vi.fn()}
        onReload={vi.fn()}
        onRemoveAttachment={vi.fn()}
        onSubmit={vi.fn(async () => true)}
        onThreadMessagesChange={vi.fn()}
        onToggleSelectedPin={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeTruthy()
    vi.mocked($sidebarOpen.get).mockReturnValue(true)
  })

  it('forwards steer handling into the composer like the official chat flow', () => {
    const onSteer = vi.fn(async () => true)

    render(
      <ChatView
        gateway={null}
        onAddContextRef={vi.fn()}
        onAddUrl={vi.fn()}
        onAttachDroppedItems={vi.fn()}
        onAttachImageBlob={vi.fn()}
        onBranchInNewChat={vi.fn()}
        onCancel={vi.fn()}
        onDeleteSelectedSession={vi.fn()}
        onEdit={vi.fn()}
        onOpenSettings={vi.fn()}
        onPasteClipboardImage={vi.fn()}
        onPickFiles={vi.fn()}
        onPickFolders={vi.fn()}
        onPickImages={vi.fn()}
        onReload={vi.fn()}
        onRemoveAttachment={vi.fn()}
        onSteer={onSteer}
        onSubmit={vi.fn(async () => true)}
        onThreadMessagesChange={vi.fn()}
        onToggleSelectedPin={vi.fn()}
      />
    )

    expect(chatViewMock.chatBarProps?.onSteer).toBe(onSteer)
  })
})

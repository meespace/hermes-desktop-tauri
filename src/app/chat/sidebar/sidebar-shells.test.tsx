// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { $cronJobs } from '@/store/cron'
import { $pinnedSessionIds, $sidebarOpen } from '@/store/layout'
import { $activeGatewayProfile, $profiles } from '@/store/profile'
import { setSessions, setSessionsLoading, setSessionProfileTotals, setSessionsTotal } from '@/store/session'

import { ChatSidebar } from './index'
import { SidebarSessionRow } from './session-row'

vi.mock('@/lib/haptics', () => ({
  triggerHaptic: vi.fn()
}))

vi.mock('./session-actions-menu', () => ({
  SessionActionsMenu: ({ children }: { children: React.ReactNode }) => children,
  SessionContextMenu: ({ children }: { children: React.ReactNode }) => children
}))

afterEach(() => cleanup())

describe('chat sidebar HeroUI shells', () => {
  const defaultProfile = {
    has_env: false,
    is_default: true,
    model: null,
    name: 'default',
    path: '/tmp/hermes-default',
    provider: null,
    skill_count: 0
  }

  it('renders session rows with selected state and action chrome', () => {
    const { container } = render(
      <SidebarSessionRow
        isPinned={false}
        isSelected
        isWorking={false}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        onPin={vi.fn()}
        onResume={vi.fn()}
        session={{
          archived: false,
          cwd: '/tmp/hermes',
          ended_at: null,
          id: 'session-1',
          input_tokens: 0,
          is_active: false,
          last_active: Math.floor(Date.now() / 1000) - 3600,
          message_count: 12,
          model: 'gpt-4.1',
          output_tokens: 0,
          preview: 'Preview text',
          source: 'local',
          started_at: Math.floor(Date.now() / 1000) - 7200,
          title: 'Ship it',
          tool_call_count: 1
        }}
      />
    )

    const row = container.querySelector('div')
    const actionsButton = screen.getByRole('button', { name: 'Actions for Ship it' })

    expect(row?.className).toContain('heroui-session-row')
    expect(row?.className).toContain('is-selected')
    expect(actionsButton.className).toContain('heroui-session-action')
  })

  it('keeps pinned and session sections visible when the current profile has no sessions', () => {
    setSessions([])
    setSessionsTotal(0)
    setSessionProfileTotals({})
    setSessionsLoading(false)
    $activeGatewayProfile.set('default')
    $profiles.set([defaultProfile])
    $pinnedSessionIds.set([])
    $cronJobs.set([])

    render(
      <MemoryRouter>
        <SidebarProvider>
          <ChatSidebar
            currentView="chat"
            onArchiveSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onLoadMoreSessions={vi.fn()}
            onManageCronJob={vi.fn()}
            onNavigate={vi.fn()}
            onNewSessionInWorkspace={vi.fn()}
            onResumeSession={vi.fn()}
            onTriggerCronJob={vi.fn()}
            onOpenSearch={vi.fn()}
          />
        </SidebarProvider>
      </MemoryRouter>
    )

    expect($sidebarOpen.get()).toBe(true)
    expect(screen.getByText('Pinned')).toBeTruthy()
    expect(screen.getByText('Sessions')).toBeTruthy()
    expect(screen.getByText('No chats yet. Start a new session to see it here.')).toBeTruthy()
  })

  it('does not present pinned-only chats as missing sessions', () => {
    setSessions([
      {
        archived: false,
        cwd: '/tmp/hermes',
        ended_at: null,
        id: 'session-1',
        input_tokens: 0,
        is_active: false,
        last_active: Math.floor(Date.now() / 1000) - 3600,
        message_count: 12,
        model: 'gpt-4.1',
        output_tokens: 0,
        preview: 'Preview text',
        profile: 'default',
        source: 'local',
        started_at: Math.floor(Date.now() / 1000) - 7200,
        title: 'Pinned chat',
        tool_call_count: 1
      }
    ])
    setSessionsTotal(1)
    setSessionProfileTotals({ default: 1 })
    setSessionsLoading(false)
    $activeGatewayProfile.set('default')
    $profiles.set([defaultProfile])
    $pinnedSessionIds.set(['session-1'])
    $cronJobs.set([])

    render(
      <MemoryRouter>
        <SidebarProvider>
          <ChatSidebar
            currentView="chat"
            onArchiveSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onLoadMoreSessions={vi.fn()}
            onManageCronJob={vi.fn()}
            onNavigate={vi.fn()}
            onNewSessionInWorkspace={vi.fn()}
            onResumeSession={vi.fn()}
            onTriggerCronJob={vi.fn()}
            onOpenSearch={vi.fn()}
          />
        </SidebarProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('Pinned chat')).toBeTruthy()
    expect(screen.getByText('Everything here is pinned. Unpin a chat to show it in recents.')).toBeTruthy()
    expect(screen.queryByText('No chats yet. Start a new session to see it here.')).toBeNull()
  })

  it('keeps the default profile affordance visible in the bottom rail', () => {
    setSessions([])
    setSessionsTotal(0)
    setSessionProfileTotals({})
    setSessionsLoading(false)
    $activeGatewayProfile.set('default')
    $profiles.set([defaultProfile])
    $pinnedSessionIds.set([])
    $cronJobs.set([])

    render(
      <MemoryRouter>
        <SidebarProvider>
          <ChatSidebar
            currentView="chat"
            onArchiveSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onLoadMoreSessions={vi.fn()}
            onManageCronJob={vi.fn()}
            onNavigate={vi.fn()}
            onNewSessionInWorkspace={vi.fn()}
            onResumeSession={vi.fn()}
            onTriggerCronJob={vi.fn()}
            onOpenSearch={vi.fn()}
          />
        </SidebarProvider>
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: 'Profiles: Default profile' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Manage profiles' })).toBeNull()
  })

  it('renders the community brand as a single line in the sidebar card', () => {
    setSessions([])
    setSessionsTotal(0)
    setSessionProfileTotals({})
    setSessionsLoading(false)
    $activeGatewayProfile.set('default')
    $profiles.set([defaultProfile])
    $pinnedSessionIds.set([])
    $cronJobs.set([])

    render(
      <MemoryRouter>
        <SidebarProvider>
          <ChatSidebar
            currentView="chat"
            onArchiveSession={vi.fn()}
            onDeleteSession={vi.fn()}
            onLoadMoreSessions={vi.fn()}
            onManageCronJob={vi.fn()}
            onNavigate={vi.fn()}
            onNewSessionInWorkspace={vi.fn()}
            onResumeSession={vi.fn()}
            onTriggerCronJob={vi.fn()}
            onOpenSearch={vi.fn()}
          />
        </SidebarProvider>
      </MemoryRouter>
    )

    expect(screen.getByText('Hermes Desktop Community')).toBeTruthy()
    expect(screen.queryByText(/^Hermes Desktop$/)).toBeNull()
  })
})

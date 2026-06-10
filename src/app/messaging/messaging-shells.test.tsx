// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MessagingView } from './index'

const messagingShellMock = vi.hoisted(() => ({
  platforms: [
    {
      configured: true,
      description: 'Telegram bot bridge',
      docs_url: 'https://example.com/telegram',
      enabled: true,
      env_vars: [],
      error_message: null,
      gateway_running: true,
      id: 'telegram',
      name: 'Telegram',
      state: 'connected'
    }
  ]
}))

vi.mock('@/hermes', () => ({
  getMessagingPlatforms: vi.fn(async () => ({ platforms: messagingShellMock.platforms })),
  updateMessagingPlatform: vi.fn(async () => ({}))
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

vi.mock('../hooks/use-route-enum-param', () => ({
  useRouteEnumParam: () => ['telegram', vi.fn()]
}))

vi.mock('../page-search-shell', () => ({
  PageSearchShell: ({ children }: { children: React.ReactNode }) => <section data-testid="messaging-shell">{children}</section>
}))

describe('MessagingView HeroUI shells', () => {
  it('renders platform rows and state pills with surfaced desktop chrome', async () => {
    const { container } = render(<MessagingView />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Telegram/i })).toBeTruthy())

    const platformRow = screen.getByRole('button', { name: /Telegram/i })
    const enabledLabel = screen.getByText('Enabled')
    const headerPill = screen.getByText('Connected').closest('span')
    const shell = container.querySelector('[data-testid="messaging-shell"]')

    expect(shell?.textContent).toContain('Telegram')
    expect(platformRow.className).toContain('bg-[var(--surface-secondary)]')
    expect(platformRow.className).toContain('shadow-[var(--field-shadow)]')
    expect(enabledLabel.className).toContain('text-[var(--muted)]')
    expect(headerPill?.className).toContain('bg-[var(--surface-secondary)]')
  })
})

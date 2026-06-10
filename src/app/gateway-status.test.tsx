// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args)
}))

describe('GatewayStatus', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders a HeroUI recovery card when no connection is available', async () => {
    const { GatewayStatus } = await import('./gateway-status')
    render(<GatewayStatus connection={null} />)

    expect(screen.getByText('Not Connected')).toBeTruthy()
    const card = document.querySelector('[data-slot="gateway-status-card"]')
    expect(card?.className).toContain('shadow-[var(--surface-shadow)]')
  })

  it('renders connected gateway details inside HeroUI cards', async () => {
    invokeMock.mockResolvedValue({
      active_sessions: 3,
      gateway_running: true,
      gateway_state: 'ready',
      version: '1.2.3'
    })

    const { GatewayStatus } = await import('./gateway-status')
    render(
      <GatewayStatus
        connection={{
          base_url: 'http://127.0.0.1:9000',
          mode: 'local',
          token: 'secret',
          ws_url: 'ws://127.0.0.1:9000/ws'
        }}
      />
    )

    expect(await screen.findByText('Gateway Connected')).toBeTruthy()
    await waitFor(() => expect(invokeMock).toHaveBeenCalled())

    const cards = document.querySelectorAll('[data-slot="gateway-status-card"]')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards[0]?.className).toContain('bg-[var(--surface)]')
  })
})

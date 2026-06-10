// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $desktopBoot } from '@/store/boot'
import { setGatewayState } from '@/store/session'

const INITIAL_BOOT = {
  ...$desktopBoot.get()
}

describe('GatewayConnectingOverlay', () => {
  beforeEach(() => {
    setGatewayState('connecting')
    $desktopBoot.set({
      ...INITIAL_BOOT,
      error: null
    })
  })

  afterEach(() => {
    cleanup()
    setGatewayState('idle')
    $desktopBoot.set({
      ...INITIAL_BOOT
    })
  })

  it('renders the HeroUI connecting shell while the gateway is opening', async () => {
    const { GatewayConnectingOverlay } = await import('./gateway-connecting-overlay')

    render(<GatewayConnectingOverlay />)

    const overlay = document.querySelector('[data-slot="gateway-connecting-overlay"]')
    const chip = document.querySelector('[data-slot="gateway-connecting-chip"]')

    expect(overlay?.className).toContain('bg-[color-mix(in_srgb,var(--background)_88%,var(--surface))]')
    expect(chip?.className).toContain('shadow-[var(--overlay-shadow)]')
  })

  it('stays hidden when boot failure takes over the screen', async () => {
    $desktopBoot.set({
      ...INITIAL_BOOT,
      error: 'gateway failed'
    })

    const { GatewayConnectingOverlay } = await import('./gateway-connecting-overlay')

    render(<GatewayConnectingOverlay />)

    expect(document.querySelector('[data-slot="gateway-connecting-overlay"]')).toBeNull()
  })
})

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Sparkles } from '@/lib/icons'

import { OverlayCard } from './overlay-chrome'
import { OverlayMain, OverlayNavItem, OverlaySidebar, OverlaySplitLayout } from './overlay-split-layout'
import { OverlayView } from './overlay-view'

describe('HeroUI overlay primitives', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders overlay view with stable HeroUI shell slots', () => {
    const onClose = vi.fn()

    render(
      <OverlayView headerContent={<div>Header</div>} onClose={onClose}>
        <div>Overlay body</div>
      </OverlayView>
    )

    const backdrop = document.querySelector('[data-slot="overlay-view-backdrop"]')
    const root = document.querySelector('[data-slot="overlay-view-root"]')
    const closeButton = document.querySelector('[data-slot="overlay-view-close"]')

    expect(backdrop?.className).toContain('backdrop-blur-xl')
    expect(backdrop?.className).toContain('z-[1200]')
    expect(root?.className).toContain('bg-[color-mix(in_srgb,var(--overlay)_95%,white_5%)]')
    expect(root?.className).toContain('shadow-[var(--overlay-shadow)]')
    expect(closeButton?.getAttribute('data-slot')).toBe('overlay-view-close')

    fireEvent.click(closeButton as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders split layout primitives with sidebar and card slots', () => {
    render(
      <OverlaySplitLayout>
        <OverlaySidebar>
          <OverlayNavItem active icon={Sparkles} label="Models" onClick={() => undefined} />
        </OverlaySidebar>
        <OverlayMain>
          <OverlayCard>Panel body</OverlayCard>
        </OverlayMain>
      </OverlaySplitLayout>
    )

    const sidebar = document.querySelector('[data-slot="overlay-sidebar"]')
    const navItem = document.querySelector('[data-slot="overlay-nav-item"]')
    const card = document.querySelector('[data-slot="overlay-card"]')

    expect(sidebar?.className).toContain('bg-[linear-gradient(180deg')
    expect(navItem?.className).toContain('bg-[color-mix(in_srgb,var(--accent)_10%,white_90%)]')
    expect(card?.className).toContain('shadow-[var(--surface-shadow)]')
    expect(screen.getByText('Panel body')).toBeTruthy()
  })
})

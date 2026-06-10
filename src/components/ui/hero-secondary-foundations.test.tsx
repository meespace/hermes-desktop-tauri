// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './context-menu'

class TestResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

describe('HeroUI secondary foundation adapters', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    })
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders command surfaces with HeroUI shell classes', () => {
    render(
      <Command>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandGroup heading="Actions">
            <CommandItem>Rename chat</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    )

    const root = document.querySelector('[data-slot="command"]')
    const item = screen.getByText('Rename chat')

    expect(root?.className).toContain('shadow-[var(--overlay-shadow)]')
    expect(item.className).toContain('menu-item')
  })

  it('renders context menus with HeroUI menu classes', async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Open</ContextMenuTrigger>
        <ContextMenuContent forceMount>
          <ContextMenuItem>Rename</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )

    fireEvent.contextMenu(screen.getByText('Open'))

    const content = document.querySelector('[data-slot="context-menu-content"]')
    const item = await screen.findByText('Rename')

    expect(content?.className).toContain('dropdown__menu')
    expect(item.className).toContain('menu-item')
  })
})

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

class TestResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

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

describe('HeroUI shell adapters', () => {
  it('renders dialog chrome with HeroUI modal classes', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    const content = document.querySelector('[data-slot="dialog-content"]')
    const closeButton = document.querySelector('[data-slot="dialog-close-button"]')

    expect(overlay?.className).toContain('modal__backdrop')
    expect(content?.className).toContain('modal__dialog')
    expect(closeButton?.className).toContain('close-button')
  })

  it('renders sheet chrome with HeroUI drawer classes', () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Drawer title</SheetTitle>
            <SheetDescription>Drawer description</SheetDescription>
          </SheetHeader>
          <div>Drawer body</div>
        </SheetContent>
      </Sheet>
    )

    const content = document.querySelector('[data-slot="sheet-content"]')
    const closeButton = document.querySelector('.drawer__close-trigger')

    expect(content?.className).toContain('drawer__dialog')
    expect(content?.getAttribute('data-placement')).toBe('right')
    expect(closeButton?.className).toContain('close-button')
  })

  it('renders select trigger and list using HeroUI select and list-box classes', async () => {
    render(
      <Select open value="provider-a">
        <SelectTrigger>
          <SelectValue placeholder="Choose provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="provider-a">Provider A</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = document.querySelector('[data-slot="select-trigger"]')
    const content = document.querySelector('[data-slot="select-content"]')
    await screen.findAllByText('Provider A')
    const item = document.querySelector('[data-slot="list-box-item"]')

    expect(trigger?.className).toContain('select__trigger')
    expect(content?.className).toContain('select__popover')
    expect(item?.className).toContain('list-box-item')
  })

  it('renders dropdown menus with HeroUI popover and menu-item classes', async () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent forceMount>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    const content = document.querySelector('[data-slot="dropdown-menu"]')
    const item = (await screen.findByText('Rename')).closest('[data-slot="menu-item"]')

    expect(content?.className).toContain('dropdown__popover')
    expect(item?.className).toContain('menu-item')
  })

  it('renders tooltip overlay with HeroUI tooltip classes', async () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip body</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )

    await screen.findAllByText('Tooltip body')
    const content = document.querySelector('[data-slot="tooltip-content"]')

    expect(content?.className).toContain('tooltip')
  })
})

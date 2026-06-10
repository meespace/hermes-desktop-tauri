// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { Pagination, PaginationButton, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from './pagination'
import { ScrollArea } from './scroll-area'
import { Skeleton } from './skeleton'

class TestResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

describe('HeroUI foundation adapters', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders scroll areas with the refined desktop scrollbar shell', () => {
    render(
      <ScrollArea className="h-20 w-20">
        <div style={{ height: 200 }}>Long content</div>
      </ScrollArea>
    )

    const root = document.querySelector('[data-slot="scroll-area"]')
    const viewport = document.querySelector('[data-slot="scroll-area-viewport"]')

    expect(root?.className).toContain('rounded-[calc(var(--radius)*1.5)]')
    expect(viewport?.className).toContain('outline-none')
  })

  it('renders pagination controls with HeroUI pagination classes', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious />
          </PaginationItem>
          <PaginationItem>
            <PaginationButton isActive>1</PaginationButton>
          </PaginationItem>
          <PaginationItem>
            <PaginationButton>2</PaginationButton>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )

    const activeButton = screen.getByRole('button', { name: '1' })
    const previous = screen.getByRole('button', { name: 'Go to previous page' })

    expect(activeButton.className).toContain('pagination__link')
    expect(previous.className).toContain('pagination__link--nav')
  })

  it('renders skeletons with HeroUI shimmer styling by default', () => {
    render(<Skeleton className="h-10 w-32" />)

    const skeleton = document.querySelector('[data-slot="skeleton"]')

    expect(skeleton?.className).toContain('skeleton')
    expect(skeleton?.className).toContain('skeleton--shimmer')
  })
})

// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AttachmentList } from '@/app/chat/composer/attachments'

import { CompactMarkdown } from './compact-markdown'
import { DisclosureRow } from './disclosure-row'
import { PreviewAttachment } from './preview-attachment'

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('@/store/session', () => ({
  $currentCwd: { get: () => '/Users/demo/project' }
}))

vi.mock('@/store/preview', () => ({
  $previewTarget: { get: () => null },
  dismissPreviewTarget: vi.fn(),
  setCurrentSessionPreviewTarget: vi.fn()
}))

vi.mock('@/lib/local-preview', () => ({
  normalizeOrLocalPreviewTarget: vi.fn()
}))

vi.mock('@/store/notifications', () => ({
  notifyError: vi.fn()
}))

describe('chat HeroUI foundations', () => {
  it('renders disclosure rows with muted HeroUI chrome and focus affordance', () => {
    render(
      <DisclosureRow onToggle={vi.fn()} open={false}>
        <span>Thinking</span>
      </DisclosureRow>
    )

    const button = screen.getByRole('button', { name: /thinking/i })
    const root = button.parentElement

    expect(root?.className).toContain('text-[var(--muted)]')
    expect(button.className).toContain('rounded-[calc(var(--radius)*1.25)]')
    expect(button.className).toContain('hover:bg-[var(--surface-secondary)]')
    expect(button.className).toContain('focus-visible:ring-[color-mix(in_srgb,var(--focus)_22%,transparent)]')
  })

  it('renders compact markdown blocks inside HeroUI content shells', () => {
    const { container } = render(
      <CompactMarkdown
        text={`> quoted\n\n\`\`\`\nconst a = 1\n\`\`\`\n\n| a | b |\n| - | - |\n| 1 | 2 |`}
      />
    )

    const root = container.firstElementChild as HTMLElement
    const blockquote = container.querySelector('blockquote')
    const pre = container.querySelector('pre')
    const tableWrap = container.querySelector('table')?.parentElement

    expect(root.className).toContain('text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]')
    expect(blockquote?.className).toContain('border-[var(--border)]')
    expect(pre?.className).toContain('bg-[var(--surface-secondary)]')
    expect(pre?.className).toContain('shadow-[var(--field-shadow)]')
    expect(tableWrap?.className).toContain('border-[var(--border)]')
    expect(tableWrap?.className).toContain('bg-[var(--surface)]')
  })

  it('renders preview attachments with HeroUI card and action shells', () => {
    render(<PreviewAttachment source="manual" target="https://example.com/demo" />)

    const openButton = screen.getByRole('button', { name: /open preview/i })
    const card = openButton.parentElement as HTMLElement

    expect(card.className).toContain('border-[var(--border)]')
    expect(card.className).toContain('bg-[var(--surface)]')
    expect(card.className).toContain('shadow-[var(--field-shadow)]')
    expect(openButton.className).toContain('bg-[var(--surface-secondary)]')
    expect(openButton.className).toContain('hover:bg-[var(--surface)]')
  })

  it('renders composer attachment pills with HeroUI surfaces', () => {
    render(
      <AttachmentList
        attachments={[
          {
            id: 'a1',
            kind: 'file',
            label: 'notes.md',
            detail: '/Users/demo/project/notes.md'
          }
        ]}
        onRemove={vi.fn()}
      />
    )

    const previewButton = screen.getByRole('button', { name: /preview notes\.md/i })
    const removeButton = screen.getByRole('button', { name: /remove notes\.md/i })
    const pill = previewButton.parentElement as HTMLElement

    expect(pill.className).toContain('group/attachment')
    expect(previewButton.className).toContain('border-[var(--border)]')
    expect(previewButton.className).toContain('bg-[var(--surface)]')
    expect(previewButton.className).toContain('shadow-[var(--field-shadow)]')
    expect(removeButton.className).toContain('bg-[var(--surface)]')
    expect(removeButton.className).toContain('hover:bg-[var(--surface-secondary)]')
  })
})

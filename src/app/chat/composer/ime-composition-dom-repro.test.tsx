// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)

function Harness({ onPayload }: { onPayload: (hasPayload: boolean) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)
  const draftRef = useRef('')
  const [draft, setDraft] = useState('')

  const flushEditorToDraft = (editor: HTMLDivElement) => {
    const next = editor.textContent ?? ''

    if (next !== draftRef.current) {
      draftRef.current = next
      setDraft(next)
    }
  }

  onPayload(draft.trim().length > 0)

  return (
    <div
      contentEditable
      data-testid="editor"
      onCompositionEnd={event => {
        composingRef.current = false
        flushEditorToDraft(event.currentTarget)
      }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onInput={event => {
        if (composingRef.current) {
          return
        }

        flushEditorToDraft(event.currentTarget)
      }}
      ref={editorRef}
      suppressContentEditableWarning
    />
  )
}

describe('composer IME composition — send button visibility', () => {
  it('shows the send button after committing CJK text without a trailing edit', async () => {
    let hasPayload = false
    const { getByTestId } = render(<Harness onPayload={p => (hasPayload = p)} />)
    const editor = getByTestId('editor')

    await act(async () => {
      fireEvent.compositionStart(editor)
      editor.textContent = '你'
      fireEvent.input(editor)
      editor.textContent = '你好'
      fireEvent.input(editor)
      fireEvent.compositionEnd(editor)
    })

    expect(hasPayload).toBe(true)
    expect(editor.textContent).toBe('你好')
  })

  it('also covers Japanese and Korean IME-composed scripts', async () => {
    let hasPayload = false
    const { getByTestId } = render(<Harness onPayload={p => (hasPayload = p)} />)
    const editor = getByTestId('editor')

    for (const committed of ['こんにちは', '안녕하세요']) {
      await act(async () => {
        fireEvent.compositionStart(editor)
        editor.textContent = committed
        fireEvent.input(editor)
        fireEvent.compositionEnd(editor)
      })

      expect(hasPayload).toBe(true)

      await act(async () => {
        editor.textContent = ''
        fireEvent.input(editor)
      })
      expect(hasPayload).toBe(false)
    }
  })
})

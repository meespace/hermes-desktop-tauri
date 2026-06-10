// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useFileDropZone } from './use-file-drop-zone'

const SESSION_MIME = 'application/x-hermes-session'

function dropTransfer(kind: 'files' | 'session') {
  if (kind === 'session') {
    return {
      effectAllowed: 'copy',
      getData: (type: string) =>
        type === SESSION_MIME ? JSON.stringify({ id: 'session-2', profile: 'default', title: 'Dragged chat' }) : '',
      items: [],
      types: [SESSION_MIME]
    }
  }

  return {
    dropEffect: 'copy',
    effectAllowed: 'copy',
    files: [],
    getData: () => '',
    items: [{ kind: 'file' }],
    types: ['Files']
  }
}

function Harness({
  onDropFiles,
  onDropSession
}: {
  onDropFiles: (files: unknown[]) => void
  onDropSession: (session: { id: string; profile: string; title: string }) => void
}) {
  const { dropHandlers } = useFileDropZone({
    enabled: true,
    onDropFiles,
    onDropSession
  } as never)

  return <div data-testid="drop-zone" {...dropHandlers} />
}

describe('useFileDropZone', () => {
  it('accepts dragged in-app sessions as session refs, not only files', () => {
    const onDropFiles = vi.fn()
    const onDropSession = vi.fn()

    render(<Harness onDropFiles={onDropFiles} onDropSession={onDropSession} />)

    const zone = screen.getByTestId('drop-zone')
    const dataTransfer = dropTransfer('session')

    fireEvent.dragEnter(zone, { dataTransfer })
    fireEvent.dragOver(zone, { dataTransfer })
    fireEvent.drop(zone, { dataTransfer })

    expect(onDropFiles).not.toHaveBeenCalled()
    expect(onDropSession).toHaveBeenCalledWith({
      id: 'session-2',
      profile: 'default',
      title: 'Dragged chat'
    })
  })
})

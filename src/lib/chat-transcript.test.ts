import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/lib/chat-messages'

import { buildChatTranscript } from './chat-transcript'

function message(overrides: Partial<ChatMessage> & Pick<ChatMessage, 'role'>): ChatMessage {
  return {
    id: overrides.id ?? `${overrides.role}-1`,
    role: overrides.role,
    parts: overrides.parts ?? [],
    attachmentRefs: overrides.attachmentRefs,
    error: overrides.error,
    hidden: overrides.hidden,
    pending: overrides.pending,
    timestamp: overrides.timestamp
  }
}

describe('buildChatTranscript', () => {
  it('returns an empty string for no visible user/assistant messages', () => {
    expect(buildChatTranscript([], 'text')).toBe('')
    expect(buildChatTranscript([message({ role: 'system' })], 'markdown')).toBe('')
  })

  it('formats plain text with You / Hermes speakers', () => {
    const out = buildChatTranscript(
      [
        message({ role: 'user', parts: [{ type: 'text', text: 'hi' }] }),
        message({ role: 'assistant', parts: [{ type: 'text', text: 'hello there' }] })
      ],
      'text'
    )

    expect(out).toBe('You: hi\n\nHermes: hello there')
  })

  it('formats markdown with bold speaker headers', () => {
    const out = buildChatTranscript(
      [
        message({ role: 'user', parts: [{ type: 'text', text: 'hi' }] }),
        message({ role: 'assistant', parts: [{ type: 'text', text: 'hello there' }] })
      ],
      'markdown'
    )

    expect(out).toBe('**You:**\n\nhi\n\n**Hermes:**\n\nhello there')
  })

  it('supports custom speaker aliases', () => {
    const out = buildChatTranscript(
      [
        message({ role: 'user', parts: [{ type: 'text', text: 'hi' }] }),
        message({ role: 'assistant', parts: [{ type: 'text', text: 'hello there' }] })
      ],
      'text',
      { assistantDisplayName: 'Planner', userDisplayName: '你' }
    )

    expect(out).toBe('你: hi\n\nPlanner: hello there')
  })

  it('includes attachment refs ahead of the visible user text', () => {
    const out = buildChatTranscript(
      [
        message({
          role: 'user',
          attachmentRefs: ['@file:src/app.ts', '@folder:docs'],
          parts: [{ type: 'text', text: '  investigate this  ' }]
        })
      ],
      'text'
    )

    expect(out).toBe('You: @file:src/app.ts\n@folder:docs\n\ninvestigate this')
  })

  it('skips hidden branches and empty messages', () => {
    const out = buildChatTranscript(
      [
        message({ role: 'user', parts: [{ type: 'text', text: 'visible' }] }),
        message({ role: 'assistant', hidden: true, parts: [{ type: 'text', text: 'hidden' }] }),
        message({ role: 'assistant', parts: [{ type: 'text', text: ' shown ' }] }),
        message({ role: 'assistant', parts: [] })
      ],
      'text'
    )

    expect(out).toBe('You: visible\n\nHermes: shown')
  })
})

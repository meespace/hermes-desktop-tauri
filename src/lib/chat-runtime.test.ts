import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/lib/chat-messages'

import { toRuntimeMessage } from './chat-runtime'

describe('toRuntimeMessage', () => {
  it('copies frozen assistant names into runtime metadata', () => {
    const runtimeMessage = toRuntimeMessage({
      assistantName: 'Planner',
      id: 'assistant-1',
      parts: [{ type: 'text', text: 'hello' }],
      role: 'assistant'
    } as ChatMessage)

    expect(runtimeMessage.metadata?.custom).toMatchObject({ assistantName: 'Planner' })
  })
})

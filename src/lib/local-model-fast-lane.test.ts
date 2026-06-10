import { describe, expect, it } from 'vitest'

import { buildLocalChatRequest, resolveLocalChatTarget } from './local-model-fast-lane'

describe('local model fast lane target resolution', () => {
  it('routes Ollama local providers to the native /api/chat endpoint', () => {
    const target = resolveLocalChatTarget({
      config: {
        providers: {
          'ollama-local': {
            base_url: 'http://127.0.0.1:11434/v1',
            runtime: 'ollama',
            source: 'local'
          }
        }
      },
      model: 'gemma4',
      provider: 'ollama-local'
    })

    expect(target).toEqual({
      api: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4',
      provider: 'ollama-local'
    })
  })

  it('routes local OpenAI-compatible services directly to /v1/chat/completions', () => {
    const target = resolveLocalChatTarget({
      config: {
        model: {
          base_url: 'http://localhost:8000/v1',
          provider: 'custom'
        }
      },
      model: 'llama-3.1-8b',
      provider: 'custom'
    })

    expect(target).toEqual({
      api: 'openai-compatible',
      baseUrl: 'http://localhost:8000/v1',
      model: 'llama-3.1-8b',
      provider: 'custom'
    })
  })

  it('does not intercept remote custom providers', () => {
    expect(
      resolveLocalChatTarget({
        config: {
          custom_providers: [
            {
              base_url: 'https://token.sensenova.cn/v1',
              name: 'sensenova-6-7-flash-lite-openai-compatible-custom'
            }
          ],
          model: {
            provider: 'sensenova-6-7-flash-lite-openai-compatible-custom'
          }
        },
        model: 'sensenova-6.7-flash-lite',
        provider: 'sensenova-6-7-flash-lite-openai-compatible-custom'
      })
    ).toBeNull()
  })

  it('builds a short plain-chat transcript without duplicating the submitted user message', () => {
    const request = buildLocalChatRequest({
      history: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] },
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'current prompt' }] }
      ],
      maxHistoryMessages: 8,
      target: {
        api: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'gemma4',
        provider: 'ollama-local'
      },
      text: 'current prompt'
    })

    expect(request.messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'current prompt' }
    ])
  })
})

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getProfiles, setApiRequestProfile, setModelAssignment, transcribeAudio } from './hermes'

const api = vi.fn()

beforeEach(() => {
  api.mockReset()
  setApiRequestProfile(null)
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: {
      api
    }
  })
})

afterEach(() => {
  delete (window as typeof window & { hermesDesktop?: unknown }).hermesDesktop
})

describe('getProfiles', () => {
  it('does not inherit the active profile API scope', async () => {
    setApiRequestProfile('default')
    api.mockResolvedValueOnce({ profiles: [] })

    await expect(getProfiles()).resolves.toEqual({ profiles: [] })

    expect(api).toHaveBeenCalledWith({
      path: '/api/profiles'
    })
  })
})

describe('transcribeAudio', () => {
  it('uses an extended timeout for speech-to-text requests', async () => {
    api.mockResolvedValueOnce({
      ok: true,
      provider: 'local',
      transcript: 'hello world'
    })

    await expect(transcribeAudio('data:audio/webm;base64,Zm9v', 'audio/webm')).resolves.toEqual({
      ok: true,
      provider: 'local',
      transcript: 'hello world'
    })

    expect(api).toHaveBeenCalledWith({
      body: {
        data_url: 'data:audio/webm;base64,Zm9v',
        mime_type: 'audio/webm'
      },
      method: 'POST',
      path: '/api/audio/transcribe',
      timeoutMs: 120_000
    })
  })
})

describe('setModelAssignment desktop local model context', () => {
  it('caps local custom endpoints to an 8192 context window before switching', async () => {
    api.mockResolvedValueOnce({ model_context_length: 0, existing: true })
    api.mockResolvedValueOnce({ ok: true })
    api.mockResolvedValueOnce({ ok: true, provider: 'custom', model: 'gemma4' })

    await expect(
      setModelAssignment({
        scope: 'main',
        provider: 'custom',
        model: 'gemma4',
        base_url: 'http://127.0.0.1:11434/v1'
      })
    ).resolves.toMatchObject({ ok: true })

    expect(api).toHaveBeenNthCalledWith(1, { path: '/api/config' })
    expect(api).toHaveBeenNthCalledWith(2, {
      path: '/api/config',
      method: 'PUT',
      body: { config: { existing: true, model_context_length: 8192 } }
    })
    expect(api).toHaveBeenNthCalledWith(3, {
      path: '/api/model/set',
      method: 'POST',
      body: {
        scope: 'main',
        provider: 'custom',
        model: 'gemma4',
        base_url: 'http://127.0.0.1:11434/v1'
      }
    })
  })

  it('caps known local providers even when the backend owns their base URL', async () => {
    api.mockResolvedValueOnce({ model_context_length: 0 })
    api.mockResolvedValueOnce({ ok: true })
    api.mockResolvedValueOnce({ ok: true, provider: 'ollama-local', model: 'gemma4' })

    await setModelAssignment({
      scope: 'main',
      provider: 'ollama-local',
      model: 'gemma4'
    })

    expect(api).toHaveBeenNthCalledWith(2, {
      path: '/api/config',
      method: 'PUT',
      body: { config: { model_context_length: 8192 } }
    })
  })

  it('restores auto context detection for remote custom endpoints', async () => {
    api.mockResolvedValueOnce({ model_context_length: 8192 })
    api.mockResolvedValueOnce({ ok: true })
    api.mockResolvedValueOnce({ ok: true, provider: 'custom', model: 'remote-model' })

    await setModelAssignment({
      scope: 'main',
      provider: 'custom',
      model: 'remote-model',
      base_url: 'https://models.example.com/v1'
    })

    expect(api).toHaveBeenNthCalledWith(2, {
      path: '/api/config',
      method: 'PUT',
      body: { config: { model_context_length: 0 } }
    })
  })

  it('does not change context config for auxiliary assignments', async () => {
    api.mockResolvedValueOnce({ ok: true, provider: 'ollama-local', model: 'gemma4' })

    await setModelAssignment({
      scope: 'auxiliary',
      task: 'vision',
      provider: 'ollama-local',
      model: 'gemma4'
    })

    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith({
      path: '/api/model/set',
      method: 'POST',
      body: {
        scope: 'auxiliary',
        task: 'vision',
        provider: 'ollama-local',
        model: 'gemma4'
      }
    })
  })
})

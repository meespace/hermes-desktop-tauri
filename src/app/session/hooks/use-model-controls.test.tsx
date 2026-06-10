// @vitest-environment jsdom

import { QueryClient } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { $currentModel, $currentProvider, setCurrentModel, setCurrentProvider } from '@/store/session'

import { useModelControls } from './use-model-controls'

const getGlobalModelInfo = vi.fn()
const setGlobalModel = vi.fn()
const notifyError = vi.fn()

vi.mock('@/hermes', () => ({
  getGlobalModelInfo: (...args: unknown[]) => getGlobalModelInfo(...args),
  setGlobalModel: (...args: unknown[]) => setGlobalModel(...args)
}))

vi.mock('@/store/notifications', () => ({
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

describe('useModelControls', () => {
  beforeEach(() => {
    getGlobalModelInfo.mockReset()
    setGlobalModel.mockReset()
    notifyError.mockReset()
    setCurrentModel('old-model')
    setCurrentProvider('old-provider')
  })

  it('falls back to a global model switch when a stale runtime session is gone', async () => {
    const queryClient = new QueryClient()
    const requestGateway = vi.fn(async () => {
      throw new Error('session not found')
    })
    setGlobalModel.mockResolvedValue({ ok: true, provider: 'ollama-local', model: 'llama3' })
    getGlobalModelInfo.mockResolvedValue({ provider: 'ollama-local', model: 'llama3' })

    const { result } = renderHook(() =>
      useModelControls({
        activeSessionId: 'stale-runtime-session',
        queryClient,
        requestGateway
      })
    )

    await expect(
      result.current.selectModel({
        model: 'llama3',
        persistGlobal: false,
        provider: 'ollama-local'
      })
    ).resolves.toBe(true)

    expect(requestGateway).toHaveBeenCalledWith('slash.exec', {
      session_id: 'stale-runtime-session',
      command: '/model llama3 --provider ollama-local'
    })
    expect(setGlobalModel).toHaveBeenCalledWith('ollama-local', 'llama3')
    expect(notifyError).not.toHaveBeenCalled()
    expect($currentProvider.get()).toBe('ollama-local')
    expect($currentModel.get()).toBe('llama3')
  })
})

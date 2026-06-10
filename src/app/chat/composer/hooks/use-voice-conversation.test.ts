// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useVoiceConversation } from './use-voice-conversation'

const notify = vi.fn()
const notifyError = vi.fn()
const playSpeechText = vi.fn()
const stopVoicePlayback = vi.fn()
const useMicRecorderMock = vi.fn()
const startMock = vi.fn()
const stopMock = vi.fn()
const cancelMock = vi.fn()

vi.mock('@/store/notifications', () => ({
  notify: (...args: unknown[]) => notify(...args),
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

vi.mock('@/lib/voice-playback', () => ({
  playSpeechText: (...args: unknown[]) => playSpeechText(...args),
  stopVoicePlayback: () => stopVoicePlayback()
}))

vi.mock('./use-mic-recorder', () => ({
  useMicRecorder: () => useMicRecorderMock()
}))

describe('useVoiceConversation', () => {
  beforeEach(() => {
    notify.mockReset()
    notifyError.mockReset()
    playSpeechText.mockReset()
    stopVoicePlayback.mockReset()
    startMock.mockReset()
    stopMock.mockReset()
    cancelMock.mockReset()
    stopMock.mockResolvedValue(null)
    useMicRecorderMock.mockReturnValue({
      handle: {
        cancel: cancelMock,
        start: startMock,
        stop: stopMock
      },
      level: 0.1
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('warns and aborts when voice mode is started without speech-to-text', async () => {
    const onFatalError = vi.fn()

    const { result } = renderHook(() =>
      useVoiceConversation({
        busy: false,
        consumePendingResponse: vi.fn(),
        enabled: true,
        onFatalError,
        onSubmit: vi.fn(),
        onTranscribeAudio: undefined,
        pendingResponse: () => null
      })
    )

    await act(async () => {
      await result.current.start()
    })

    expect(notify).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'Configure speech-to-text to use voice mode.',
      title: 'Voice unavailable'
    })
    expect(onFatalError).toHaveBeenCalledTimes(1)
    expect(startMock).not.toHaveBeenCalled()
  })

  it('reports startListening failures and triggers the fatal callback', async () => {
    const onFatalError = vi.fn()
    const error = new Error('Microphone permission was denied.')
    startMock.mockRejectedValueOnce(error)

    const { result } = renderHook(() =>
      useVoiceConversation({
        busy: false,
        consumePendingResponse: vi.fn(),
        enabled: true,
        onFatalError,
        onSubmit: vi.fn(),
        onTranscribeAudio: vi.fn(async () => 'hello'),
        pendingResponse: () => null
      })
    )

    await act(async () => {
      await result.current.start()
    })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(error, 'Could not start voice session'))
    expect(onFatalError).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('idle')
  })

  it('surfaces microphone runtime failures via the same fatal path', async () => {
    const onFatalError = vi.fn()
    const error = new Error('device lost')
    startMock.mockImplementationOnce(async options => {
      options?.onError?.(error)
    })

    const { result } = renderHook(() =>
      useVoiceConversation({
        busy: false,
        consumePendingResponse: vi.fn(),
        enabled: true,
        onFatalError,
        onSubmit: vi.fn(),
        onTranscribeAudio: vi.fn(async () => 'hello'),
        pendingResponse: () => null
      })
    )

    await act(async () => {
      await result.current.start()
    })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(error, 'Microphone failed'))
    expect(onFatalError).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.end()
    })
  })
})

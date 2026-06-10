// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useVoiceRecorder } from './use-voice-recorder'

const notify = vi.fn()
const notifyError = vi.fn()
const useMicRecorderMock = vi.fn()
const startMock = vi.fn()
const stopMock = vi.fn()
const cancelMock = vi.fn()

vi.mock('@/store/notifications', () => ({
  notify: (...args: unknown[]) => notify(...args),
  notifyError: (...args: unknown[]) => notifyError(...args)
}))

vi.mock('./use-mic-recorder', () => ({
  useMicRecorder: () => useMicRecorderMock()
}))

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    notify.mockReset()
    notifyError.mockReset()
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
      level: 0.25,
      recording: false
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('warns when speech-to-text is unavailable', async () => {
    const focusInput = vi.fn()
    const onTranscript = vi.fn()

    const { result } = renderHook(() =>
      useVoiceRecorder({
        focusInput,
        maxRecordingSeconds: 120,
        onTranscript,
        onTranscribeAudio: undefined
      })
    )

    await act(async () => {
      result.current.dictate()
      await Promise.resolve()
    })

    expect(notify).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'Voice transcription is not available yet.',
      title: 'Voice unavailable'
    })
    expect(startMock).not.toHaveBeenCalled()
    expect(result.current.voiceStatus).toBe('idle')
  })

  it('reports recorder start failures through the desktop error notifier', async () => {
    const error = new Error('Microphone permission was denied.')
    startMock.mockRejectedValueOnce(error)

    const { result } = renderHook(() =>
      useVoiceRecorder({
        focusInput: vi.fn(),
        maxRecordingSeconds: 120,
        onTranscript: vi.fn(),
        onTranscribeAudio: vi.fn(async () => 'hello')
      })
    )

    await act(async () => {
      result.current.dictate()
    })

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(error, 'Voice recording failed'))
    expect(result.current.voiceStatus).toBe('idle')
  })
})

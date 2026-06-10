// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { microphoneError } from './use-mic-recorder'

describe('microphoneError', () => {
  it('maps permission-denied style errors even when they are plain objects', () => {
    expect(microphoneError({ name: 'NotAllowedError' }).message).toBe('Microphone permission was denied.')
    expect(microphoneError({ name: 'SecurityError' }).message).toBe('Microphone permission was denied.')
  })

  it('maps device and busy states to user-facing messages', () => {
    expect(microphoneError({ name: 'NotFoundError' }).message).toBe('No microphone was found.')
    expect(microphoneError({ name: 'NotReadableError' }).message).toBe('Microphone is already in use by another app.')
    expect(microphoneError({ name: 'OverconstrainedError' }).message).toBe(
      'Microphone constraints are not supported by this device.'
    )
  })

  it('preserves ordinary errors when there is no known microphone code', () => {
    const original = new Error('Unknown microphone failure')

    expect(microphoneError(original)).toBe(original)
  })
})

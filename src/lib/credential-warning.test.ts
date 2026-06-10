import { describe, expect, it } from 'vitest'

import { shouldShowCredentialWarning } from './credential-warning'

describe('shouldShowCredentialWarning', () => {
  it('ignores missing API key warnings for local Ollama providers', () => {
    expect(
      shouldShowCredentialWarning(
        "No API key configured for provider 'ollama-local'. First message will fail.",
        'ollama-local'
      )
    ).toBe(false)
  })

  it('ignores missing API key warnings for loopback custom endpoints', () => {
    expect(
      shouldShowCredentialWarning(
        "No API key configured for provider 'custom'. First message will fail.",
        'custom',
        'http://127.0.0.1:11434/v1'
      )
    ).toBe(false)
  })

  it('keeps missing API key warnings for built-in remote providers', () => {
    expect(
      shouldShowCredentialWarning(
        "No API key configured for provider 'openrouter'. First message will fail.",
        'openrouter'
      )
    ).toBe(true)
  })

  it('keeps non-credential warnings for local providers', () => {
    expect(shouldShowCredentialWarning('The local runtime is unreachable.', 'ollama-local')).toBe(true)
  })
})

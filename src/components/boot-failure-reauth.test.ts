import { describe, expect, it } from 'vitest'

import type { DesktopConnectionConfig } from '@/global'

import { deriveProviderShape, isRemoteReauthFailure, signInLabel } from './boot-failure-reauth'

function config(overrides: Partial<DesktopConnectionConfig> = {}): DesktopConnectionConfig {
  return {
    envOverride: false,
    mode: 'remote',
    profile: null,
    remoteAuthMode: 'oauth',
    remoteOauthConnected: false,
    remoteTokenPreview: null,
    remoteTokenSet: false,
    remoteUrl: 'https://box:9119',
    ...overrides
  }
}

describe('isRemoteReauthFailure', () => {
  it('true for a remote, gated, disconnected gateway with a URL', () => {
    expect(isRemoteReauthFailure(config())).toBe(true)
  })

  it('false when the oauth session is still connected', () => {
    expect(isRemoteReauthFailure(config({ remoteOauthConnected: true }))).toBe(false)
  })

  it('false for a local gateway', () => {
    expect(isRemoteReauthFailure(config({ mode: 'local' }))).toBe(false)
  })

  it('false for a token remote gateway', () => {
    expect(isRemoteReauthFailure(config({ remoteAuthMode: 'token' }))).toBe(false)
  })

  it('false when there is no remote URL', () => {
    expect(isRemoteReauthFailure(config({ remoteUrl: '' }))).toBe(false)
  })
})

describe('deriveProviderShape', () => {
  it('falls back to generic provider copy', () => {
    expect(deriveProviderShape([])).toEqual({ isPassword: false, providerLabel: 'your identity provider' })
  })

  it('detects password providers', () => {
    expect(
      deriveProviderShape([{ name: 'basic', displayName: 'Username & Password', supportsPassword: true }])
    ).toEqual({ isPassword: true, providerLabel: 'Username & Password' })
  })

  it('keeps oauth copy for mixed deployments', () => {
    const shape = deriveProviderShape([
      { name: 'basic', displayName: 'Username & Password', supportsPassword: true },
      { name: 'nous', displayName: 'Nous Research', supportsPassword: false }
    ])

    expect(shape.isPassword).toBe(false)
    expect(shape.providerLabel).toBe('Username & Password / Nous Research')
  })
})

describe('signInLabel', () => {
  it('uses the plain remote copy for password gateways', () => {
    expect(signInLabel({ url: 'x', isPassword: true, providerLabel: 'Username & Password' })).toBe(
      'Sign in to remote gateway'
    )
  })

  it('uses the provider-specific oauth copy', () => {
    expect(signInLabel({ url: 'x', isPassword: false, providerLabel: 'Nous Research' })).toBe(
      'Sign in with Nous Research'
    )
  })
})

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProfileInfo } from '@/types/hermes'

const getProfiles = vi.fn()
const setApiRequestProfile = vi.fn()

vi.mock('@/hermes', () => ({
  getProfiles: (...args: unknown[]) => getProfiles(...args),
  setApiRequestProfile: (...args: unknown[]) => setApiRequestProfile(...args)
}))

function makeProfile(name: string, isDefault = false): ProfileInfo {
  return {
    has_env: false,
    is_default: isDefault,
    model: null,
    name,
    path: '',
    provider: null,
    skill_count: 0
  }
}

describe('profile store', () => {
  beforeEach(async () => {
    getProfiles.mockReset()
    setApiRequestProfile.mockReset()

    Object.defineProperty(window, 'hermesDesktop', {
      configurable: true,
      value: {
        api: vi.fn(async () => ({ active: 'default', current: 'default' }))
      }
    })

    const { $profiles } = await import('./profile')
    $profiles.set([])
  })

  it('adds a default profile fallback when a list omits it', async () => {
    const { profilesWithDefaultFallback } = await import('./profile')

    expect(profilesWithDefaultFallback([makeProfile('writer')]).map(profile => profile.name)).toEqual([
      'default',
      'writer'
    ])
  })

  it('keeps the cached profile list when refresh returns an empty transient list', async () => {
    const { $profiles, refreshActiveProfile } = await import('./profile')
    const cached = [makeProfile('default', true), makeProfile('writer')]

    $profiles.set(cached)
    getProfiles.mockResolvedValueOnce({ profiles: [] })

    await refreshActiveProfile()

    expect($profiles.get()).toEqual(cached)
  })
})

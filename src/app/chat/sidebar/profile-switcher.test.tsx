// @vitest-environment jsdom

import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refreshActiveProfile = vi.fn(async () => undefined)
const navigate = vi.fn()

vi.mock('@nanostores/react', () => ({
  useStore: (store: { get: () => unknown }) => store.get()
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      sidebar: {
        allProfiles: 'All profiles',
        createProfile: 'Create profile',
        defaultProfile: 'Default profile',
        manageProfiles: 'Manage profiles',
        profiles: 'Profiles'
      }
    }
  })
}))

vi.mock('@/lib/profile-color', () => ({
  resolveProfileColor: (name: string) => `color:${name}`
}))

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')
}))

vi.mock('@/store/profile', () => ({
  $activeGatewayProfile: { get: () => 'default' },
  $profileColors: { get: () => ({}) },
  $profileCreateRequest: { get: () => 0 },
  $profileScope: { get: () => 'default' },
  $profiles: {
    get: () => [
      {
        has_env: false,
        is_default: true,
        model: null,
        name: 'default',
        path: '',
        provider: null,
        skill_count: 0
      },
      {
        has_env: false,
        is_default: false,
        model: null,
        name: 'writer',
        path: '',
        provider: null,
        skill_count: 0
      }
    ]
  },
  ALL_PROFILES: '__all__',
  profilesWithDefaultFallback: (profiles: unknown[]) => profiles,
  refreshActiveProfile: (...args: unknown[]) => refreshActiveProfile(...args),
  selectProfile: vi.fn(),
  setShowAllProfiles: vi.fn()
}))

vi.mock('@/store/session', () => ({
  $gatewayState: { get: () => gatewayState }
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>
}))

vi.mock('@/components/ui/codicon', () => ({
  Codicon: ({ name }: { name: string }) => <span>{name}</span>
}))

vi.mock('../../profiles/create-profile-dialog', () => ({
  CreateProfileDialog: () => null
}))

vi.mock('../../routes', () => ({
  PROFILES_ROUTE: '/profiles'
}))

import { ProfileRail } from './profile-switcher'

let gatewayState = 'idle'

describe('ProfileRail', () => {
  beforeEach(() => {
    gatewayState = 'idle'
    navigate.mockReset()
    refreshActiveProfile.mockReset()
  })

  it('refreshes profiles again when the gateway becomes ready after first paint', async () => {
    const { rerender } = render(<ProfileRail />)

    expect(refreshActiveProfile).toHaveBeenCalledTimes(1)

    gatewayState = 'open'
    rerender(<ProfileRail />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(refreshActiveProfile).toHaveBeenCalledTimes(2)
  })
})

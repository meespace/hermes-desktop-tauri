import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { resolveProfileColor } from '@/lib/profile-color'
import { cn } from '@/lib/utils'
import {
  $activeGatewayProfile,
  $profileColors,
  $profileCreateRequest,
  $profileScope,
  $profiles,
  ALL_PROFILES,
  profilesWithDefaultFallback,
  refreshActiveProfile,
  selectProfile,
  setShowAllProfiles
} from '@/store/profile'
import { $gatewayState } from '@/store/session'

import { CreateProfileDialog } from '../../profiles/create-profile-dialog'
import { PROFILES_ROUTE } from '../../routes'

export function ProfileRail({ className }: { className?: string }) {
  const { t } = useI18n()
  const s = t.sidebar
  const navigate = useNavigate()
  const storedProfiles = useStore($profiles)
  const activeProfile = useStore($activeGatewayProfile)
  const profileScope = useStore($profileScope)
  const colors = useStore($profileColors)
  const createRequest = useStore($profileCreateRequest)
  const gatewayState = useStore($gatewayState)
  const [createOpen, setCreateOpen] = useState(false)
  const lastCreateRequest = useRef(createRequest)
  const previousGatewayState = useRef(gatewayState)
  const profiles = profilesWithDefaultFallback(storedProfiles)
  const defaultProfile = profiles.find(profile => profile.is_default)
  const namedProfiles = profiles.filter(profile => !profile.is_default)
  const multiProfile = profiles.length > 1

  useEffect(() => {
    void refreshActiveProfile()
  }, [])

  useEffect(() => {
    const becameReady = previousGatewayState.current !== 'open' && gatewayState === 'open'
    previousGatewayState.current = gatewayState

    if (becameReady) {
      void refreshActiveProfile()
    }
  }, [gatewayState])

  useEffect(() => {
    if (createRequest === lastCreateRequest.current) {
      return
    }

    lastCreateRequest.current = createRequest
    setCreateOpen(true)
  }, [createRequest])

  return (
    <div className={cn('heroui-profile-rail', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {multiProfile && (
          <button
            aria-label={s.allProfiles}
            aria-pressed={profileScope === ALL_PROFILES}
            className={cn(
              'heroui-profile-chip',
              profileScope === ALL_PROFILES && 'is-active'
            )}
            onClick={() => setShowAllProfiles(true)}
            title={s.allProfiles}
            type="button"
          >
            All
          </button>
        )}

        {defaultProfile && (
          <button
            aria-label={`${s.profiles}: ${s.defaultProfile}`}
            aria-pressed={profileScope !== ALL_PROFILES && activeProfile === defaultProfile.name}
            className={cn(
              'heroui-profile-chip',
              profileScope !== ALL_PROFILES && activeProfile === defaultProfile.name && 'is-active'
            )}
            onClick={() => selectProfile(defaultProfile.name)}
            title={s.defaultProfile}
            type="button"
          >
            <Codicon name="home" size="0.78rem" />
          </button>
        )}

        {namedProfiles.map(profile => {
          const active =
            profileScope !== ALL_PROFILES &&
            (activeProfile === profile.name || (profile.is_default && activeProfile === 'default'))
          const color = resolveProfileColor(profile.name, colors) ?? 'var(--muted)'
          const label = profile.name

          return (
            <button
              aria-label={`${s.profiles}: ${label}`}
              aria-pressed={active}
              className={cn(
                'heroui-profile-chip',
                active && 'is-active'
              )}
              key={profile.name}
              onClick={() => selectProfile(profile.name)}
              title={label}
              type="button"
            >
              <span className="size-2.5 rounded-full border border-white/70" style={{ background: color }} />
            </button>
          )
        })}
      </div>
      <Button
        aria-label={s.createProfile}
        className="heroui-profile-action"
        onClick={() => setCreateOpen(true)}
        size="icon-xs"
        title={s.createProfile}
        variant="ghost"
      >
        <Codicon name="add" size="0.75rem" />
      </Button>
      <Button
        aria-label={s.manageProfiles}
        className="heroui-profile-action"
        onClick={() => navigate(PROFILES_ROUTE)}
        size="icon-xs"
        title={s.manageProfiles}
        variant="ghost"
        hidden={!multiProfile}
      >
        <Codicon name="account" size="0.75rem" />
      </Button>
      <CreateProfileDialog
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await refreshActiveProfile()
        }}
        open={createOpen}
      />
    </div>
  )
}

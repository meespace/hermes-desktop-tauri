import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { setRightSidebarTab } from '@/app/right-sidebar/store'
import { PROFILE_SLOT_COUNT } from '@/lib/keybinds/actions'
import { comboAllowedInInput, comboFromEvent, isEditableTarget } from '@/lib/keybinds/combo'
import { toggleCommandPalette } from '@/store/command-palette'
import { $capture, $comboIndex, endCapture, setBinding, toggleKeybindPanel } from '@/store/keybinds'
import { requestSessionSearchFocus, toggleFileBrowserOpen, toggleSidebarOpen } from '@/store/layout'
import {
  cycleProfile,
  requestProfileCreate,
  switchProfileToSlot,
  switchToDefaultProfile,
  toggleShowAllProfiles
} from '@/store/profile'
import { $activeSessionId, $sessions, setModelPickerOpen } from '@/store/session'
import { useTheme } from '@/themes/context'

import { requestComposerFocus } from '../chat/composer/focus'
import {
  AGENTS_ROUTE,
  ARTIFACTS_ROUTE,
  CRON_ROUTE,
  MESSAGING_ROUTE,
  PROFILES_ROUTE,
  sessionRoute,
  SETTINGS_ROUTE,
  SKILLS_ROUTE
} from '../routes'

export interface KeybindRuntimeDeps {
  startFreshSession: () => void
  toggleCommandCenter: () => void
  toggleSelectedPin: () => void
}

type HandlerMap = Record<string, () => void>

export function useKeybinds(deps: KeybindRuntimeDeps): void {
  const navigate = useNavigate()
  const { resolvedMode, setMode } = useTheme()
  const handlersRef = useRef<HandlerMap>({})

  const profileSwitchHandlers: HandlerMap = {}

  for (let slot = 1; slot <= PROFILE_SLOT_COUNT; slot += 1) {
    profileSwitchHandlers[`profile.switch.${slot}`] = () => switchProfileToSlot(slot)
  }

  const cycleSession = (direction: 1 | -1) => {
    const sessions = $sessions.get()

    if (sessions.length < 2) {
      return
    }

    const current = sessions.findIndex(session => session.id === $activeSessionId.get())
    const start = current === -1 ? (direction === 1 ? -1 : 0) : current
    const next = sessions[(start + direction + sessions.length) % sessions.length]

    if (next) {
      navigate(sessionRoute(next.id))
    }
  }

  const showRightSidebarTab = (tab: 'files' | 'terminal') => {
    setRightSidebarTab(tab)
    toggleFileBrowserOpen()
  }

  handlersRef.current = {
    'appearance.toggleMode': () => setMode(resolvedMode === 'dark' ? 'light' : 'dark'),
    'composer.focus': () => requestComposerFocus('main'),
    'composer.modelPicker': () => setModelPickerOpen(true),
    'keybinds.openPanel': toggleKeybindPanel,
    'nav.agents': () => navigate(AGENTS_ROUTE),
    'nav.artifacts': () => navigate(ARTIFACTS_ROUTE),
    'nav.commandCenter': deps.toggleCommandCenter,
    'nav.commandPalette': toggleCommandPalette,
    'nav.cron': () => navigate(CRON_ROUTE),
    'nav.messaging': () => navigate(MESSAGING_ROUTE),
    'nav.profiles': () => navigate(PROFILES_ROUTE),
    'nav.settings': () => navigate(SETTINGS_ROUTE),
    'nav.skills': () => navigate(SKILLS_ROUTE),
    'profile.create': requestProfileCreate,
    'profile.default': switchToDefaultProfile,
    'profile.next': () => cycleProfile(1),
    'profile.prev': () => cycleProfile(-1),
    'profile.toggleAll': toggleShowAllProfiles,
    ...profileSwitchHandlers,
    'session.focusSearch': requestSessionSearchFocus,
    'session.new': deps.startFreshSession,
    'session.next': () => cycleSession(1),
    'session.prev': () => cycleSession(-1),
    'session.togglePin': deps.toggleSelectedPin,
    'view.showFiles': () => showRightSidebarTab('files'),
    'view.showTerminal': () => showRightSidebarTab('terminal'),
    'view.toggleRightSidebar': toggleFileBrowserOpen,
    'view.toggleSidebar': toggleSidebarOpen
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const capturing = $capture.get()

      if (capturing) {
        event.preventDefault()
        event.stopPropagation()

        if (event.key === 'Escape') {
          endCapture()

          return
        }

        const combo = comboFromEvent(event)

        if (!combo) {
          return
        }

        setBinding(capturing, [combo])
        endCapture()

        return
      }

      const combo = comboFromEvent(event)

      if (!combo) {
        return
      }

      const actionId = $comboIndex.get().get(combo)

      if (!actionId || (isEditableTarget(event.target) && !comboAllowedInInput(combo))) {
        return
      }

      const handler = handlersRef.current[actionId]

      if (!handler) {
        return
      }

      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])
}

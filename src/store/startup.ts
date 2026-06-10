import { atom } from 'nanostores'

export interface StartupShellState {
  canReturnToApp: boolean
  entered: boolean
  resetToken: number
  visible: boolean
}

const STARTUP_GUIDE_CACHE_KEY = 'hermes-startup-guide-completed-v1'

function readCachedCompleted(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(STARTUP_GUIDE_CACHE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCachedCompleted(value: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (value) {
      window.localStorage.setItem(STARTUP_GUIDE_CACHE_KEY, '1')
    } else {
      window.localStorage.removeItem(STARTUP_GUIDE_CACHE_KEY)
    }
  } catch {
    // localStorage unavailable — degrade silently.
  }
}

function initialState(): StartupShellState {
  if (readCachedCompleted()) {
    return {
      canReturnToApp: true,
      entered: true,
      resetToken: 0,
      visible: false
    }
  }

  return {
    canReturnToApp: false,
    entered: false,
    resetToken: 0,
    visible: true
  }
}

export const $startupShell = atom<StartupShellState>(initialState())

export function restoreStartupShellFromCache() {
  $startupShell.set(initialState())
}

export function openStartupGuide() {
  const current = $startupShell.get()

  $startupShell.set({
    canReturnToApp: current.entered,
    entered: false,
    resetToken: current.resetToken + 1,
    visible: true
  })
}

export function closeStartupGuide() {
  const current = $startupShell.get()

  if (!current.canReturnToApp) {
    return
  }

  $startupShell.set({
    ...current,
    entered: true,
    visible: false
  })
}

export function completeStartupGuide() {
  const current = $startupShell.get()
  writeCachedCompleted(true)

  $startupShell.set({
    canReturnToApp: true,
    entered: true,
    resetToken: current.resetToken,
    visible: false
  })
}

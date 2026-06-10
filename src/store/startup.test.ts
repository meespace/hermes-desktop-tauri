// @vitest-environment jsdom

import '@/test/mock-local-storage'

import { afterEach, describe, expect, it } from 'vitest'

import { $startupShell, closeStartupGuide, completeStartupGuide, openStartupGuide, restoreStartupShellFromCache } from './startup'

describe('startup shell store', () => {
  afterEach(() => {
    window.localStorage.clear()
    restoreStartupShellFromCache()
  })

  it('starts in first-launch mode', () => {
    restoreStartupShellFromCache()

    expect($startupShell.get()).toEqual({
      canReturnToApp: false,
      entered: false,
      resetToken: 0,
      visible: true
    })
  })

  it('marks startup as completed after entry', () => {
    completeStartupGuide()

    expect($startupShell.get()).toEqual({
      canReturnToApp: true,
      entered: true,
      resetToken: 0,
      visible: false
    })
    expect(window.localStorage.getItem('hermes-startup-guide-completed-v1')).toBe('1')
  })

  it('reopens from settings and can return to the app', () => {
    completeStartupGuide()
    openStartupGuide()

    expect($startupShell.get()).toEqual({
      canReturnToApp: true,
      entered: false,
      resetToken: 1,
      visible: true
    })

    closeStartupGuide()

    expect($startupShell.get()).toEqual({
      canReturnToApp: true,
      entered: true,
      resetToken: 1,
      visible: false
    })
  })

  it('restores directly into the app after the guide was completed before', () => {
    window.localStorage.setItem('hermes-startup-guide-completed-v1', '1')
    restoreStartupShellFromCache()

    expect($startupShell.get()).toEqual({
      canReturnToApp: true,
      entered: true,
      resetToken: 0,
      visible: false
    })
  })
})

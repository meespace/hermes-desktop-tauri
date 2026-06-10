// @vitest-environment jsdom

import '@/test/mock-local-storage'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'
import { restoreStartupShellFromCache } from '@/store/startup'

import { StartupController } from './startup-controller'

describe('StartupController layout', () => {
  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    restoreStartupShellFromCache()
  })

  it('uses a scrollable content viewport inside the startup card', () => {
    render(
      <I18nProvider configClient={null} initialLocale="zh">
        <StartupController />
      </I18nProvider>
    )

    const card = document.querySelector('[data-slot="startup-surface-card"]')
    const viewport = document.querySelector('[data-slot="startup-surface-viewport"]')

    expect(card).toBeTruthy()
    expect(card?.className).toContain('max-h-[calc(100vh-3rem)]')
    expect(card?.className).toContain('flex')
    expect(viewport).toBeTruthy()
    expect(viewport?.className).toContain('overflow-y-auto')
    expect(viewport?.className).toContain('min-h-0')
    expect(viewport?.className).toContain('flex-1')
  })
})

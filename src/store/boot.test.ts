import { beforeEach, describe, expect, it } from 'vitest'

import { $desktopBoot, applyDesktopBootProgress, sanitizeBootProgress } from '@/store/boot'

function resetBootState() {
  $desktopBoot.set({
    error: null,
    fakeMode: false,
    message: 'Starting Hermes Desktop Community…',
    phase: 'renderer.init',
    progress: 2,
    running: true,
    timestamp: 1,
    visible: true
  })
}

describe('desktop boot store', () => {
  beforeEach(() => {
    resetBootState()
  })

  it('ignores stale backend progress after renderer boot completes', () => {
    $desktopBoot.set({
      error: null,
      fakeMode: false,
      message: 'Hermes Desktop Community is ready',
      phase: 'renderer.ready',
      progress: 100,
      running: false,
      timestamp: 200,
      visible: false
    })

    applyDesktopBootProgress({
      error: null,
      fakeMode: false,
      message: 'Hermes backend is ready. Finalizing desktop startup',
      phase: 'backend.ready',
      progress: 94,
      running: true,
      timestamp: 150
    })

    expect($desktopBoot.get()).toMatchObject({
      message: 'Hermes Desktop Community is ready',
      phase: 'renderer.ready',
      progress: 100,
      running: false,
      visible: false
    })
  })

  it('sanitizes local provider missing api key boot warnings before rendering', () => {
    const progress = sanitizeBootProgress({
      error: "No API key configured for provider 'ollama-local'. First message will fail.",
      fakeMode: false,
      message: "No API key configured for provider 'ollama-local'. First message will fail.",
      phase: 'backend.ready',
      progress: 100,
      running: false,
      timestamp: 10
    })

    expect(progress.error).toBeNull()
    expect(progress.message).toBe('Hermes Desktop Community is ready')
  })

  it('keeps remote provider missing api key boot warnings', () => {
    const progress = sanitizeBootProgress({
      error: "No API key configured for provider 'openrouter'. First message will fail.",
      fakeMode: false,
      message: "No API key configured for provider 'openrouter'. First message will fail.",
      phase: 'backend.ready',
      progress: 100,
      running: false,
      timestamp: 10
    })

    expect(progress.error).toContain('openrouter')
  })

  it('does not show boot overlay for completed local missing key warnings', () => {
    applyDesktopBootProgress({
      error: "No API key configured for provider 'ollama-local'. First message will fail.",
      fakeMode: false,
      message: "No API key configured for provider 'ollama-local'. First message will fail.",
      phase: 'backend.ready',
      progress: 100,
      running: false,
      timestamp: 10
    })

    expect($desktopBoot.get()).toMatchObject({
      error: null,
      message: 'Hermes Desktop Community is ready',
      progress: 100,
      running: false,
      visible: false
    })
  })
})

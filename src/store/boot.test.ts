import { beforeEach, describe, expect, it } from 'vitest'

import { $desktopBoot, applyDesktopBootProgress } from '@/store/boot'

function resetBootState() {
  $desktopBoot.set({
    error: null,
    fakeMode: false,
    message: 'Starting Hermes Desktop…',
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
      message: 'Hermes Desktop is ready',
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
      message: 'Hermes Desktop is ready',
      phase: 'renderer.ready',
      progress: 100,
      running: false,
      visible: false
    })
  })
})

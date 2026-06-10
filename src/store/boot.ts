import { atom } from 'nanostores'

import { providerFromCredentialWarning, shouldShowCredentialWarning } from '@/lib/credential-warning'
import type { DesktopBootProgress } from '@/global'

export interface DesktopBootState extends DesktopBootProgress {
  visible: boolean
}

const INITIAL_BOOT_STATE: DesktopBootState = {
  error: null,
  fakeMode: false,
  message: 'Starting Hermes Desktop Community…',
  phase: 'renderer.init',
  progress: 2,
  running: true,
  timestamp: Date.now(),
  visible: true
}

export const $desktopBoot = atom<DesktopBootState>(INITIAL_BOOT_STATE)

export function sanitizeBootProgress(progress: DesktopBootProgress): DesktopBootProgress {
  const provider = providerFromCredentialWarning(progress.error || progress.message)

  if (
    provider &&
    !shouldShowCredentialWarning(progress.error || progress.message, provider)
  ) {
    return {
      ...progress,
      error: null,
      message: progress.progress >= 100 ? 'Hermes Desktop Community is ready' : 'Starting Hermes Desktop Community…'
    }
  }

  return progress
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

export function applyDesktopBootProgress(progress: DesktopBootProgress) {
  progress = sanitizeBootProgress(progress)
  const current = $desktopBoot.get()
  const currentTimestamp = Number.isFinite(current.timestamp) ? current.timestamp : 0
  const incomingTimestamp = Number.isFinite(progress.timestamp) ? progress.timestamp : 0

  if (incomingTimestamp < currentTimestamp) {
    return
  }

  const nextProgress = clampProgress(progress.progress)
  const mergedProgress = progress.running ? Math.max(current.progress, nextProgress) : nextProgress

  $desktopBoot.set({
    ...current,
    ...progress,
    error: progress.error ?? null,
    progress: mergedProgress,
    visible: progress.running || mergedProgress < 100 || Boolean(progress.error)
  })
}

export function setDesktopBootStep(step: {
  phase: string
  message: string
  progress: number
  running?: boolean
  fakeMode?: boolean
  error?: string | null
}) {
  const current = $desktopBoot.get()
  applyDesktopBootProgress({
    error: step.error ?? null,
    fakeMode: step.fakeMode ?? current.fakeMode,
    message: step.message,
    phase: step.phase,
    progress: step.progress,
    running: step.running ?? true,
    timestamp: Date.now()
  })
}

export function completeDesktopBoot(message = 'Hermes Desktop Community is ready') {
  const current = $desktopBoot.get()
  $desktopBoot.set({
    ...current,
    error: null,
    message,
    phase: 'renderer.ready',
    progress: 100,
    running: false,
    timestamp: Date.now(),
    visible: false
  })
}

export function failDesktopBoot(message: string) {
  const current = $desktopBoot.get()
  $desktopBoot.set({
    ...current,
    error: message,
    message: `Desktop boot failed: ${message}`,
    phase: 'renderer.error',
    progress: clampProgress(current.progress),
    running: false,
    timestamp: Date.now(),
    visible: true
  })
}

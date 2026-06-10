/**
 * Desktop self-update store. Tracks distance from the configured branch,
 * surfaces it as an ambient pill, and orchestrates the apply flow.
 */

import { atom } from 'nanostores'

import type {
  DesktopUpdateApplyOptions,
  DesktopUpdateApplyResult,
  DesktopUpdateProgress,
  DesktopUpdateStage,
  DesktopUpdateStatus,
  DesktopVersionInfo
} from '@/global'

export interface UpdateApplyState {
  applying: boolean
  stage: DesktopUpdateStage
  message: string
  percent: number | null
  error: string | null
  /** When the stage is 'manual': the exact command the user should run
   *  (CLI install with no staged updater). */
  command: string | null
  log: readonly { stage: DesktopUpdateStage; message: string; at: number }[]
}

const IDLE: UpdateApplyState = {
  applying: false,
  stage: 'idle',
  message: '',
  percent: null,
  error: null,
  command: null,
  log: []
}

export const $desktopVersion = atom<DesktopVersionInfo | null>(null)
export const $updateApply = atom<UpdateApplyState>(IDLE)
export const $updateChecking = atom<boolean>(false)
export const $updateOverlayOpen = atom<boolean>(false)
export const $updateStatus = atom<DesktopUpdateStatus | null>(null)

export const setUpdateOverlayOpen = (open: boolean) => $updateOverlayOpen.set(open)
export const resetUpdateApplyState = () => $updateApply.set(IDLE)

/**
 * Manual-update mode: compatibility skew is still detected upstream, but the
 * desktop no longer surfaces global upgrade nudges on its own.
 */
export function reportBackendContract(_contract: number | undefined): void {
  return
}

/**
 * Opens the updates dialog and kicks off a fresh check so the user always
 * sees current state, even if a stale status is cached from earlier.
 */
export function openUpdatesWindow(): void {
  $updateOverlayOpen.set(true)
  void checkUpdates()
}

/** Re-read the running app's version from the desktop bridge and
 *  publish it on `$desktopVersion`. Called when the About panel mounts, the
 *  update flow finishes, and the window regains focus, so the About text
 *  stays in sync with the just-installed binary instead of frozen at the
 *  value captured at first-load. */
export async function refreshDesktopVersion(): Promise<DesktopVersionInfo | null> {
  if (typeof window === 'undefined') {
    return null
  }

  // Best-effort UI sync: callers (checkUpdates, startUpdatePoller) kick this
  // off with `void refreshDesktopVersion()`,
  // so any rejection from the IPC bridge (e.g. main process shutting down
  // mid-reload, or the bridge not yet ready on first paint) would surface
  // as an unhandled promise rejection in the renderer. Swallow it.
  try {
    const next = await window.hermesDesktop?.getVersion?.()

    if (next) {
      $desktopVersion.set(next)
    }

    return next ?? null
  } catch {
    return null
  }
}

export async function checkUpdates(): Promise<DesktopUpdateStatus | null> {
  const bridge = window.hermesDesktop?.updates

  if (!bridge || $updateChecking.get()) {
    return $updateStatus.get()
  }

  $updateChecking.set(true)

  try {
    const status = await bridge.check()
    $updateStatus.set(status)
    // The update check pulls the latest hermes_cli + bundled package metadata
    // into place. Re-read the running version so About reflects the now-fresh
    // checkout rather than the one captured at process start.
    void refreshDesktopVersion()

    return status
  } catch (error) {
    const previous = $updateStatus.get()

    const fallback: DesktopUpdateStatus = {
      supported: previous?.supported ?? true,
      branch: previous?.branch,
      error: 'check-failed',
      message: error instanceof Error ? error.message : String(error),
      fetchedAt: Date.now()
    }

    $updateStatus.set(fallback)

    return fallback
  } finally {
    $updateChecking.set(false)
  }
}

export async function applyUpdates(opts: DesktopUpdateApplyOptions = {}): Promise<DesktopUpdateApplyResult> {
  const bridge = window.hermesDesktop?.updates

  if (!bridge) {
    return { ok: false, error: 'unavailable', message: 'Desktop bridge unavailable.' }
  }

  $updateApply.set({ ...IDLE, applying: true, stage: 'prepare', message: 'Starting update…' })

  try {
    const result = await bridge.apply(opts)

    // CLI install with no staged updater: not an error — the user just runs
    // `hermes update` themselves. Land on a dedicated manual state so the
    // overlay shows the command + copy button instead of a dead retry loop.
    if (result?.manual) {
      $updateApply.set({
        ...IDLE,
        applying: false,
        stage: 'manual',
        message: result.command ?? 'hermes update',
        command: result.command ?? 'hermes update'
      })
    }

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    $updateApply.set({ ...$updateApply.get(), applying: false, stage: 'error', error: 'apply-failed', message })

    return { ok: false, error: 'apply-failed', message }
  }
}

function ingestProgress(payload: DesktopUpdateProgress): void {
  const current = $updateApply.get()
  const log = [...current.log, { stage: payload.stage, message: payload.message, at: payload.at }].slice(-50)
  const terminal =
    payload.stage === 'error' || payload.stage === 'restart' || payload.stage === 'manual' || payload.stage === 'done'

  $updateApply.set({
    applying: !terminal,
    stage: payload.stage,
    message: payload.message,
    percent: payload.percent,
    error: payload.error,
    // 'manual' carries the command to run in its message field.
    command: payload.stage === 'manual' ? payload.message : current.command,
    log
  })
}

let pollerStarted = false
let progressUnsubscribe: (() => void) | null = null

/** Wire up update progress streaming and a one-time version sync. Idempotent. */
export function startUpdatePoller(): void {
  if (pollerStarted || typeof window === 'undefined') {
    return
  }

  const bridge = window.hermesDesktop?.updates

  if (!bridge) {
    return
  }

  pollerStarted = true
  void refreshDesktopVersion()
  progressUnsubscribe = bridge.onProgress(ingestProgress)
}

export function stopUpdatePoller(): void {
  progressUnsubscribe?.()
  progressUnsubscribe = null
  pollerStarted = false
}

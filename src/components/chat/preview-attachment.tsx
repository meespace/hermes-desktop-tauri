import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { MonitorPlay } from '@/lib/icons'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { previewName } from '@/lib/preview-targets'
import { notifyError } from '@/store/notifications'
import {
  $previewTarget,
  dismissPreviewTarget,
  type PreviewRecordSource,
  setCurrentSessionPreviewTarget
} from '@/store/preview'
import { $currentCwd } from '@/store/session'

export function PreviewAttachment({ source = 'manual', target }: { source?: PreviewRecordSource; target: string }) {
  const cwd = useStore($currentCwd)
  const activePreview = useStore($previewTarget)
  const [opening, setOpening] = useState(false)
  const activePreviewRef = useRef(activePreview)
  const cwdRef = useRef(cwd)
  const mountedRef = useRef(false)
  const requestTokenRef = useRef(0)
  const targetRef = useRef(target)
  const name = previewName(target)
  const isActive = activePreview?.source === target

  activePreviewRef.current = activePreview
  cwdRef.current = cwd
  targetRef.current = target

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      requestTokenRef.current += 1
    }
  }, [])

  useEffect(() => {
    requestTokenRef.current += 1
    setOpening(false)
  }, [cwd, target])

  async function togglePreview() {
    if (opening) {
      return
    }

    if (isActive) {
      dismissPreviewTarget()

      return
    }

    const requestToken = ++requestTokenRef.current
    const requestTarget = target
    const requestCwd = cwd

    setOpening(true)

    try {
      const preview = await normalizeOrLocalPreviewTarget(requestTarget, requestCwd || undefined)

      if (
        !mountedRef.current ||
        requestTokenRef.current !== requestToken ||
        targetRef.current !== requestTarget ||
        cwdRef.current !== requestCwd
      ) {
        return
      }

      if (!preview) {
        throw new Error(`Could not open preview target: ${requestTarget}`)
      }

      const currentPreview = activePreviewRef.current

      if (currentPreview?.source === preview.source && currentPreview.url === preview.url) {
        return
      }

      setCurrentSessionPreviewTarget(preview, source, requestTarget)
    } catch (error) {
      if (
        !mountedRef.current ||
        requestTokenRef.current !== requestToken ||
        targetRef.current !== requestTarget ||
        cwdRef.current !== requestCwd
      ) {
        return
      }

      notifyError(error, 'Preview unavailable')
    } finally {
      if (mountedRef.current && requestTokenRef.current === requestToken) {
        setOpening(false)
      }
    }
  }

  return (
    <div className="flex w-full max-w-160 flex-wrap items-center gap-2.5 rounded-[calc(var(--radius)*1.75)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm shadow-[var(--field-shadow)]">
      <span className="grid size-7 shrink-0 place-items-center rounded-[calc(var(--radius)*1.25)] bg-[var(--surface-secondary)] text-[var(--muted)] shadow-[var(--field-shadow)]">
        <MonitorPlay className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.78rem] font-medium leading-[1.15rem] text-foreground/90">{name}</div>
        <div className="truncate font-mono text-[0.66rem] leading-4 text-[color-mix(in_srgb,var(--foreground)_56%,transparent)]">
          {target}
        </div>
      </div>
      <button
        className="ml-auto shrink-0 rounded-[calc(var(--radius)*1.25)] border border-[var(--border)] bg-[var(--surface-secondary)] px-2 py-1 text-[0.7rem] font-medium text-[var(--muted)] shadow-[var(--field-shadow)] transition-[background-color,border-color,color] hover:bg-[var(--surface)] hover:text-foreground disabled:opacity-50 max-[28rem]:ml-9 max-[28rem]:w-[calc(100%-2.25rem)]"
        disabled={opening}
        onClick={() => void togglePreview()}
        type="button"
      >
        {opening ? 'Opening…' : isActive ? 'Hide' : 'Open preview'}
      </button>
    </div>
  )
}

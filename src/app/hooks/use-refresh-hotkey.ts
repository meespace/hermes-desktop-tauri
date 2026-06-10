import { useEffect, useRef } from 'react'

export function useRefreshHotkey(onRefresh: () => void, enabled = true) {
  const ref = useRef(onRefresh)
  ref.current = onRefresh

  useEffect(() => {
    if (!enabled) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'r' && event.key !== 'R') {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) {
        return
      }

      const target = event.target as HTMLElement | null

      if (
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }

      event.preventDefault()
      ref.current()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

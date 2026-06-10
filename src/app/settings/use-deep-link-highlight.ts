import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

interface DeepLinkHighlightOptions {
  block?: ScrollLogicalPosition
  elementId: (target: string) => string
  onResolve?: (target: string) => void
  param: string
  ready: (target: string) => boolean
}

export function useDeepLinkHighlight({
  block = 'center',
  elementId,
  onResolve,
  param,
  ready
}: DeepLinkHighlightOptions): null | string {
  const [searchParams, setSearchParams] = useSearchParams()
  const target = searchParams.get(param)

  useEffect(() => {
    if (!target || !ready(target)) {
      return
    }

    onResolve?.(target)

    const scrollTimeout = window.setTimeout(() => {
      const element = document.getElementById(elementId(target))

      if (!element) {
        return
      }

      element.scrollIntoView({ behavior: 'smooth', block })
      element.classList.add('setting-field-highlight')
      window.setTimeout(() => element.classList.remove('setting-field-highlight'), 1600)
    }, 80)

    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous)
        next.delete(param)

        return next
      },
      { replace: true }
    )

    return () => window.clearTimeout(scrollTimeout)
  }, [block, elementId, onResolve, param, ready, setSearchParams, target])

  return target
}

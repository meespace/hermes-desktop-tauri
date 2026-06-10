import type { ReactNode } from 'react'

import { Check, Loader2 } from '@/lib/icons'

export function ActionStatus({
  state,
  idle,
  busy,
  done,
  idleIcon = null
}: {
  state: 'done' | 'idle' | 'saving'
  idle: string
  busy: string
  done: string
  idleIcon?: ReactNode
}) {
  return (
    <>
      {state === 'saving' ? <Loader2 className="size-3.5 animate-spin" /> : state === 'done' ? <Check className="size-3.5" /> : idleIcon}
      {state === 'saving' ? busy : state === 'done' ? done : idle}
    </>
  )
}

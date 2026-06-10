import { atom, computed } from 'nanostores'

import { $activeSessionId } from './session'

export interface ClarifyRequest {
  requestId: string
  question: string
  choices: string[] | null
  sessionId: string | null
}

const keyFor = (sessionId: string | null | undefined): string => sessionId ?? ''

export const $clarifyRequests = atom<Record<string, ClarifyRequest>>({})

export const $clarifyRequest = computed(
  [$clarifyRequests, $activeSessionId],
  (requests, activeId) => requests[keyFor(activeId)] ?? null
)

export function setClarifyRequest(request: ClarifyRequest): void {
  $clarifyRequests.set({ ...$clarifyRequests.get(), [keyFor(request.sessionId)]: request })
}

export function clearClarifyRequest(requestId?: string, sessionId?: string | null): void {
  const requests = $clarifyRequests.get()

  if (sessionId !== undefined) {
    const key = keyFor(sessionId)
    const current = requests[key]

    if (!current || (requestId && current.requestId !== requestId)) {
      return
    }

    const next = { ...requests }
    delete next[key]
    $clarifyRequests.set(next)

    return
  }

  const next: Record<string, ClarifyRequest> = {}
  let changed = false

  for (const [key, value] of Object.entries(requests)) {
    if (requestId && value.requestId !== requestId) {
      next[key] = value
    } else {
      changed = true
    }
  }

  if (changed) {
    $clarifyRequests.set(next)
  }
}

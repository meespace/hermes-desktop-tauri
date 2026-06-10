import { atom, computed, type ReadableAtom } from 'nanostores'

import { $activeSessionId } from './session'

const keyFor = (sessionId: string | null | undefined): string => sessionId ?? ''

interface KeyedPrompt {
  sessionId: string | null
}

interface PromptStore<T extends KeyedPrompt> {
  $active: ReadableAtom<null | T>
  clear: (sessionId?: string | null, requestId?: string) => void
  reset: () => void
  set: (request: T) => void
}

function keyedPromptStore<T extends KeyedPrompt>(): PromptStore<T> {
  const $all = atom<Record<string, T>>({})
  const idOf = (value: T): string | undefined => (value as { requestId?: string }).requestId

  return {
    $active: computed([$all, $activeSessionId], (all, activeId) => all[keyFor(activeId)] ?? null),
    reset: () => $all.set({}),
    set: request => $all.set({ ...$all.get(), [keyFor(request.sessionId)]: request }),
    clear(sessionId, requestId) {
      const all = $all.get()

      if (sessionId !== undefined) {
        const key = keyFor(sessionId)
        const current = all[key]

        if (current && !(requestId && idOf(current) !== requestId)) {
          const next = { ...all }
          delete next[key]
          $all.set(next)
        }

        return
      }

      const next = Object.fromEntries(Object.entries(all).filter(([, value]) => requestId && idOf(value) !== requestId))

      if (Object.keys(next).length !== Object.keys(all).length) {
        $all.set(next as Record<string, T>)
      }
    }
  }
}

export interface ApprovalRequest extends KeyedPrompt {
  command: string
  description: string
}

export interface SudoRequest extends KeyedPrompt {
  requestId: string
}

export interface SecretRequest extends KeyedPrompt {
  envVar: string
  prompt: string
  requestId: string
}

const approval = keyedPromptStore<ApprovalRequest>()
const sudo = keyedPromptStore<SudoRequest>()
const secret = keyedPromptStore<SecretRequest>()

export const $approvalRequest = approval.$active
export const setApprovalRequest = approval.set
export const clearApprovalRequest = approval.clear

export const $sudoRequest = sudo.$active
export const setSudoRequest = sudo.set
export const clearSudoRequest = sudo.clear

export const $secretRequest = secret.$active
export const setSecretRequest = secret.set
export const clearSecretRequest = secret.clear

export function clearAllPrompts(sessionId?: string | null): void {
  if (sessionId === undefined) {
    approval.reset()
    sudo.reset()
    secret.reset()

    return
  }

  approval.clear(sessionId)
  sudo.clear(sessionId)
  secret.clear(sessionId)
}

import { atom } from 'nanostores'

export interface SessionBrowseState {
  cursor: number
  draftSnapshot: string
}

const $perSessionBrowse = atom<Record<string, SessionBrowseState>>({})

function ensure(sessionId: string): SessionBrowseState {
  const all = { ...$perSessionBrowse.get() }
  let state = all[sessionId]

  if (!state) {
    state = { cursor: -1, draftSnapshot: '' }
    all[sessionId] = state
    $perSessionBrowse.set(all)
  }

  return state
}

function persist() {
  $perSessionBrowse.set({ ...$perSessionBrowse.get() })
}

function valid(sessionId: string | null | undefined): sessionId is string {
  return typeof sessionId === 'string' && sessionId.length > 0
}

export function deriveUserHistory<T extends { role: string }>(
  messages: readonly T[],
  getText: (message: T) => string
): string[] {
  const out: string[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!

    if (message.role !== 'user') {
      continue
    }

    const text = getText(message).trim()

    if (text) {
      out.push(text)
    }
  }

  return out
}

export function browseBackward(
  sessionId: string | null | undefined,
  currentDraft: string,
  history: readonly string[]
): string | null {
  if (!valid(sessionId) || history.length === 0) {
    return null
  }

  const state = ensure(sessionId)

  if (state.cursor === -1) {
    state.draftSnapshot = currentDraft
    state.cursor = 0
  } else if (state.cursor < history.length - 1) {
    state.cursor += 1
  } else {
    return null
  }

  persist()

  return history[state.cursor]!
}

export function browseForward(
  sessionId: string | null | undefined,
  history: readonly string[]
): { text: string; returnedToPresent: boolean } | null {
  if (!valid(sessionId)) {
    return null
  }

  const state = ensure(sessionId)

  if (state.cursor === -1) {
    return null
  }

  if (state.cursor > 0) {
    state.cursor -= 1
    persist()

    return { text: history[state.cursor]!, returnedToPresent: false }
  }

  const text = state.draftSnapshot
  state.cursor = -1
  state.draftSnapshot = ''
  persist()

  return { text, returnedToPresent: true }
}

export function resetBrowseState(sessionId: string | null | undefined) {
  if (!valid(sessionId)) {
    return
  }

  const all = { ...$perSessionBrowse.get() }

  if (!all[sessionId]) {
    return
  }

  all[sessionId] = { cursor: -1, draftSnapshot: '' }
  $perSessionBrowse.set(all)
}

export function isBrowsingHistory(sessionId: string | null | undefined): boolean {
  if (!valid(sessionId)) {
    return false
  }

  return ($perSessionBrowse.get()[sessionId]?.cursor ?? -1) >= 0
}

export { $perSessionBrowse }

import { atom, computed } from 'nanostores'

import {
  defaultBindings,
  KEYBIND_ACTION_IDS,
  keybindAction,
  type KeybindBindings
} from '@/lib/keybinds/actions'
import { arraysEqual, persistString, storedString } from '@/lib/storage'

const STORAGE_KEY = 'hermes.desktop.keybinds'

function loadBindings(): KeybindBindings {
  const base = defaultBindings()
  const raw = storedString(STORAGE_KEY)

  if (!raw) {
    return base
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>

    for (const id of KEYBIND_ACTION_IDS) {
      const value = parsed[id]

      if (Array.isArray(value)) {
        base[id] = value.filter((combo): combo is string => typeof combo === 'string')
      }
    }
  } catch {
    // Corrupt storage falls back to defaults.
  }

  return base
}

function persistBindings(bindings: KeybindBindings): void {
  const defaults = defaultBindings()
  const diff: KeybindBindings = {}

  for (const id of KEYBIND_ACTION_IDS) {
    const current = bindings[id] ?? []

    if (!arraysEqual(current, defaults[id] ?? [])) {
      diff[id] = current
    }
  }

  persistString(STORAGE_KEY, JSON.stringify(diff))
}

export const $bindings = atom<KeybindBindings>(loadBindings())

$bindings.subscribe(persistBindings)

export const $comboIndex = computed($bindings, bindings => {
  const index = new Map<string, string>()

  for (const id of KEYBIND_ACTION_IDS) {
    for (const combo of bindings[id] ?? []) {
      if (!index.has(combo)) {
        index.set(combo, id)
      }
    }
  }

  return index
})

export function setBinding(actionId: string, combos: string[]): void {
  if (!keybindAction(actionId)) {
    return
  }

  $bindings.set({ ...$bindings.get(), [actionId]: [...combos] })
}

export function resetBinding(actionId: string): void {
  const action = keybindAction(actionId)

  if (!action) {
    return
  }

  $bindings.set({ ...$bindings.get(), [actionId]: [...action.defaults] })
}

export function resetAllBindings(): void {
  $bindings.set(defaultBindings())
}

export function conflictsFor(actionId: string, combo: string): string[] {
  const bindings = $bindings.get()

  return KEYBIND_ACTION_IDS.filter(id => id !== actionId && (bindings[id] ?? []).includes(combo))
}

export const $capture = atom<string | null>(null)

export function beginCapture(actionId: string): void {
  $capture.set(actionId)
}

export function endCapture(): void {
  $capture.set(null)
}

export const $keybindPanelOpen = atom(false)

export function openKeybindPanel(): void {
  $keybindPanelOpen.set(true)
}

export function closeKeybindPanel(): void {
  $keybindPanelOpen.set(false)
  $capture.set(null)
}

export function toggleKeybindPanel(): void {
  if ($keybindPanelOpen.get()) {
    closeKeybindPanel()
  } else {
    openKeybindPanel()
  }
}

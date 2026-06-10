export type KeybindCategory = 'composer' | 'navigation' | 'profiles' | 'session' | 'view'

export const KEYBIND_PANEL_ACTION = 'keybinds.openPanel'

export const KEYBIND_CATEGORIES: readonly KeybindCategory[] = [
  'composer',
  'profiles',
  'session',
  'navigation',
  'view'
]

export interface KeybindActionMeta {
  category: KeybindCategory
  defaults: readonly string[]
  id: string
}

export const PROFILE_SLOT_COUNT = 18

function comboForSlot(slot: number): string {
  return slot <= 9 ? `mod+${slot}` : `mod+alt+${slot - 9}`
}

const PROFILE_SWITCH_ACTIONS: KeybindActionMeta[] = Array.from({ length: PROFILE_SLOT_COUNT }, (_, index) => ({
  category: 'profiles' as const,
  defaults: [comboForSlot(index + 1)],
  id: `profile.switch.${index + 1}`
}))

export const KEYBIND_ACTIONS: readonly KeybindActionMeta[] = [
  { category: 'composer', defaults: [], id: 'composer.focus' },
  { category: 'composer', defaults: [], id: 'composer.modelPicker' },
  { category: 'profiles', defaults: ['mod+d'], id: 'profile.default' },
  ...PROFILE_SWITCH_ACTIONS,
  { category: 'profiles', defaults: ['mod+shift+]'], id: 'profile.next' },
  { category: 'profiles', defaults: ['mod+shift+['], id: 'profile.prev' },
  { category: 'profiles', defaults: ['mod+shift+0'], id: 'profile.toggleAll' },
  { category: 'profiles', defaults: [], id: 'profile.create' },
  { category: 'session', defaults: ['mod+n', 'shift+n'], id: 'session.new' },
  { category: 'session', defaults: [], id: 'session.next' },
  { category: 'session', defaults: [], id: 'session.prev' },
  { category: 'session', defaults: ['mod+shift+f'], id: 'session.focusSearch' },
  { category: 'session', defaults: [], id: 'session.togglePin' },
  { category: 'navigation', defaults: ['mod+k', 'mod+p'], id: 'nav.commandPalette' },
  { category: 'navigation', defaults: ['mod+.'], id: 'nav.commandCenter' },
  { category: 'navigation', defaults: ['mod+,'], id: 'nav.settings' },
  { category: 'navigation', defaults: [], id: 'nav.profiles' },
  { category: 'navigation', defaults: [], id: 'nav.skills' },
  { category: 'navigation', defaults: [], id: 'nav.messaging' },
  { category: 'navigation', defaults: [], id: 'nav.artifacts' },
  { category: 'navigation', defaults: [], id: 'nav.cron' },
  { category: 'navigation', defaults: [], id: 'nav.agents' },
  { category: 'view', defaults: ['mod+b'], id: 'view.toggleSidebar' },
  { category: 'view', defaults: ['mod+j'], id: 'view.toggleRightSidebar' },
  { category: 'view', defaults: [], id: 'view.showFiles' },
  { category: 'view', defaults: [], id: 'view.showTerminal' },
  { category: 'view', defaults: ['mod+\\'], id: 'view.flipPanes' },
  { category: 'view', defaults: ['shift+x'], id: 'appearance.toggleMode' },
  { category: 'view', defaults: ['mod+/'], id: KEYBIND_PANEL_ACTION }
]

export const KEYBIND_ACTION_IDS: readonly string[] = KEYBIND_ACTIONS.map(action => action.id)

const ACTION_BY_ID = new Map(KEYBIND_ACTIONS.map(action => [action.id, action]))

export function keybindAction(id: string): KeybindActionMeta | undefined {
  return ACTION_BY_ID.get(id)
}

export type KeybindBindings = Record<string, string[]>

export function defaultBindings(): KeybindBindings {
  return Object.fromEntries(KEYBIND_ACTIONS.map(action => [action.id, [...action.defaults]]))
}

export interface KeybindReadonly {
  category: KeybindCategory
  id: string
  keys: readonly string[]
}

export const KEYBIND_READONLY: readonly KeybindReadonly[] = [
  { category: 'composer', id: 'composer.send', keys: ['enter'] },
  { category: 'composer', id: 'composer.newline', keys: ['shift+enter'] },
  { category: 'composer', id: 'composer.steer', keys: ['mod+enter'] },
  { category: 'composer', id: 'composer.sendQueued', keys: ['mod+shift+k'] },
  { category: 'composer', id: 'composer.mention', keys: ['@'] },
  { category: 'composer', id: 'composer.slash', keys: ['/'] },
  { category: 'composer', id: 'composer.help', keys: ['?'] },
  { category: 'composer', id: 'composer.history', keys: ['up', 'down'] },
  { category: 'composer', id: 'composer.cancel', keys: ['escape'] },
  { category: 'view', id: 'view.terminalSelection', keys: ['mod+l'] },
  { category: 'view', id: 'view.closePreviewTab', keys: ['mod+w'] }
]

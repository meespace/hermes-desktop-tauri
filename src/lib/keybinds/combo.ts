export const IS_MAC =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

const CODE_TO_KEY: Record<string, string> = {
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  Backquote: '`',
  Backslash: '\\',
  Backspace: 'backspace',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Enter: 'enter',
  Equal: '=',
  Escape: 'escape',
  Minus: '-',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
  Space: 'space',
  Tab: 'tab'
}

const MODIFIER_CODES = new Set([
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'ShiftLeft',
  'ShiftRight'
])

function baseKeyFromCode(code: string): null | string {
  if (code.startsWith('Key')) {
    return code.slice(3).toLowerCase()
  }

  if (code.startsWith('Digit')) {
    return code.slice(5)
  }

  if (code.startsWith('Numpad')) {
    const rest = code.slice(6)

    return /^[0-9]$/.test(rest) ? rest : null
  }

  if (code.startsWith('F') && /^F\d{1,2}$/.test(code)) {
    return code.toLowerCase()
  }

  return CODE_TO_KEY[code] ?? null
}

export function comboFromEvent(event: KeyboardEvent): null | string {
  if (MODIFIER_CODES.has(event.code)) {
    return null
  }

  const base = baseKeyFromCode(event.code)

  if (!base) {
    return null
  }

  const parts: string[] = []

  if (event.metaKey || event.ctrlKey) {
    parts.push('mod')
  }

  if (event.altKey) {
    parts.push('alt')
  }

  if (event.shiftKey) {
    parts.push('shift')
  }

  parts.push(base)

  return parts.join('+')
}

const TOKEN_LABELS: Record<string, string> = {
  backspace: '⌫',
  down: '↓',
  enter: '↵',
  escape: 'Esc',
  left: '←',
  right: '→',
  space: 'Space',
  tab: '⇥',
  up: '↑'
}

function labelForBase(base: string): string {
  if (TOKEN_LABELS[base]) {
    return TOKEN_LABELS[base]
  }

  if (/^f\d{1,2}$/.test(base)) {
    return base.toUpperCase()
  }

  return base.length === 1 ? base.toUpperCase() : base
}

export function formatCombo(combo: string): string {
  const parts = combo.split('+')
  const base = parts.pop() ?? ''
  const mods = parts

  const modLabels = mods.map(mod => {
    if (mod === 'mod') {
      return IS_MAC ? '⌘' : 'Ctrl'
    }

    if (mod === 'alt') {
      return IS_MAC ? '⌥' : 'Alt'
    }

    if (mod === 'shift') {
      return IS_MAC ? '⇧' : 'Shift'
    }

    return mod
  })

  const tokens = [...modLabels, labelForBase(base)]

  return IS_MAC ? tokens.join('') : tokens.join('+')
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null

  return Boolean(
    element?.isContentEditable ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
  )
}

export function comboAllowedInInput(combo: string): boolean {
  return combo.startsWith('mod+') || combo === 'mod'
}

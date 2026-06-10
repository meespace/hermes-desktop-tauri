import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { Kbd } from '@/components/ui/kbd'
import { useI18n } from '@/i18n'
import {
  KEYBIND_ACTIONS,
  KEYBIND_CATEGORIES,
  KEYBIND_PANEL_ACTION,
  KEYBIND_READONLY,
  type KeybindActionMeta,
  type KeybindReadonly
} from '@/lib/keybinds/actions'
import { formatCombo } from '@/lib/keybinds/combo'
import { arraysEqual } from '@/lib/storage'
import { cn } from '@/lib/utils'
import {
  $bindings,
  $capture,
  $keybindPanelOpen,
  beginCapture,
  closeKeybindPanel,
  conflictsFor,
  endCapture,
  resetAllBindings,
  resetBinding
} from '@/store/keybinds'

export function KeybindPanel() {
  const { t } = useI18n()
  const open = useStore($keybindPanelOpen)
  const bindings = useStore($bindings)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const copy = t.keybinds
  const openCombo = bindings[KEYBIND_PANEL_ACTION]?.[0]

  const toggleCategory = (category: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)

      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }

      return next
    })

  return (
    <Dialog onOpenChange={next => !next && closeKeybindPanel()} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[8vh] grid max-h-[82vh] max-w-[min(40rem,calc(100vw-2rem))] translate-y-0 gap-0 overflow-hidden rounded-[1rem] border-[var(--workbench-panel-stroke)] bg-[var(--overlay)] p-0 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)]"
      >
        <DialogHeader className="border-b border-[var(--workbench-divider)] px-4 py-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold">{copy.title}</DialogTitle>
              <DialogDescription className="mt-1 text-[0.72rem] text-[var(--muted)]">
                {copy.subtitle(openCombo ? formatCombo(openCombo) : '⌘/Ctrl+/')}
              </DialogDescription>
            </div>
            <Button className="shrink-0" onClick={resetAllBindings} size="xs" variant="ghost">
              <Codicon name="discard" size="0.8125rem" />
              {copy.resetAll}
            </Button>
          </div>
        </DialogHeader>

        <div className="scrollbar-dt min-h-0 overflow-y-auto px-2 py-1.5">
          {KEYBIND_CATEGORIES.map(category => {
            const actions = KEYBIND_ACTIONS.filter(
              action => action.category === category && action.id !== KEYBIND_PANEL_ACTION
            )
            const readonly = KEYBIND_READONLY.filter(shortcut => shortcut.category === category)

            if (actions.length === 0 && readonly.length === 0) {
              return null
            }

            const sectionOpen = !collapsed.has(category)

            return (
              <section key={category}>
                <CategoryHeader
                  label={copy.categories[category] ?? category}
                  onToggle={() => toggleCategory(category)}
                  open={sectionOpen}
                />
                {sectionOpen ? actions.map(action => <KeybindRow action={action} key={action.id} />) : null}
                {sectionOpen ? readonly.map(shortcut => <ReadonlyRow key={shortcut.id} shortcut={shortcut} />) : null}
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CategoryHeader({ label, onToggle, open }: { label: string; onToggle: () => void; open: boolean }) {
  return (
    <button
      className="group/kbd-cat flex w-fit items-center gap-1 px-2.5 pb-1 pt-3 text-left leading-none"
      onClick={onToggle}
      type="button"
    >
      <span className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</span>
      <DisclosureCaret className="opacity-0 transition group-hover/kbd-cat:opacity-100" open={open} size="0.6875rem" />
    </button>
  )
}

function KeybindRow({ action }: { action: KeybindActionMeta }) {
  const { t } = useI18n()
  const copy = t.keybinds
  const bindings = useStore($bindings)
  const capture = useStore($capture)
  const combos = bindings[action.id] ?? []
  const capturing = capture === action.id
  const label = copy.actions[action.id] ?? action.id
  const isDefault = arraysEqual(combos, [...action.defaults])
  const conflict = combos
    .flatMap(combo => conflictsFor(action.id, combo).map(other => copy.actions[other] ?? other))
    .find(Boolean)

  return (
    <div className="group flex min-h-8 items-center gap-2.5 rounded-[0.7rem] px-2.5 py-1 transition-colors hover:bg-[var(--workbench-hover)]">
      <span className="min-w-0 flex-1 truncate text-[0.8rem] text-[color-mix(in_srgb,var(--foreground)_86%,transparent)]">
        {label}
      </span>

      {conflict ? (
        <span className="grid size-4 place-items-center text-[var(--warning)]" title={copy.conflictWith(conflict)}>
          <Codicon name="warning" size="0.8125rem" />
        </span>
      ) : null}

      <button
        aria-label={copy.rebind}
        className="flex shrink-0 items-center gap-1 rounded-[0.65rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        onClick={() => (capturing ? endCapture() : beginCapture(action.id))}
        title={copy.rebind}
        type="button"
      >
        {capturing ? (
          <KeyCap active>{copy.pressKey}</KeyCap>
        ) : combos.length > 0 ? (
          combos.map(combo => <KeyCap key={combo}>{formatCombo(combo)}</KeyCap>)
        ) : (
          <KeyCap muted>{copy.set}</KeyCap>
        )}
      </button>

      {isDefault ? (
        <span aria-hidden className="size-6 shrink-0" />
      ) : (
        <button
          aria-label={copy.reset}
          className="grid size-6 shrink-0 place-items-center rounded-md text-[var(--muted)] opacity-0 transition hover:bg-[var(--surface-secondary)] hover:text-foreground group-hover:opacity-100"
          onClick={() => resetBinding(action.id)}
          title={copy.reset}
          type="button"
        >
          <Codicon name="discard" size="0.8125rem" />
        </button>
      )}
    </div>
  )
}

function ReadonlyRow({ shortcut }: { shortcut: KeybindReadonly }) {
  const { t } = useI18n()
  const label = t.keybinds.actions[shortcut.id] ?? shortcut.id

  return (
    <div className="flex min-h-8 items-center gap-2.5 rounded-[0.7rem] px-2.5 py-1">
      <span className="min-w-0 flex-1 truncate text-[0.8rem] text-[color-mix(in_srgb,var(--foreground)_72%,transparent)]">
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {shortcut.keys.map(key => (
          <KeyCap key={key}>{formatCombo(key)}</KeyCap>
        ))}
      </div>
      <span aria-hidden className="size-6 shrink-0" />
    </div>
  )
}

function KeyCap({ active = false, children, muted = false }: { active?: boolean; children: string; muted?: boolean }) {
  return (
    <Kbd
      className={cn(
        'h-5 min-w-5 rounded-[0.45rem] px-1.5 text-[0.64rem]',
        active && 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]',
        muted && 'opacity-55'
      )}
    >
      {children}
    </Kbd>
  )
}

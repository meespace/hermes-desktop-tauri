import type { ReactNode } from 'react'

import { useI18n } from '@/i18n'

import { COMPLETION_DRAWER_CLASS } from './completion-drawer'

const COMMON_COMMANDS: [string, string][] = [
  ['/help', 'full list of commands + hotkeys'],
  ['/clear', 'start a new session'],
  ['/resume', 'resume a prior session'],
  ['/details', 'control transcript detail level'],
  ['/copy', 'copy selection or last assistant message'],
  ['/quit', 'exit hermes']
]

const HOTKEYS: [string, string][] = [
  ['@', 'reference files, folders, urls, git'],
  ['/', 'slash command palette'],
  ['?', 'this quick help (delete to dismiss)'],
  ['Enter', 'send · Shift+Enter for newline'],
  ['Cmd/Ctrl+K', 'send next queued turn'],
  ['Cmd/Ctrl+L', 'redraw'],
  ['Esc', 'close popover · cancel run'],
  ['↑ / ↓', 'cycle popover / history']
]

export function HelpHint() {
  const { t } = useI18n()

  return (
    <div className={COMPLETION_DRAWER_CLASS} data-slot="composer-completion-drawer" data-state="open" role="dialog">
      <Section title={t.composer.help.commonCommands}>
        {COMMON_COMMANDS.map(([key, desc]) => (
          <Row description={t.composer.help.commandDescriptions[key] ?? desc} key={key} keyLabel={key} mono />
        ))}
      </Section>

      <Section title={t.composer.help.hotkeys}>
        {HOTKEYS.map(([key, desc]) => (
          <Row description={t.composer.help.hotkeyDescriptions[key] ?? desc} key={key} keyLabel={key} />
        ))}
      </Section>

      <p className="px-2.5 py-1 text-xs text-[var(--muted)]">
        {t.composer.help.helpFooter}
      </p>
    </div>
  )
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="grid gap-0.5 pt-0.5">
      <p className="px-2.5 pb-0.5 pt-1 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--muted)]">
        {title}
      </p>
      {children}
    </div>
  )
}

function Row({ description, keyLabel, mono = false }: { description: string; keyLabel: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 rounded-md px-2.5 py-1 text-xs">
      <span
        className={
          mono ? 'shrink-0 truncate font-mono font-medium text-foreground/85' : 'shrink-0 truncate text-foreground/85'
        }
      >
        {keyLabel}
      </span>
      <span className="min-w-0 truncate text-[var(--muted)]">{description}</span>
    </div>
  )
}

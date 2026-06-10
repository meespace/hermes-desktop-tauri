import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { listSessions } from '@/hermes'
import { useI18n } from '@/i18n'
import { sessionTitle } from '@/lib/chat-runtime'
import {
  Archive,
  Clock,
  KeyRound,
  MessageCircle,
  Moon,
  Package,
  Settings,
  Sun,
  Users,
  Wrench,
  Zap
} from '@/lib/icons'
import { $commandPaletteOpen, closeCommandPalette, setCommandPaletteOpen } from '@/store/command-palette'
import { type ThemeMode, useTheme } from '@/themes/context'

import {
  ARTIFACTS_ROUTE,
  CRON_ROUTE,
  MESSAGING_ROUTE,
  NEW_CHAT_ROUTE,
  PROFILES_ROUTE,
  sessionRoute,
  SETTINGS_ROUTE,
  SKILLS_ROUTE
} from '../routes'

interface CommandAction {
  group: string
  id: string
  icon: typeof Settings
  keywords?: string
  label: string
  run: () => void
}

const SETTINGS_TABS = [
  ['Providers', 'providers'],
  ['Gateway', 'gateway'],
  ['API Keys', 'keys'],
  ['MCP', 'mcp'],
  ['Appearance', 'config:appearance'],
  ['Model', 'config:model'],
  ['Voice', 'config:voice'],
  ['Archived Chats', 'sessions'],
  ['About', 'about']
] as const

const settingTabLabelKey = (tab: (typeof SETTINGS_TABS)[number][1]) => {
  if (tab === 'config:appearance') return 'appearance'
  if (tab === 'config:model') return 'model'
  if (tab === 'config:voice') return 'voice'
  if (tab === 'sessions') return 'archivedChats'

  return tab
}

export function CommandPalette() {
  const { t } = useI18n()
  const copy = t.commandPalette
  const open = useStore($commandPaletteOpen)
  const navigate = useNavigate()
  const { mode, setMode } = useTheme()
  const [recentSessions, setRecentSessions] = useState<Array<{ id: string; label: string; preview?: string }>>([])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    void listSessions(30, 1)
      .then(result => {
        if (!cancelled) {
          setRecentSessions(
            result.sessions.map(session => ({
              id: session.id,
              label: sessionTitle(session),
              preview: session.preview ?? undefined
            }))
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecentSessions([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const runAndClose = (run: () => void) => {
    run()
    closeCommandPalette()
  }

  const actions = useMemo<CommandAction[]>(() => {
    const go = (path: string) => () => navigate(path)
    const setThemeMode = (next: ThemeMode) => () => setMode(next)

    return [
      { group: copy.groups.goTo, icon: MessageCircle, id: 'new-chat', label: copy.actions.newChat, run: go(NEW_CHAT_ROUTE) },
      { group: copy.groups.goTo, icon: Settings, id: 'settings', label: copy.actions.settings, run: go(SETTINGS_ROUTE) },
      { group: copy.groups.goTo, icon: Zap, id: 'providers', label: copy.actions.providers, run: go(`${SETTINGS_ROUTE}?tab=providers`) },
      { group: copy.groups.goTo, icon: KeyRound, id: 'api-keys', label: copy.actions.apiKeys, run: go(`${SETTINGS_ROUTE}?tab=keys`) },
      { group: copy.groups.goTo, icon: Wrench, id: 'skills', label: copy.actions.skills, run: go(SKILLS_ROUTE) },
      { group: copy.groups.goTo, icon: MessageCircle, id: 'messaging', label: copy.actions.messaging, run: go(MESSAGING_ROUTE) },
      { group: copy.groups.goTo, icon: Package, id: 'artifacts', label: copy.actions.artifacts, run: go(ARTIFACTS_ROUTE) },
      { group: copy.groups.goTo, icon: Clock, id: 'cron', label: copy.actions.cronJobs, run: go(CRON_ROUTE) },
      { group: copy.groups.goTo, icon: Users, id: 'profiles', label: copy.actions.profiles, run: go(PROFILES_ROUTE) },
      { group: copy.groups.appearance, icon: Sun, id: 'mode-light', label: copy.actions.lightMode, run: setThemeMode('light') },
      { group: copy.groups.appearance, icon: Moon, id: 'mode-dark', label: copy.actions.darkMode, run: setThemeMode('dark') },
      { group: copy.groups.appearance, icon: Settings, id: 'mode-system', label: copy.actions.systemMode, run: setThemeMode('system') },
      ...SETTINGS_TABS.map(([label, tab]) => ({
        group: copy.groups.settings,
        icon: Settings,
        id: `settings-${tab}`,
        keywords: `settings ${label}`,
        label: t.settings.sections[settingTabLabelKey(tab) as keyof typeof t.settings.sections] ?? t.settings.nav[settingTabLabelKey(tab) as keyof typeof t.settings.nav] ?? label,
        run: go(`${SETTINGS_ROUTE}?tab=${encodeURIComponent(tab)}`)
      }))
    ]
  }, [copy, navigate, setMode, t.settings.viewTitles])

  const groups = useMemo(() => {
    const grouped = new Map<string, CommandAction[]>()

    for (const action of actions) {
      grouped.set(action.group, [...(grouped.get(action.group) ?? []), action])
    }

    return [...grouped.entries()]
  }, [actions])

  return (
    <Dialog onOpenChange={setCommandPaletteOpen} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="top-[10vh] translate-y-0 gap-0 overflow-hidden rounded-[1rem] border-[var(--workbench-panel-stroke)] bg-[var(--overlay)] p-0 shadow-[0_20px_70px_-42px_rgba(15,23,42,0.58)] sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <Command className="border-0 shadow-none">
          <CommandInput autoFocus placeholder={copy.searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{copy.empty}</CommandEmpty>
            {groups.map(([heading, items]) => (
              <CommandGroup heading={heading} key={heading}>
                {items.map(action => {
                  const Icon = action.icon

                  return (
                    <CommandItem
                      key={action.id}
                      keywords={action.keywords?.split(' ')}
                      onSelect={() => runAndClose(action.run)}
                      value={`${action.label} ${action.keywords ?? ''}`}
                    >
                      <Icon className="size-4 text-[var(--muted)]" />
                      <span>{action.label}</span>
                      {action.id === `mode-${mode}` ? <span className="ml-auto text-xs text-[var(--muted)]">{copy.active}</span> : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
            {recentSessions.length > 0 ? (
              <CommandGroup heading={copy.groups.recentSessions}>
                {recentSessions.map(session => (
                  <CommandItem
                    key={session.id}
                    onSelect={() => runAndClose(() => navigate(sessionRoute(session.id)))}
                    value={`${session.label} ${session.preview ?? ''}`}
                  >
                    <Archive className="size-4 text-[var(--muted)]" />
                    <span className="min-w-0 flex-1 truncate">{session.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

import {
  Bell,
  Bot,
  Files,
  FolderOpen,
  Layers3,
  MessageSquare,
  Mic,
  MoonStar,
  PanelLeft,
  PlugZap,
  Search,
  Settings2,
  Sparkles,
  TerminalSquare,
  WandSparkles
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Workspace', meta: 'root', active: true, icon: FolderOpen },
  { label: 'Sessions', meta: '4', active: false, icon: MessageSquare },
  { label: 'Artifacts', meta: '12', active: false, icon: Files },
  { label: 'Agents', meta: '2', active: false, icon: Bot },
  { label: 'Gateway', meta: 'local', active: false, icon: PlugZap }
] as const

const SESSION_ITEMS = [
  { title: 'Refine Tauri shell parity', meta: 'Pinned', active: true },
  { title: 'Voice transcription edge cases', meta: '12m ago', active: false },
  { title: 'Gateway local-first defaults', meta: '26m ago', active: false },
  { title: 'Settings IA rewrite', meta: '1h ago', active: false }
] as const

const STATUS_ITEMS = [
  {
    title: 'Connection',
    value: 'Local gateway',
    note: 'Reuse existing Hermes CLI',
    icon: PlugZap
  },
  {
    title: 'Updates',
    value: 'Manual only',
    note: 'No background polling',
    icon: Bell
  },
  {
    title: 'Appearance',
    value: 'Theme tokens',
    note: 'Single variables entry',
    icon: MoonStar
  }
] as const

const TOOL_ITEMS = [
  {
    title: 'Terminal surface',
    note: 'Compact output, tighter run state',
    icon: TerminalSquare
  },
  {
    title: 'Quick settings',
    note: 'Gateway, workspace, voice in one lane',
    icon: Settings2
  },
  {
    title: 'Project preview',
    note: 'Files and previews relate to one workspace',
    icon: Files
  }
] as const

const ACTIVITY_ITEMS = [
  'Local gateway reused from installed Hermes CLI',
  'Update prompts moved to manual settings flow',
  'Theme tokens stay behind one appearance entry'
] as const

function SectionLabel({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('px-1 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-slate-400', className)}>
      {children}
    </div>
  )
}

function DemoBadge({
  children,
  tone = 'neutral'
}: {
  children: React.ReactNode
  tone?: 'accent' | 'neutral'
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em]',
        tone === 'accent'
          ? 'border-[color-mix(in_srgb,var(--accent)_16%,white)] bg-[color-mix(in_srgb,var(--accent)_9%,white_91%)] text-[var(--accent)]'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      )}
    >
      {children}
    </span>
  )
}

function DemoPanel({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-[1rem] border border-slate-200/80 bg-white/96 shadow-[0_10px_22px_-22px_rgba(15,23,42,0.28)] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </section>
  )
}

export function HeroDemoView() {
  return (
    <div className="h-screen overflow-hidden bg-[#f4f6fb] text-slate-950">
      <div className="flex h-full gap-1.5 p-1.5">
        <DemoPanel className="flex w-[12.35rem] shrink-0 flex-col p-1.5">
          <div className="flex items-center gap-2 rounded-[0.8rem] border border-slate-200/80 bg-[#f8fafd] px-2 py-1.5">
            <div className="grid size-6 shrink-0 place-items-center rounded-[0.65rem] border border-slate-200/80 bg-white text-[var(--accent)]">
              <Sparkles className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Desktop shell</div>
              <div className="truncate text-[0.8rem] font-semibold tracking-[-0.02em] text-slate-950">Hermes Desktop Community</div>
            </div>
          </div>

          <div className="mt-1.5 rounded-[0.8rem] border border-slate-200/80 bg-white px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</div>
                <div className="mt-0.5 text-[0.78rem] font-semibold tracking-[-0.02em] text-slate-950">hermes-tauri</div>
              </div>
              <DemoBadge tone="accent">local</DemoBadge>
            </div>
          </div>

          <button
            className="mt-1.5 flex h-7 items-center gap-2 rounded-[0.75rem] border border-slate-200/80 bg-[#fbfcfe] px-2 text-left text-[0.68rem] text-slate-500 transition-colors hover:bg-slate-50"
            type="button"
          >
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate">Open command or search</span>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-slate-400">cmd k</span>
          </button>

          <div className="mt-2.5">
            <SectionLabel>Navigation</SectionLabel>
            <div className="mt-1 grid gap-0.5">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon

                return (
                  <button
                    className={cn(
                      'flex h-[1.9rem] items-center gap-2 rounded-[0.75rem] border px-2 text-left transition-[background-color,border-color,color]',
                      item.active
                        ? 'border-[color-mix(in_srgb,var(--accent)_16%,white)] bg-[color-mix(in_srgb,var(--accent)_7%,white_93%)] text-slate-950'
                        : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                    )}
                    key={item.label}
                    type="button"
                  >
                    <div
                      className={cn(
                        'grid size-[1.375rem] shrink-0 place-items-center rounded-[0.55rem] border',
                        item.active
                          ? 'border-[color-mix(in_srgb,var(--accent)_14%,white)] bg-white text-[var(--accent)]'
                          : 'border-slate-200/80 bg-white text-slate-400'
                      )}
                    >
                      <Icon className="size-3" />
                    </div>
                    <div className="min-w-0 flex-1 truncate text-[0.72rem] font-medium tracking-[-0.01em]">{item.label}</div>
                    <div className="shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-400">
                      {item.meta}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-2.5">
            <div className="flex items-center justify-between px-1">
              <SectionLabel className="px-0">Recent</SectionLabel>
              <div className="text-[0.6rem] font-medium text-slate-400">4 items</div>
            </div>
            <div className="mt-1 grid gap-1">
              {SESSION_ITEMS.map(item => (
                <button
                  className={cn(
                    'rounded-[0.75rem] border px-2 py-1.5 text-left transition-colors',
                    item.active
                      ? 'border-slate-200 bg-[linear-gradient(180deg,#f6f8fc_0%,#eef4ff_100%)]'
                      : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50'
                  )}
                  key={item.title}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-[0.68rem] font-medium tracking-[-0.01em] text-slate-900">
                      {item.title}
                    </div>
                    <div className="shrink-0 font-mono text-[0.56rem] uppercase tracking-[0.12em] text-slate-400">
                      {item.meta}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-2.5">
            <div className="rounded-[0.75rem] border border-slate-200/80 bg-[#fbfcfe] px-2 py-1.5">
              <div className="flex items-center justify-between text-[0.68rem] font-medium text-slate-700">
                Gateway
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-400">active</span>
              </div>
              <div className="mt-0.5 text-[0.62rem] leading-5 text-slate-500">
                Reusing local Hermes CLI. Updates stay manual.
              </div>
            </div>
          </div>
        </DemoPanel>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_14.5rem] gap-2">
          <DemoPanel className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex h-11 items-center justify-between border-b border-slate-200/80 px-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="grid size-7 place-items-center rounded-[0.75rem] border border-slate-200/80 bg-[#f8fafd] text-slate-500">
                  <PanelLeft className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    active workspace
                  </div>
                  <div className="truncate text-[0.86rem] font-semibold tracking-[-0.02em] text-slate-950">
                    hermes-tauri
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DemoBadge tone="accent">local gateway</DemoBadge>
                <Button className="rounded-full" size="sm" variant="secondary">
                  <Bell className="size-3.5" />
                  Notifications
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 p-2">
              <div className="grid grid-cols-3 gap-2">
                {STATUS_ITEMS.map(item => {
                  const Icon = item.icon

                  return (
                    <div
                      className="rounded-[0.9rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-2.5 py-2"
                      key={item.title}
                    >
                      <div className="flex items-start gap-2">
                        <div className="grid size-6 shrink-0 place-items-center rounded-[0.65rem] bg-[color-mix(in_srgb,var(--accent)_8%,white_92%)] text-[var(--accent)]">
                          <Icon className="size-3.25" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {item.title}
                          </div>
                          <div className="mt-1 truncate text-[0.76rem] font-semibold text-slate-950">{item.value}</div>
                          <div className="mt-0.5 text-[0.66rem] text-slate-500">{item.note}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_15rem] gap-2">
                <DemoPanel className="flex min-h-0 flex-col overflow-hidden bg-[#fbfcfe]">
                  <div className="flex items-center justify-between border-b border-slate-200/80 px-3 py-2">
                    <div>
                      <div className="text-[0.78rem] font-semibold tracking-[-0.02em] text-slate-900">Conversation</div>
                      <div className="mt-0.5 text-[0.66rem] text-slate-500">
                        Higher density, clearer grouping, still desktop-first.
                      </div>
                    </div>
                    <DemoBadge tone="accent">
                      <Bot className="size-3.5" />
                      product mode
                    </DemoBadge>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
                    <div className="ml-auto max-w-[20rem] rounded-[0.95rem] bg-slate-950 px-3 py-2 text-[0.74rem] leading-5 text-white">
                      We need the desktop shell to feel tighter and more like an IDE workbench.
                    </div>

                    <div className="max-w-[24rem] rounded-[0.95rem] border border-slate-200/80 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        <Sparkles className="size-3.5 text-[var(--accent)]" />
                        assistant
                      </div>
                      <div className="mt-2 text-[0.74rem] leading-5 text-slate-700">
                        Then the shell should stop behaving like a landing page. Keep the structure flatter, reduce row
                        height, and let navigation read like a workbench tree instead of a showcase rail.
                      </div>

                      <div className="mt-2.5 rounded-[0.85rem] border border-slate-200/80 bg-[#f8fbff] px-2.5 py-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[0.72rem] font-medium text-slate-900">Current task</div>
                          <DemoBadge tone="accent">running</DemoBadge>
                        </div>
                        <div className="mt-1 text-[0.66rem] text-slate-500">
                          Rebuild shared shell primitives before wiring real screens.
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                          <div className="h-1.5 w-[72%] rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#60a5fa_100%)]" />
                        </div>
                      </div>
                    </div>

                    <div className="ml-auto max-w-[18rem] rounded-[0.95rem] border border-[color-mix(in_srgb,var(--accent)_16%,white)] bg-[color-mix(in_srgb,var(--accent)_7%,white_93%)] px-3 py-2 text-[0.72rem] leading-5 text-slate-700">
                      Keep the visual language soft, but compress the structure until it feels like a serious tool.
                    </div>
                  </div>

                  <div className="border-t border-slate-200/80 p-2">
                    <div className="flex items-center gap-2 rounded-[0.9rem] border border-slate-200/80 bg-white px-2.5 py-2 shadow-[0_10px_18px_-20px_rgba(15,23,42,0.22)]">
                      <WandSparkles className="size-3.5 shrink-0 text-[var(--accent)]" />
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent text-[0.74rem] text-slate-900 outline-none placeholder:text-slate-400"
                        placeholder="Describe the task, paste a bug, or attach a workspace."
                      />
                      <Button className="rounded-full px-4" size="sm">
                        Send
                      </Button>
                    </div>
                  </div>
                </DemoPanel>

                <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
                  <DemoPanel className="p-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[0.76rem] font-semibold tracking-[-0.02em] text-slate-900">Appearance</div>
                        <div className="mt-0.5 text-[0.66rem] text-slate-500">One variables entry for future themes.</div>
                      </div>
                      <MoonStar className="size-3.5 text-slate-400" />
                    </div>
                    <div className="mt-2 rounded-[0.8rem] border border-slate-200/80 bg-[#fbfcfe] px-2.5 py-2">
                      <div className="flex items-center justify-between text-[0.72rem] font-medium text-slate-900">
                        Accent intensity
                        <span className="text-slate-500">Balanced</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                        <div className="h-1.5 w-[56%] rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#60a5fa_100%)]" />
                      </div>
                    </div>
                  </DemoPanel>

                  <DemoPanel className="p-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[0.76rem] font-semibold tracking-[-0.02em] text-slate-900">Voice and tools</div>
                        <div className="mt-0.5 text-[0.66rem] text-slate-500">Keep secondary controls in one compact lane.</div>
                      </div>
                      <Settings2 className="size-3.5 text-slate-400" />
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-[0.8rem] border border-slate-200/80 bg-[#fbfcfe] px-2.5 py-2">
                      <div>
                        <div className="text-[0.72rem] font-medium text-slate-900">Detailed tool output</div>
                        <div className="mt-0.5 text-[0.64rem] text-slate-500">Switch between product and technical tone.</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </DemoPanel>

                  <DemoPanel className="min-h-0 p-2.5">
                    <SectionLabel className="px-0">Workbench panels</SectionLabel>
                    <div className="mt-2 grid gap-1.5">
                      {TOOL_ITEMS.map(item => {
                        const Icon = item.icon

                        return (
                          <div
                            className="rounded-[0.8rem] border border-slate-200/80 bg-[#fbfcfe] px-2.5 py-2"
                            key={item.title}
                          >
                            <div className="flex items-start gap-2">
                              <div className="grid size-6 shrink-0 place-items-center rounded-[0.65rem] bg-white text-[var(--accent)]">
                                <Icon className="size-3.25" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[0.72rem] font-medium text-slate-900">{item.title}</div>
                                <div className="mt-0.5 text-[0.64rem] leading-5 text-slate-500">{item.note}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </DemoPanel>
                </div>
              </div>
            </div>
          </DemoPanel>

          <DemoPanel className="flex min-h-0 flex-col overflow-hidden p-2">
            <div className="flex items-center justify-between px-0.5">
              <div>
                <div className="text-[0.76rem] font-semibold tracking-[-0.02em] text-slate-900">Right rail</div>
                <div className="mt-0.5 text-[0.66rem] text-slate-500">Preview, voice and activity stay scoped here.</div>
              </div>
              <DemoBadge tone="accent">
                <Layers3 className="size-3.5" />
                unified
              </DemoBadge>
            </div>

            <div className="mt-2 grid gap-2">
              <DemoPanel className="p-2.5">
                <div className="flex items-center gap-2">
                  <div className="grid size-6 place-items-center rounded-[0.65rem] bg-[color-mix(in_srgb,var(--accent)_8%,white_92%)] text-[var(--accent)]">
                    <FolderOpen className="size-3.25" />
                  </div>
                  <div>
                    <div className="text-[0.72rem] font-semibold text-slate-900">Project context</div>
                    <div className="mt-0.5 text-[0.64rem] leading-5 text-slate-500">
                      File tree, preview and terminal sit under one workspace surface.
                    </div>
                  </div>
                </div>
              </DemoPanel>

              <DemoPanel className="p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid size-6 place-items-center rounded-[0.65rem] bg-[color-mix(in_srgb,var(--accent)_8%,white_92%)] text-[var(--accent)]">
                      <Mic className="size-3.25" />
                    </div>
                    <div>
                      <div className="text-[0.72rem] font-semibold text-slate-900">Voice controls</div>
                      <div className="mt-0.5 text-[0.64rem] text-slate-500">Recording and device state feel native.</div>
                    </div>
                  </div>
                  <Switch />
                </div>
              </DemoPanel>

              <DemoPanel className="min-h-0 p-2.5">
                <SectionLabel className="px-0">Recent activity</SectionLabel>
                <div className="mt-2 grid gap-1.5">
                  {ACTIVITY_ITEMS.map(item => (
                    <div
                      className="rounded-[0.8rem] border border-slate-200/80 bg-[#fbfcfe] px-2.5 py-2"
                      key={item}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        <div className="text-[0.66rem] leading-5 text-slate-600">{item}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </DemoPanel>
            </div>
          </DemoPanel>
        </div>
      </div>
    </div>
  )
}

export default HeroDemoView

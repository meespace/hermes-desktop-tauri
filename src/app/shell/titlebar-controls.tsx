import { useStore } from '@nanostores/react'
import { useEffect, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'

import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Volume2, VolumeX } from '@/lib/icons'
import { resolveProfileColor } from '@/lib/profile-color'
import { cn } from '@/lib/utils'
import { $hapticsMuted, toggleHapticsMuted } from '@/store/haptics'
import { $fileBrowserOpen, $sidebarOpen, toggleFileBrowserOpen, toggleSidebarOpen } from '@/store/layout'
import {
  $activeGatewayProfile,
  $profileColors,
  $profiles,
  ALL_PROFILES,
  profilesWithDefaultFallback,
  refreshActiveProfile,
  selectProfile,
  setShowAllProfiles
} from '@/store/profile'

import { PROFILES_ROUTE } from '../routes'

import { titlebarButtonClass } from './titlebar'

export interface TitlebarTool {
  id: string
  label: string
  active?: boolean
  className?: string
  disabled?: boolean
  hidden?: boolean
  href?: string
  icon: ReactNode
  onSelect?: () => void
  title?: string
  to?: string
}

export type TitlebarToolSide = 'left' | 'right'
export type SetTitlebarToolGroup = (id: string, tools: readonly TitlebarTool[], side?: TitlebarToolSide) => void

interface TitlebarControlsProps extends ComponentProps<'div'> {
  leftTools?: readonly TitlebarTool[]
  leftContext?: ReactNode
  leftPosition?: CSSProperties
  tools?: readonly TitlebarTool[]
  commandCenterOpen?: boolean
  hideGlobalTools?: boolean
  onOpenSettings: () => void
  onOpenSearch: () => void
}

export function TitlebarControls({
  leftTools = [],
  leftContext,
  leftPosition,
  tools = [],
  commandCenterOpen = false,
  hideGlobalTools = false,
  onOpenSettings,
  onOpenSearch
}: TitlebarControlsProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const sidebarOpen = useStore($sidebarOpen)

  const leftToolbarTools: TitlebarTool[] = [
    {
      icon: <Codicon name="layout-sidebar-left" />,
      id: 'sidebar',
      label: sidebarOpen ? t.shell.hideSidebar : t.shell.showSidebar,
      onSelect: () => {
        triggerHaptic('tap')
        toggleSidebarOpen()
      }
    },
    {
      active: commandCenterOpen,
      icon: <Codicon name="search" />,
      id: 'search',
      label: t.shell.search,
      onSelect: () => {
        triggerHaptic('open')
        onOpenSearch()
      },
      title: t.shell.searchTitle
    },
    ...leftTools
  ]

  const visiblePaneTools = tools.filter(tool => !tool.hidden)

  return (
    <>
      {!hideGlobalTools && (
        <div
          aria-label={t.shell.windowControls}
          className="pointer-events-none fixed top-(--titlebar-controls-top) z-70 flex h-[var(--titlebar-control-height)] max-w-[min(42rem,calc(100vw-22rem))] items-center gap-2.5 overflow-hidden select-none"
          style={{ left: 'var(--titlebar-controls-left)', ...leftPosition }}
        >
          <div className="flex shrink-0 flex-row items-center gap-x-1 pointer-events-auto [-webkit-app-region:no-drag]">
            {leftToolbarTools
              .filter(tool => !tool.hidden)
              .map(tool => (
                <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
              ))}
          </div>
          {leftContext ? <div className="min-w-0 flex-1 overflow-hidden">{leftContext}</div> : null}
        </div>
      )}

      {/*
        Pane-scoped tools (preview's monitor / devtools / refresh / X) render
        as their own fixed cluster. AppShell sets --shell-preview-toolbar-gap
        to either the static cluster's width (file-browser closed → cluster
        sits flush against system tools) or the file-browser pane's width
        (file-browser open → cluster sits flush against the file-browser pane,
        i.e. at the preview pane's right edge). No margin hacks needed.
      */}
      {!hideGlobalTools && visiblePaneTools.length > 0 && (
        <div
          aria-label={t.shell.paneControls}
          className="fixed top-(--titlebar-controls-top) right-[calc(var(--titlebar-tools-right)+var(--shell-preview-toolbar-gap,0))] z-70 flex flex-row items-center gap-x-1 pointer-events-auto select-none [-webkit-app-region:no-drag]"
        >
          {visiblePaneTools.map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
        </div>
      )}

      {!hideGlobalTools && (
        <AppSystemControls
          className="fixed right-(--titlebar-tools-right) top-(--titlebar-controls-top) z-70"
          onOpenSettings={onOpenSettings}
        />
      )}
    </>
  )
}

export function AppSystemControls({
  className,
  onOpenSettings
}: {
  className?: string
  onOpenSettings: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const hapticsMuted = useStore($hapticsMuted)
  const fileBrowserOpen = useStore($fileBrowserOpen)

  const toggleHaptics = () => {
    if (!hapticsMuted) {
      triggerHaptic('tap')
    }

    toggleHapticsMuted()

    if (hapticsMuted) {
      window.requestAnimationFrame(() => triggerHaptic('success'))
    }
  }

  const tools: TitlebarTool[] = [
    {
      active: hapticsMuted,
      icon: hapticsMuted ? <VolumeX /> : <Volume2 />,
      id: 'haptics',
      label: hapticsMuted ? t.shell.unmuteHaptics : t.shell.muteHaptics,
      onSelect: toggleHaptics
    },
    {
      icon: <Codicon name="settings-gear" />,
      id: 'settings',
      label: t.shell.openSettings,
      onSelect: () => {
        triggerHaptic('open')
        onOpenSettings()
      }
    },
    {
      active: fileBrowserOpen,
      icon: <Codicon name="layout-sidebar-right" />,
      id: 'right-sidebar',
      label: fileBrowserOpen ? t.shell.hideRightSidebar : t.shell.showRightSidebar,
      onSelect: () => {
        triggerHaptic('tap')
        toggleFileBrowserOpen()
      }
    }
  ]

  return (
    <div
      aria-label={t.shell.appControls}
      className={cn(
        'flex shrink-0 flex-row items-center justify-end gap-x-1 pointer-events-auto select-none [-webkit-app-region:no-drag]',
        className
      )}
    >
      <TitlebarToolButton navigate={navigate} tool={tools[0]} />
      <ProfilesMenuButton navigate={navigate} />
      <TitlebarToolButton navigate={navigate} tool={tools[1]} />
      <TitlebarToolButton navigate={navigate} tool={tools[2]} />
    </div>
  )
}

function ProfilesMenuButton({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const storedProfiles = useStore($profiles)
  const activeProfile = useStore($activeGatewayProfile)
  const colors = useStore($profileColors)
  const profiles = profilesWithDefaultFallback(storedProfiles)

  const activeLabel = activeProfile === ALL_PROFILES ? 'All' : activeProfile || 'default'

  useEffect(() => {
    void refreshActiveProfile()
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Profiles: ${activeLabel}`}
          className={cn(titlebarButtonClass, 'grid place-items-center select-none overflow-hidden text-[0.65rem] font-semibold')}
          onPointerDown={event => event.stopPropagation()}
          title={`Profiles: ${activeLabel}`}
          type="button"
        >
          {activeLabel.slice(0, 2).toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
        <DropdownMenuLabel>
          <div className="text-sm font-medium text-foreground">Profiles</div>
          <div className="mt-1 text-xs font-normal leading-4 text-[var(--muted)]">
            Advanced Hermes environments for separate personas, config, skills, and SOUL.md.
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            triggerHaptic('selection')
            setShowAllProfiles(true)
          }}
        >
          <Codicon name="layers" size="1rem" />
          <span>All profiles</span>
        </DropdownMenuItem>
        {profiles.map(profile => {
          const color = resolveProfileColor(profile.name, colors)
          const active = activeProfile === profile.name || (profile.is_default && activeProfile === 'default')

          return (
            <DropdownMenuItem
              key={profile.name}
              onSelect={() => {
                triggerHaptic('selection')
                selectProfile(profile.name)
              }}
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full border border-[var(--border)]"
                style={{ background: color ?? 'var(--muted)' }}
              />
              <span className="min-w-0 flex-1 truncate">{profile.name}</span>
              {active ? <Codicon name="check" size="0.9rem" /> : null}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            triggerHaptic('open')
            void refreshActiveProfile()
            navigate(PROFILES_ROUTE)
          }}
        >
          <Codicon name="account" size="1rem" />
          <span>Manage profiles</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TitlebarToolButton({ navigate, tool }: { navigate: NavigateFunction; tool: TitlebarTool }) {
  const className = cn(
    titlebarButtonClass,
    'grid place-items-center select-none [&_svg]:size-4',
    tool.active && 'border-[color-mix(in_srgb,var(--accent)_12%,transparent)] bg-[var(--workbench-active)]! text-[var(--accent)]!',
    tool.className
  )

  if (tool.href) {
    return (
      <a
        aria-label={tool.label}
        className={className}
        href={tool.href}
        onPointerDown={event => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
        title={tool.title ?? tool.label}
      >
        {tool.icon}
      </a>
    )
  }

  return (
    <button
      aria-label={tool.label}
      aria-pressed={tool.active ?? undefined}
      className={className}
      disabled={tool.disabled}
      onClick={() => {
        if (tool.to) {
          navigate(tool.to)
        }

        tool.onSelect?.()
      }}
      onPointerDown={event => event.stopPropagation()}
      title={tool.title ?? tool.label}
      type="button"
    >
      {tool.icon}
    </button>
  )
}

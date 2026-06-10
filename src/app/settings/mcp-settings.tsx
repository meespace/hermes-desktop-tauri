import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import { OverlayActionButton, OverlayCard } from '@/app/overlays/overlay-chrome'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getHermesConfigRecord, type HermesGateway, saveHermesConfig } from '@/hermes'
import { Package, Wrench } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import { $activeSessionId } from '@/store/session'
import type { HermesConfigRecord } from '@/types/hermes'

import { includesQuery } from './helpers'
import { EmptyState, LoadingState, Pill, SectionHeading, SettingsContent } from './primitives'
import type { SearchProps } from './types'

interface McpSettingsProps extends SearchProps {
  gateway?: HermesGateway | null
  onConfigSaved?: () => void
}

type McpServers = Record<string, Record<string, unknown>>

const EMPTY_SERVER = {
  command: '',
  args: [],
  env: {}
}

function prettyServerBody(server: Record<string, unknown> | null) {
  return JSON.stringify(server ?? EMPTY_SERVER, null, 2)
}

function getServers(config: HermesConfigRecord | null): McpServers {
  const raw = config?.mcp_servers

  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as McpServers) : {}
}

const transportLabel = (server: Record<string, unknown>) =>
  typeof server.transport === 'string'
    ? server.transport
    : typeof server.url === 'string'
      ? 'http'
      : typeof server.command === 'string'
        ? 'stdio'
        : 'custom'

function serverMatches(name: string, server: Record<string, unknown>, query: string) {
  if (!query) {
    return true
  }

  return includesQuery(name, query) || includesQuery(JSON.stringify(server), query)
}

export function McpSettings({ gateway, onConfigSaved, query }: McpSettingsProps) {
  const activeSessionId = useStore($activeSessionId)
  const [config, setConfig] = useState<HermesConfigRecord | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)

  const selectServer = (serverName: string | null, nextServers: McpServers) => {
    const server = serverName ? nextServers[serverName] : null
    setSelected(serverName)
    setName(serverName ?? '')
    setBody(prettyServerBody(server ?? null))
  }

  useEffect(() => {
    let cancelled = false

    getHermesConfigRecord()
      .then(next => {
        if (cancelled) {
          return
        }

        setConfig(next)
        const nextServers = getServers(next)
        const first = Object.keys(nextServers).sort()[0] ?? null
        selectServer(first, nextServers)
      })
      .catch(err => notifyError(err, 'MCP config failed to load'))

    return () => void (cancelled = true)
  }, [])

  const servers = useMemo(() => getServers(config), [config])
  const names = useMemo(() => Object.keys(servers).sort(), [servers])

  const filtered = useMemo(
    () => names.filter(serverName => serverMatches(serverName, servers[serverName], query.trim().toLowerCase())),
    [names, query, servers]
  )

  if (!config) {
    return <LoadingState label="Loading MCP servers..." />
  }

  const saveServer = async () => {
    const nextName = name.trim()

    if (!nextName) {
      notify({ kind: 'error', title: 'Name required', message: 'Give this MCP server a config key.' })

      return
    }

    let parsed: Record<string, unknown>

    try {
      const raw = JSON.parse(body)

      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Server config must be a JSON object')
      }

      parsed = raw as Record<string, unknown>
    } catch (err) {
      notifyError(err, 'Invalid MCP JSON')

      return
    }

    setSaving(true)

    try {
      const nextServers = { ...servers }

      if (selected && selected !== nextName) {
        delete nextServers[selected]
      }

      nextServers[nextName] = parsed

      const nextConfig = { ...config, mcp_servers: nextServers }
      await saveHermesConfig(nextConfig)
      setConfig(nextConfig)
      selectServer(nextName, nextServers)
      onConfigSaved?.()
      notify({ kind: 'success', title: 'MCP server saved', message: `${nextName} applies after MCP reload.` })
    } catch (err) {
      notifyError(err, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const removeServer = async (serverName: string) => {
    setSaving(true)

    try {
      const nextServers = { ...servers }
      delete nextServers[serverName]

      const nextConfig = { ...config, mcp_servers: nextServers }
      await saveHermesConfig(nextConfig)
      setConfig(nextConfig)
      selectServer(Object.keys(nextServers).sort()[0] ?? null, nextServers)
      onConfigSaved?.()
    } catch (err) {
      notifyError(err, 'Remove failed')
    } finally {
      setSaving(false)
    }
  }

  const reloadMcp = async () => {
    if (!gateway) {
      notify({ kind: 'warning', title: 'Gateway unavailable', message: 'Reconnect the gateway before reloading MCP.' })

      return
    }

    setReloading(true)

    try {
      await gateway.request('reload.mcp', {
        confirm: true,
        session_id: activeSessionId ?? undefined
      })
      notify({ kind: 'success', title: 'MCP tools reloaded', message: 'New tool schemas apply to fresh turns.' })
    } catch (err) {
      notifyError(err, 'MCP reload failed')
    } finally {
      setReloading(false)
    }
  }

  return (
    <SettingsContent>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeading icon={Package} meta={`${names.length} configured`} title="MCP servers" />
        <div className="flex items-center gap-2">
          <OverlayActionButton onClick={() => selectServer(null, servers)}>New server</OverlayActionButton>
          <OverlayActionButton disabled={reloading} onClick={() => void reloadMcp()}>
            {reloading ? 'Reloading...' : 'Reload MCP'}
          </OverlayActionButton>
        </div>
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <OverlayCard className="min-h-64 overflow-hidden rounded-[0.76rem] border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] p-2 shadow-none">
          {filtered.length === 0 ? (
            <EmptyState description="Add a stdio or HTTP server to expose MCP tools." title="No MCP servers" />
          ) : (
            <div className="grid gap-1">
              {filtered.map(serverName => {
                const server = servers[serverName]
                const active = selected === serverName

                return (
                  <button
                    className={`rounded-[0.56rem] border px-2.5 py-2 text-left shadow-none transition-[background-color,border-color,color] ${
                      active
                        ? 'border-[color-mix(in_srgb,var(--accent)_16%,transparent)] bg-[var(--workbench-active)] text-[var(--foreground)]'
                        : 'border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--workbench-divider)] hover:bg-[var(--workbench-hover)] hover:text-[var(--foreground)]'
                    }`}
                    key={serverName}
                    onClick={() => selectServer(serverName, servers)}
                    type="button"
                  >
                    <div className="truncate text-sm font-medium">{serverName}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Pill>{transportLabel(server)}</Pill>
                      {server.disabled === true && <Pill>disabled</Pill>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </OverlayCard>

        <OverlayCard className="grid gap-3 rounded-[0.76rem] border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] p-4 shadow-none">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="size-4 text-[var(--muted)]" />
            {selected ? 'Edit server' : 'New server'}
          </div>
          <label className="grid gap-1.5">
            <span className="text-xs text-[var(--muted)]">Name</span>
            <Input onChange={event => setName(event.currentTarget.value)} placeholder="filesystem" value={name} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs text-[var(--muted)]">Server JSON</span>
            <Textarea
              className="min-h-80 font-mono text-xs"
              onChange={event => setBody(event.currentTarget.value)}
              spellCheck={false}
              value={body}
            />
          </label>
          <div className="flex items-center justify-between">
            {selected ? (
              <OverlayActionButton disabled={saving} onClick={() => void removeServer(selected)} tone="danger">
                Remove
              </OverlayActionButton>
            ) : (
              <span />
            )}
            <OverlayActionButton disabled={saving} onClick={() => void saveServer()}>
              {saving ? 'Saving...' : 'Save server'}
            </OverlayActionButton>
          </div>
        </OverlayCard>
      </div>
    </SettingsContent>
  )
}

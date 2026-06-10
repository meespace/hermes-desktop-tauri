import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GatewayConnection {
  base_url: string
  token: string
  ws_url: string
  mode: string
}

interface GatewayStatusProps {
  connection: GatewayConnection | null
}

interface StatusInfo {
  version: string
  gateway_running: boolean
  gateway_state: string
  active_sessions: number
}

export function GatewayStatus({ connection }: GatewayStatusProps) {
  const [info, setInfo] = useState<StatusInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    if (!connection) return
    setLoading(true)
    setError(null)
    try {
      const data = await invoke<StatusInfo>('hermes_api', {
        request: { path: '/api/status' }
      })
      setInfo(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [connection])

  if (!connection) {
    return (
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-[var(--surface-shadow)]" data-slot="gateway-status-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-[calc(var(--radius)*1.5)] bg-[var(--danger-soft)] text-[var(--danger)] shadow-[var(--field-shadow)]">
              <WifiOff className="h-5 w-5" />
            </span>
            Not Connected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted">No gateway connection.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Info */}
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-[var(--surface-shadow)]" data-slot="gateway-status-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-[calc(var(--radius)*1.5)] bg-[var(--success-soft)] text-[var(--success)] shadow-[var(--field-shadow)]">
              <Wifi className="h-5 w-5" />
            </span>
            Gateway Connected
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent-soft-foreground)] shadow-[var(--field-shadow)]">
              {connection.mode}
            </span>
            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div className="rounded-[calc(var(--radius)*1.75)] bg-[var(--surface-secondary)] px-3 py-2 shadow-[var(--field-shadow)]">
              <span className="text-muted">URL</span>
              <p className="mt-1 font-mono">{connection.base_url}</p>
            </div>
            <div className="rounded-[calc(var(--radius)*1.75)] bg-[var(--surface-secondary)] px-3 py-2 shadow-[var(--field-shadow)]">
              <span className="text-muted">WebSocket</span>
              <p className="mt-1 truncate font-mono">{connection.ws_url}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gateway Status */}
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-[var(--surface-shadow)]" data-slot="gateway-status-card">
        <CardHeader>
          <CardTitle>Gateway Status</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : info ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-[calc(var(--radius)*1.5)] bg-[var(--surface-secondary)] px-3 py-2 shadow-[var(--field-shadow)]">
                <span className="text-muted">Version</span>
                <span className="font-medium">{info.version}</span>
              </div>
              <div className="flex items-center justify-between rounded-[calc(var(--radius)*1.5)] bg-[var(--surface-secondary)] px-3 py-2 shadow-[var(--field-shadow)]">
                <span className="text-muted">State</span>
                <div className="flex items-center gap-2">
                  {info.gateway_running ? (
                    <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="capitalize">{info.gateway_state}</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-[calc(var(--radius)*1.5)] bg-[var(--surface-secondary)] px-3 py-2 shadow-[var(--field-shadow)]">
                <span className="text-muted">Active Sessions</span>
                <span className="font-medium">{info.active_sessions}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-[calc(var(--radius)*1.5)] bg-[var(--surface-secondary)] px-3 py-2 text-muted shadow-[var(--field-shadow)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading status...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-[var(--surface-shadow)]" data-slot="gateway-status-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Button className={cn('w-full justify-center')} variant="outline">
              New Chat
            </Button>
            <Button className={cn('w-full justify-center')} variant="outline">
              Sessions
            </Button>
            <Button className={cn('w-full justify-center')} variant="outline">
              Settings
            </Button>
            <Button className={cn('w-full justify-center')} variant="outline">
              Skills
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

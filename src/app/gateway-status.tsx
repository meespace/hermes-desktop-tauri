import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react'

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-destructive" />
            Not Connected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No gateway connection.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-500" />
            Gateway Connected
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-secondary">
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
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">URL</span>
              <p className="font-mono">{connection.base_url}</p>
            </div>
            <div>
              <span className="text-muted-foreground">WebSocket</span>
              <p className="font-mono truncate">{connection.ws_url}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gateway Status */}
      <Card>
        <CardHeader>
          <CardTitle>Gateway Status</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : info ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">{info.version}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">State</span>
                <div className="flex items-center gap-2">
                  {info.gateway_running ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="capitalize">{info.gateway_state}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Active Sessions</span>
                <span className="font-medium">{info.active_sessions}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading status...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full">
              New Chat
            </Button>
            <Button variant="outline" className="w-full">
              Sessions
            </Button>
            <Button variant="outline" className="w-full">
              Settings
            </Button>
            <Button variant="outline" className="w-full">
              Skills
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

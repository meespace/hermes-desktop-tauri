import { setYoloActive } from '@/store/session'

export type GatewayRequester = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>

export async function setSessionYolo(
  requestGateway: GatewayRequester,
  sessionId: string,
  enabled: boolean
): Promise<boolean> {
  const result = await requestGateway<{ value?: string }>('config.set', {
    key: 'yolo',
    session_id: sessionId,
    value: enabled ? '1' : '0'
  })

  const active = result?.value === '1'

  setYoloActive(active)

  return active
}

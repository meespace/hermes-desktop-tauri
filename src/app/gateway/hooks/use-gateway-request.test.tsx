// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $gateway } from '@/store/gateway'
import { $gatewayState } from '@/store/session'

import { useGatewayRequest } from './use-gateway-request'

interface HookHandle {
  gatewayRef: React.MutableRefObject<unknown>
  requestGateway: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}

let handle: HookHandle | null = null

function Harness() {
  handle = useGatewayRequest() as HookHandle
  return null
}

describe('useGatewayRequest', () => {
  beforeEach(() => {
    handle = null
    $gateway.set(null)
    $gatewayState.set('open')
  })

  afterEach(() => {
    cleanup()
    $gateway.set(null)
  })

  it('follows the active gateway store when chat routing switches profiles', async () => {
    const primary = {
      request: vi.fn(async () => 'primary')
    }
    const secondary = {
      request: vi.fn(async () => 'secondary')
    }

    render(<Harness />)

    expect(handle).not.toBeNull()

    handle!.gatewayRef.current = primary

    await act(async () => {
      $gateway.set(secondary as never)
    })

    await expect(handle!.requestGateway('session.info')).resolves.toBe('secondary')
    expect(primary.request).not.toHaveBeenCalled()
    expect(secondary.request).toHaveBeenCalledWith('session.info', {})
  })
})

import type { HermesConnection } from '@/global'

export interface ResolveGatewayWsUrlDeps {
  getGatewayWsUrl?: (profile?: null | string) => Promise<string>
}

export class GatewayReauthRequiredError extends Error {
  readonly needsOauthLogin = true

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'GatewayReauthRequiredError'
  }
}

export function isGatewayReauthRequired(error: unknown): error is GatewayReauthRequiredError {
  return (
    error instanceof GatewayReauthRequiredError ||
    (typeof error === 'object' && error !== null && (error as { needsOauthLogin?: unknown }).needsOauthLogin === true)
  )
}

export async function resolveGatewayWsUrl(
  desktop: ResolveGatewayWsUrlDeps,
  conn: Pick<HermesConnection, 'authMode' | 'profile' | 'wsUrl'>
): Promise<string> {
  const mint = desktop.getGatewayWsUrl
  const profile = conn.profile ?? null

  if (conn.authMode === 'oauth') {
    if (!mint) {
      throw new GatewayReauthRequiredError(
        'Your remote gateway session needs to be refreshed. Open Settings -> Gateway and sign in again.'
      )
    }

    try {
      return await mint(profile)
    } catch (error) {
      throw new GatewayReauthRequiredError(
        'Your remote gateway session has expired. Open Settings -> Gateway and sign in again.',
        { cause: error }
      )
    }
  }

  if (mint) {
    const fresh = await mint(profile).catch(() => null)

    if (fresh) {
      return fresh
    }
  }

  return conn.wsUrl
}

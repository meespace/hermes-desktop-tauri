import type { DesktopAuthProvider, DesktopConnectionConfig } from '@/global'

export interface RemoteReauth {
  url: string
  isPassword: boolean
  providerLabel: string
}

interface SignInCopy {
  identityProvider: string
  remoteGateway: string
  withProvider: (provider: string) => string
}

const DEFAULT_SIGN_IN_COPY: SignInCopy = {
  identityProvider: 'your identity provider',
  remoteGateway: 'Sign in to remote gateway',
  withProvider: provider => `Sign in with ${provider}`
}

export function isRemoteReauthFailure(config: DesktopConnectionConfig | null | undefined): boolean {
  if (!config) {
    return false
  }

  return (
    config.mode === 'remote' &&
    config.remoteAuthMode === 'oauth' &&
    !config.remoteOauthConnected &&
    Boolean(config.remoteUrl)
  )
}

export function deriveProviderShape(providers: DesktopAuthProvider[] | null | undefined): {
  isPassword: boolean
  providerLabel: string
} {
  const list = providers ?? []

  if (list.length === 0) {
    return { isPassword: false, providerLabel: DEFAULT_SIGN_IN_COPY.identityProvider }
  }

  const isPassword = list.every(provider => Boolean(provider.supportsPassword))
  const providerLabel =
    list.length === 1
      ? list[0].displayName || list[0].name
      : list.map(provider => provider.displayName || provider.name).join(' / ')

  return { isPassword, providerLabel }
}

export function signInLabel(reauth: RemoteReauth | null, copy: SignInCopy = DEFAULT_SIGN_IN_COPY): string {
  if (reauth?.isPassword) {
    return copy.remoteGateway
  }

  const provider =
    reauth?.providerLabel === DEFAULT_SIGN_IN_COPY.identityProvider ? copy.identityProvider : reauth?.providerLabel

  return copy.withProvider(provider ?? copy.identityProvider)
}

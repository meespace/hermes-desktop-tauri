const LOCAL_PROVIDER_IDS = new Set([
  'custom',
  'local',
  'ollama',
  'ollama-local',
  'llamacpp',
  'llama.cpp',
  'llama-cpp',
  'vllm',
  'lmstudio',
  'lm-studio'
])

function isLoopbackBaseUrl(baseUrl: null | string | undefined): boolean {
  if (!baseUrl) {
    return false
  }

  try {
    const host = new URL(baseUrl).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')
  } catch {
    return false
  }
}

export function providerFromCredentialWarning(message: null | string | undefined): null | string {
  const match = String(message || '').match(/provider\s+['"]([^'"]+)['"]/i)
  return match?.[1] ?? null
}

export function shouldShowCredentialWarning(
  warning: null | string | undefined,
  provider?: null | string,
  baseUrl?: null | string
): boolean {
  const text = String(warning || '').trim()
  if (!text) {
    return false
  }

  const normalizedProvider = String(provider || '').trim().toLowerCase()
  const localProvider =
    LOCAL_PROVIDER_IDS.has(normalizedProvider) ||
    normalizedProvider.endsWith('-local') ||
    isLoopbackBaseUrl(baseUrl)

  if (localProvider && /^no api key configured\b/i.test(text)) {
    return false
  }

  return true
}

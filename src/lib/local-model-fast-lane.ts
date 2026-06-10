import { chatMessageText, type ChatMessage } from '@/lib/chat-messages'

export type LocalChatApi = 'ollama' | 'openai-compatible'

export interface LocalChatTarget {
  api: LocalChatApi
  baseUrl: string
  model: string
  provider: string
}

export interface LocalChatMessage {
  content: string
  role: 'assistant' | 'system' | 'user'
}

export interface LocalChatRequest {
  api: LocalChatApi
  baseUrl: string
  messages: LocalChatMessage[]
  model: string
}

interface ResolveLocalChatTargetOptions {
  config?: Record<string, unknown> | null
  model: string
  provider: string
}

interface BuildLocalChatRequestOptions {
  history: readonly ChatMessage[]
  maxHistoryMessages?: number
  target: LocalChatTarget
  text: string
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isLocalModelBaseUrl(baseUrl?: string): boolean {
  const raw = baseUrl?.trim()
  if (!raw) {
    return false
  }

  try {
    const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`)
    const hostname = parsed.hostname.toLowerCase()

    return (
      hostname === 'localhost' ||
      hostname === 'host.docker.internal' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('127.')
    )
  } catch {
    return false
  }
}

function normalizeOpenAiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')

  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`
}

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/i, '')
}

function providerConfig(config: Record<string, unknown>, provider: string): Record<string, unknown> | null {
  const providers = objectValue(config.providers)

  return providers ? objectValue(providers[provider]) : null
}

function namedCustomProviderConfig(config: Record<string, unknown>, provider: string): Record<string, unknown> | null {
  const entries = Array.isArray(config.custom_providers) ? config.custom_providers : []
  const normalizedProvider = provider.trim().toLowerCase()

  for (const entry of entries) {
    const row = objectValue(entry)
    const name = stringValue(row?.name).toLowerCase()

    if (row && name && name === normalizedProvider) {
      return row
    }
  }

  return null
}

function isOllamaTarget(provider: string, config: Record<string, unknown> | null): boolean {
  const slug = provider.trim().toLowerCase()
  const runtime = stringValue(config?.runtime).toLowerCase()

  return slug === 'ollama' || slug === 'ollama-local' || runtime === 'ollama'
}

export function resolveLocalChatTarget({
  config,
  model,
  provider
}: ResolveLocalChatTargetOptions): LocalChatTarget | null {
  const root = objectValue(config)
  const providerSlug = provider.trim()
  const modelId = model.trim()

  if (!root || !providerSlug || !modelId) {
    return null
  }

  const providerRow = providerConfig(root, providerSlug)
  const customRow = namedCustomProviderConfig(root, providerSlug)
  const modelRow = objectValue(root.model)
  const providerBaseUrl = stringValue(providerRow?.base_url)
  const customBaseUrl = stringValue(customRow?.base_url)
  const modelBaseUrl =
    stringValue(modelRow?.provider) === providerSlug || providerSlug === 'custom' ? stringValue(modelRow?.base_url) : ''
  const baseUrl = providerBaseUrl || modelBaseUrl || customBaseUrl

  if (!isLocalModelBaseUrl(baseUrl)) {
    return null
  }

  const api: LocalChatApi = isOllamaTarget(providerSlug, providerRow || customRow || modelRow) ? 'ollama' : 'openai-compatible'

  return {
    api,
    baseUrl: api === 'ollama' ? normalizeOllamaBaseUrl(baseUrl) : normalizeOpenAiBaseUrl(baseUrl),
    model: modelId,
    provider: providerSlug
  }
}

export function buildLocalChatRequest({
  history,
  maxHistoryMessages = 12,
  target,
  text
}: BuildLocalChatRequestOptions): LocalChatRequest {
  const submittedText = text.trim()
  const messages: LocalChatMessage[] = []

  for (const message of history) {
    if (message.hidden || (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system')) {
      continue
    }

    const content = chatMessageText(message).trim()

    if (!content) {
      continue
    }

    messages.push({ role: message.role, content })
  }

  const lastMessage = messages.at(-1)
  if (submittedText && !(lastMessage?.role === 'user' && lastMessage.content === submittedText)) {
    messages.push({ role: 'user', content: submittedText })
  }

  return {
    api: target.api,
    baseUrl: target.baseUrl,
    messages: messages.slice(-Math.max(1, maxHistoryMessages)),
    model: target.model
  }
}

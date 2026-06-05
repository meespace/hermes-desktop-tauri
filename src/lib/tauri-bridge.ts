import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { DesktopUpdateApplyOptions } from '@/global'

// ============================================================================
// Tauri IPC Bridge — replaces Electron's preload.cjs
// Maps window.hermesDesktop.* calls to Tauri invoke()
// ============================================================================

interface ApiRequest {
  path: string
  method?: string
  body?: unknown
  timeoutMs?: number
}

interface HermesTitleBarTheme {
  background: string
  foreground: string
}

interface HermesContextMenuEditFlags {
  canCut: boolean
  canCopy: boolean
  canPaste: boolean
  canSelectAll: boolean
}

interface HermesContextMenuRequest {
  dictionarySuggestions: string[]
  editFlags: HermesContextMenuEditFlags
  imageUrl: string | null
  isEditable: boolean
  linkUrl: string | null
  misspelledWord: string | null
  selectionText: string
}

function isTextInputElement(target: Element | null): target is HTMLInputElement | HTMLTextAreaElement {
  const hasInput = typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement
  const hasTextarea = typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement
  return hasInput || hasTextarea
}

function isEditableElement(target: Element | null) {
  return isTextInputElement(target) || Boolean(target?.closest?.('[contenteditable="true"], [contenteditable="plaintext-only"]'))
}

// Check if running in Tauri context
const isTauri = () => {
  try {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  } catch {
    return false
  }
}

const BROWSER_CONNECTION_CONFIG_KEY = 'hermes.desktop.connectionConfig.v1'
const BROWSER_DEFAULT_PROJECT_DIR_KEY = 'hermes.desktop.defaultProjectDir.v1'
const BROWSER_UPDATE_BRANCH_KEY = 'hermes.desktop.updateBranch.v1'
const BROWSER_IMAGE_STORE_KEY = 'hermes.desktop.browserImages.v1'
const BROWSER_SPELLCHECK_DICTIONARY_KEY = 'hermes.desktop.spellcheckDictionary.v1'
const DEFAULT_BROWSER_GATEWAY_HOST = '127.0.0.1'
const DEFAULT_BROWSER_GATEWAY_PORT = 9120
const BROWSER_GATEWAY_PROXY_PREFIX = '/__hermes_gateway_proxy__'

interface ConnectionConfig {
  mode: 'local' | 'remote'
  remote?: {
    token?: { encoding?: string; value: string } | null
    url?: string | null
  } | null
}

interface BrowserConnectionTarget {
  baseUrl: string
  host: string
  port: number
  pathPrefix: string
  mode: 'local' | 'remote'
  token?: string
}

interface DesktopConnectionConfig {
  envOverride: boolean
  mode: 'local' | 'remote'
  remoteTokenPreview: string | null
  remoteTokenSet: boolean
  remoteUrl: string
}

interface DesktopConnectionConfigInput {
  mode: 'local' | 'remote'
  remoteToken?: string
  remoteUrl?: string
}

let browserConnectionCache: BrowserConnectionTarget | null = null
let browserConnectionPromise: Promise<BrowserConnectionTarget> | null = null
let browserSpellcheckPromise: Promise<BrowserSpellcheck | null> | null = null
let tauriWebviewZoomLevel = 1
let nativeHotkeysInstalled = false
let nativeContextMenuInstalled = false

interface BrowserSpellcheck {
  add: (word: string) => void
  correct: (word: string) => boolean
  suggest: (word: string) => string[]
}

type HermesContextMenuController = {
  addWordToDictionary: (word: string) => Promise<boolean>
  replaceMisspelling: (suggestion: string) => void
}

type HermesWindow = typeof window & {
  __HERMES_DESKTOP_CONTEXT_MENU__?: HermesContextMenuController
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
}

export function normalizeTitleBarThemePayload(payload: unknown): HermesTitleBarTheme | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const background = 'background' in payload ? String((payload as Record<string, unknown>).background || '').trim() : ''
  const foreground = 'foreground' in payload ? String((payload as Record<string, unknown>).foreground || '').trim() : ''

  if (!isHexColor(background) || !isHexColor(foreground)) {
    return null
  }

  return { background, foreground }
}

function browserWindow(): HermesWindow | null {
  return typeof window === 'undefined' ? null : (window as HermesWindow)
}

function normalizeSpellcheckWord(word: string): string {
  return word.trim().replace(/^[^\p{L}\p{M}\p{N}'’-]+|[^\p{L}\p{M}\p{N}'’-]+$/gu, '')
}

function spellcheckWordChar(char: string): boolean {
  return /[\p{L}\p{M}\p{N}'’-]/u.test(char)
}

function readCustomSpellcheckWords(): string[] {
  return readBrowserJson<string[]>(BROWSER_SPELLCHECK_DICTIONARY_KEY, [])
    .map(word => normalizeSpellcheckWord(String(word || '')))
    .filter(Boolean)
}

function writeCustomSpellcheckWords(words: readonly string[]) {
  const deduped = [...new Set(words.map(word => normalizeSpellcheckWord(word)).filter(Boolean))]
  writeBrowserJson(BROWSER_SPELLCHECK_DICTIONARY_KEY, deduped)
}

function isSingleSpellcheckWord(value: string): boolean {
  const word = normalizeSpellcheckWord(value)
  return Boolean(word) && !/\s/u.test(word)
}

function wordAtOffset(text: string, offset: number): string | null {
  if (!text) {
    return null
  }

  let start = Math.max(0, Math.min(offset, text.length))
  let end = start

  if (start > 0 && (start === text.length || !spellcheckWordChar(text[start] || '')) && spellcheckWordChar(text[start - 1] || '')) {
    start -= 1
    end = start + 1
  }

  while (start > 0 && spellcheckWordChar(text[start - 1] || '')) {
    start -= 1
  }

  while (end < text.length && spellcheckWordChar(text[end] || '')) {
    end += 1
  }

  const word = normalizeSpellcheckWord(text.slice(start, end))
  return isSingleSpellcheckWord(word) ? word : null
}

function wordForTextInput(target: HTMLInputElement | HTMLTextAreaElement): string | null {
  const selectionStart = target.selectionStart ?? 0
  const selectionEnd = target.selectionEnd ?? selectionStart
  const selected = target.value.slice(selectionStart, selectionEnd)

  if (isSingleSpellcheckWord(selected)) {
    return normalizeSpellcheckWord(selected)
  }

  return wordAtOffset(target.value, selectionStart)
}

function wordForEditableSelection(target: Element | null): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const selection = window.getSelection?.()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const selected = selection.toString()
  if (isSingleSpellcheckWord(selected)) {
    return normalizeSpellcheckWord(selected)
  }

  const focusNode = selection.focusNode
  if (focusNode?.nodeType === Node.TEXT_NODE) {
    return wordAtOffset(focusNode.textContent || '', selection.focusOffset)
  }

  const editableRoot = target?.closest?.('[contenteditable="true"], [contenteditable="plaintext-only"]')
  if (editableRoot) {
    return wordAtOffset(editableRoot.textContent || '', selection.focusOffset)
  }

  return null
}

async function loadBrowserSpellcheck(): Promise<BrowserSpellcheck | null> {
  if (browserSpellcheckPromise) {
    return browserSpellcheckPromise
  }

  browserSpellcheckPromise = (async () => {
    try {
      const [{ default: createSpell }, dictionary] = await Promise.all([import('nspell'), import('./spellcheck-dictionary')])
      const { aff, dic } = dictionary
      const spell = createSpell(aff, dic)

      for (const word of readCustomSpellcheckWords()) {
        spell.add(word)
      }

      return {
        add: (word: string) => {
          spell.add(word)
        },
        correct: (word: string) => spell.correct(word),
        suggest: (word: string) => spell.suggest(word).slice(0, 5)
      }
    } catch {
      return null
    }
  })()

  return browserSpellcheckPromise
}

async function contextMenuSpellcheck(target: Element | null): Promise<Pick<HermesContextMenuRequest, 'dictionarySuggestions' | 'misspelledWord'>> {
  if (!isEditableElement(target)) {
    return { dictionarySuggestions: [], misspelledWord: null }
  }

  const word = isTextInputElement(target) ? wordForTextInput(target) : wordForEditableSelection(target)
  if (!word) {
    return { dictionarySuggestions: [], misspelledWord: null }
  }

  const spellcheck = await loadBrowserSpellcheck()
  if (!spellcheck || spellcheck.correct(word)) {
    return { dictionarySuggestions: [], misspelledWord: null }
  }

  const suggestions = spellcheck.suggest(word)
  if (suggestions.length === 0) {
    return { dictionarySuggestions: [], misspelledWord: null }
  }

  return {
    dictionarySuggestions: suggestions,
    misspelledWord: word
  }
}

export async function addWordToSpellcheckDictionary(word: string): Promise<boolean> {
  const normalized = normalizeSpellcheckWord(word)
  if (!normalized) {
    return false
  }

  const current = readCustomSpellcheckWords()
  if (!current.some(entry => entry.toLowerCase() === normalized.toLowerCase())) {
    writeCustomSpellcheckWords([...current, normalized])
  }

  const spellcheck = await loadBrowserSpellcheck()
  spellcheck?.add(normalized)
  return true
}

function replaceMisspellingInActiveElement(suggestion: string) {
  const active = typeof document !== 'undefined' ? (document.activeElement as Element | null) : null
  if (!active) {
    return
  }

  if (isTextInputElement(active)) {
    const selectionStart = active.selectionStart ?? 0
    const selectionEnd = active.selectionEnd ?? selectionStart
    let start = selectionStart
    let end = selectionEnd

    if (start === end) {
      const word = wordAtOffset(active.value, selectionStart)
      if (!word) {
        return
      }

      let cursor = selectionStart
      if (cursor > 0 && (cursor === active.value.length || !spellcheckWordChar(active.value[cursor] || ''))) {
        cursor -= 1
      }
      start = cursor
      while (start > 0 && spellcheckWordChar(active.value[start - 1] || '')) {
        start -= 1
      }
      end = start + word.length
    }

    active.setRangeText(suggestion, start, end, 'end')
    active.dispatchEvent(new Event('input', { bubbles: true }))
    active.dispatchEvent(new Event('change', { bubbles: true }))
    return
  }

  const selection = typeof window !== 'undefined' ? window.getSelection?.() : null
  if (!selection || selection.rangeCount === 0) {
    return
  }

  const range = selection.getRangeAt(0)
  if (!selection.isCollapsed) {
    range.deleteContents()
    range.insertNode(document.createTextNode(suggestion))
    selection.removeAllRanges()
    return
  }

  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    return
  }

  const textNode = range.startContainer
  const word = wordAtOffset(textNode.textContent || '', range.startOffset)
  if (!word) {
    return
  }

  let start = range.startOffset
  if (start > 0 && ((textNode.textContent || '').length === start || !spellcheckWordChar((textNode.textContent || '')[start] || ''))) {
    start -= 1
  }
  while (start > 0 && spellcheckWordChar((textNode.textContent || '')[start - 1] || '')) {
    start -= 1
  }
  const end = start + word.length
  const nextText = `${(textNode.textContent || '').slice(0, start)}${suggestion}${(textNode.textContent || '').slice(end)}`
  textNode.textContent = nextText

  const nextRange = document.createRange()
  nextRange.setStart(textNode, start + suggestion.length)
  nextRange.collapse(true)
  selection.removeAllRanges()
  selection.addRange(nextRange)

  active.dispatchEvent?.(new Event('input', { bubbles: true }))
}

function selectionTextForTarget(target: Element | null) {
  if (isTextInputElement(target)) {
    const selectionStart = target.selectionStart ?? 0
    const selectionEnd = target.selectionEnd ?? 0
    return target.value.slice(selectionStart, selectionEnd).trim()
  }

  return typeof window !== 'undefined' ? String(window.getSelection?.()?.toString() || '').trim() : ''
}

function editableSelectionState(target: Element | null) {
  if (isTextInputElement(target)) {
    const selectionStart = target.selectionStart ?? 0
    const selectionEnd = target.selectionEnd ?? 0
    const hasSelection = selectionEnd > selectionStart
    return {
      canCopy: hasSelection,
      canCut: hasSelection && !target.readOnly && !target.disabled,
      canPaste: !target.readOnly && !target.disabled,
      canSelectAll: target.value.length > 0
    }
  }

  const editableRoot = target?.closest?.('[contenteditable="true"], [contenteditable="plaintext-only"]')
  if (editableRoot) {
    const selectionText = selectionTextForTarget(target)
    return {
      canCopy: selectionText.length > 0,
      canCut: selectionText.length > 0,
      canPaste: true,
      canSelectAll: (editableRoot.textContent || '').length > 0
    }
  }

  return {
    canCopy: false,
    canCut: false,
    canPaste: false,
    canSelectAll: false
  }
}

export async function buildContextMenuRequest(target: Element | null): Promise<HermesContextMenuRequest> {
  const selectionText = selectionTextForTarget(target)
  const isEditable = isEditableElement(target)
  const editFlags = editableSelectionState(target)
  const pageText =
    typeof document !== 'undefined' ? String(document.body?.innerText || document.body?.textContent || '').trim() : ''
  const spellcheck = await contextMenuSpellcheck(target)

  return {
    dictionarySuggestions: spellcheck.dictionarySuggestions,
    imageUrl: target?.closest?.('img')?.getAttribute('src') || null,
    isEditable,
    linkUrl: target?.closest?.('a[href]')?.getAttribute('href') || null,
    misspelledWord: spellcheck.misspelledWord,
    selectionText,
    editFlags: {
      ...editFlags,
      canSelectAll: editFlags.canSelectAll || pageText.length > 0
    }
  }
}

function installContextMenuController() {
  const host = browserWindow()
  if (!host) {
    return
  }

  host.__HERMES_DESKTOP_CONTEXT_MENU__ = {
    addWordToDictionary: addWordToSpellcheckDictionary,
    replaceMisspelling: replaceMisspellingInActiveElement
  }
}

function isMicrophonePermissionDenied(error: unknown) {
  const name =
    typeof error === 'object' && error && 'name' in error ? String((error as { name?: unknown }).name || '') : ''

  return name === 'NotAllowedError' || name === 'SecurityError'
}

function readBrowserJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeBrowserJson(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage is best-effort in browser preview.
  }
}

function readBrowserText(key: string, fallback = ''): string {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    return window.localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function writeBrowserText(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Best effort only.
  }
}

function normalizeBrowserHost(value: unknown, fallback = DEFAULT_BROWSER_GATEWAY_HOST) {
  const next = String(value ?? '').trim()
  return next || fallback
}

function normalizeBrowserPort(value: unknown, fallback = DEFAULT_BROWSER_GATEWAY_PORT) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
}

function normalizeBrowserBaseUrl(url: string) {
  const next = String(url || '').trim()
  if (!next) {
    return ''
  }

  return /^https?:\/\//i.test(next) ? next.replace(/\/+$/, '') : `http://${next.replace(/\/+$/, '')}`
}

function readBrowserConnectionConfig(): ConnectionConfig {
  return readBrowserJson<ConnectionConfig>(BROWSER_CONNECTION_CONFIG_KEY, { mode: 'local', remote: null })
}

function writeBrowserConnectionConfig(config: ConnectionConfig): ConnectionConfig {
  const next: ConnectionConfig = {
    mode: config.mode === 'remote' ? 'remote' : 'local',
    remote:
      config.mode === 'remote' && config.remote
        ? {
            token: config.remote.token?.value ? { encoding: config.remote.token.encoding, value: config.remote.token.value } : null,
            url: normalizeBrowserBaseUrl(config.remote.url || '')
          }
        : null
  }

  writeBrowserJson(BROWSER_CONNECTION_CONFIG_KEY, next)
  return next
}

function parseBrowserGatewayTarget(baseUrl: string, mode: 'local' | 'remote', token?: string): BrowserConnectionTarget {
  const normalized = normalizeBrowserBaseUrl(baseUrl)

  if (!normalized) {
    throw new Error('Gateway base URL is required')
  }

  const url = new URL(normalized)
  return {
    baseUrl: `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`,
    host: url.hostname,
    mode,
    pathPrefix: url.pathname.replace(/\/+$/, ''),
    port: normalizeBrowserPort(url.port || (url.protocol === 'https:' ? 443 : 80)),
    token
  }
}

function toDesktopConnectionConfig(config: ConnectionConfig): DesktopConnectionConfig {
  const remoteToken = config.remote?.token?.value?.trim() || ''
  return {
    envOverride: false,
    mode: config.mode === 'remote' ? 'remote' : 'local',
    remoteTokenPreview: remoteToken ? `${remoteToken.slice(0, 4)}…${remoteToken.slice(-4)}` : null,
    remoteTokenSet: Boolean(remoteToken),
    remoteUrl: config.mode === 'remote' ? (config.remote?.url || '') : ''
  }
}

function isDesktopConnectionConfig(value: unknown): value is DesktopConnectionConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  return 'envOverride' in value && 'mode' in value && 'remoteUrl' in value && 'remoteTokenSet' in value
}

function toInternalConnectionConfig(input: DesktopConnectionConfigInput | ConnectionConfig | null | undefined): ConnectionConfig {
  if (!input) {
    return { mode: 'local', remote: null }
  }

  if ('remote' in input) {
    return input as ConnectionConfig
  }

  const desktopInput = input as DesktopConnectionConfigInput
  const remoteUrl = String(desktopInput.remoteUrl || '').trim()
  const remoteToken = String(desktopInput.remoteToken || '').trim()

  return desktopInput.mode === 'remote'
    ? {
        mode: 'remote',
        remote: {
          token: remoteToken ? { value: remoteToken } : null,
          url: remoteUrl || null
        }
      }
    : { mode: 'local', remote: null }
}

function readBrowserDefaultProjectDir() {
  return {
    defaultLabel: '~/hermes-projects',
    dir: readBrowserText(BROWSER_DEFAULT_PROJECT_DIR_KEY, '') || null
  }
}

function writeBrowserDefaultProjectDir(dir: string | null) {
  const next = dir?.trim() || ''
  writeBrowserText(BROWSER_DEFAULT_PROJECT_DIR_KEY, next)
  return { dir: next || null }
}

function readBrowserUpdateBranch() {
  return { branch: readBrowserText(BROWSER_UPDATE_BRANCH_KEY, 'main') || 'main' }
}

function writeBrowserUpdateBranch(branch: string) {
  const next = branch.trim() || 'main'
  writeBrowserText(BROWSER_UPDATE_BRANCH_KEY, next)
  return { branch: next }
}

function browserImageStore() {
  return readBrowserJson<Record<string, string>>(BROWSER_IMAGE_STORE_KEY, {})
}

function writeBrowserImageStore(store: Record<string, string>) {
  writeBrowserJson(BROWSER_IMAGE_STORE_KEY, store)
}

function browserExtToMime(ext: string) {
  switch ((ext.startsWith('.') ? ext : `.${ext}`).toLowerCase()) {
    case '.bmp':
      return 'image/bmp'
    case '.gif':
      return 'image/gif'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.tif':
    case '.tiff':
      return 'image/tiff'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function browserBytesToDataUrl(data: ArrayBuffer | Uint8Array, ext: string) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return `data:${browserExtToMime(ext)};base64,${btoa(binary)}`
}

function browserImagePath(ext: string) {
  const safeExt = ext.trim().match(/^\.[a-z0-9]{1,5}$/i) ? ext.trim().toLowerCase() : '.png'
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `browser:/composer-images/${id}${safeExt}`
}

function readBrowserImageDataUrl(path: string): string | null {
  return browserImageStore()[path] || null
}

function getBrowserLocalGatewayTarget(): BrowserConnectionTarget {
  return parseBrowserGatewayTarget(`http://${DEFAULT_BROWSER_GATEWAY_HOST}:${DEFAULT_BROWSER_GATEWAY_PORT}`, 'local')
}

function getBrowserProxyBaseUrl(target = getBrowserLocalGatewayTarget()) {
  return `${BROWSER_GATEWAY_PROXY_PREFIX}${target.pathPrefix}`
}

function getBrowserProxyUrl(path: string, target = getBrowserLocalGatewayTarget()) {
  const nextPath = String(path || '')
  return `${getBrowserProxyBaseUrl(target)}${nextPath.startsWith('/') ? nextPath : `/${nextPath}`}`
}

export function getBrowserGatewayWsUrl(target = getBrowserLocalGatewayTarget()) {
  const token = encodeURIComponent(target.token || '')
  if (typeof window !== 'undefined' && target.mode === 'local') {
    const wsScheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsScheme}//${window.location.host}${getBrowserProxyBaseUrl(target)}/api/ws?token=${token}`
  }

  return `${target.baseUrl.replace(/^http/i, 'ws')}/api/ws?token=${token}`
}

async function readBrowserConnectionToken(target = getBrowserLocalGatewayTarget()): Promise<BrowserConnectionTarget> {
  if (browserConnectionCache && browserConnectionCache.host === target.host && browserConnectionCache.port === target.port) {
    return browserConnectionCache
  }

  if (browserConnectionPromise) {
    return browserConnectionPromise
  }

  browserConnectionPromise = (async () => {
    const html = await fetch(getBrowserProxyUrl('/', target), { cache: 'no-store' }).then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to detect gateway: HTTP ${response.status}`)
      }

      return response.text()
    })

    const tokenMatch = html.match(/__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/)
    const token = tokenMatch?.[1]

    if (!token) {
      throw new Error('Could not find the local gateway session token')
    }

    browserConnectionCache = { ...target, token }
    return browserConnectionCache
  })()

  try {
    return await browserConnectionPromise
  } finally {
    browserConnectionPromise = null
  }
}

async function ensureBrowserConnectionTarget(forceRefresh = false): Promise<BrowserConnectionTarget> {
  if (forceRefresh) {
    browserConnectionCache = null
  }

  return readBrowserConnectionToken(getBrowserLocalGatewayTarget())
}

async function browserFetchJson<T>(
  path: string,
  init: RequestInit = {},
  target = getBrowserLocalGatewayTarget()
): Promise<T> {
  const connectionToken = target.token || (await ensureBrowserConnectionTarget()).token
  const response = await fetch(getBrowserProxyUrl(path, target), {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'X-Hermes-Session-Token': connectionToken,
      ...(init.headers || {})
    }
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`)
  }

  if (!text) {
    return null as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}

async function browserResolveConnection(): Promise<{ baseUrl: string; mode: 'local' | 'remote'; token: string; wsUrl: string }> {
  const target = await ensureBrowserConnectionTarget()
  return {
    baseUrl: target.baseUrl,
    mode: 'local',
    token: target.token || '',
    wsUrl: getBrowserGatewayWsUrl(target)
  }
}

// Safe invoke wrapper
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    return browserInvoke<T>(cmd, args)
  }
  return invoke<T>(cmd, args)
}

async function browserInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case 'read_file_data_url':
      return (readBrowserImageDataUrl(String(args?.path || '')) || '') as T
    case 'read_file_text':
      return {
        binary: false,
        byteSize: 0,
        language: 'text',
        mimeType: 'text/plain',
        path: String(args?.path || ''),
        text: '',
        truncated: false
      } as T
    case 'read_dir':
      return { entries: [], error: 'Browser preview cannot inspect local files.' } as T
    case 'git_root':
      return null as T
    case 'hermes_api':
      return browserFetchJson<T>(String(args?.request ? (args.request as ApiRequest).path : ''), {
        method: ((args?.request as ApiRequest | undefined)?.method || 'GET').toUpperCase(),
        body:
          (args?.request as ApiRequest | undefined)?.body === undefined
            ? undefined
            : JSON.stringify((args?.request as ApiRequest).body),
        headers:
          (args?.request as ApiRequest | undefined)?.body === undefined
            ? undefined
            : { 'Content-Type': 'application/json' }
      })
    case 'start_hermes': {
      return browserResolveConnection() as Promise<T>
    }
    case 'check_updates':
      return {
        branch: 'main',
        fetchedAt: Date.now(),
        message: 'Updates are unavailable in browser preview.',
        reason: 'browser-preview',
        supported: false
      } as T
    case 'apply_updates':
      return {
        error: 'browser-preview',
        message: 'Updates are unavailable in browser preview.',
        ok: false
      } as T
    case 'get_connection_config':
      return readBrowserConnectionConfig() as T
    case 'save_connection_config':
      return writeBrowserConnectionConfig(args?.config as ConnectionConfig) as T
    case 'apply_connection_config':
      return writeBrowserConnectionConfig(args?.config as ConnectionConfig) as T
    case 'test_connection_config': {
      const config = (args?.config as ConnectionConfig | undefined) ?? readBrowserConnectionConfig()
      const target =
        config.mode === 'remote' && config.remote?.url && config.remote.token?.value
          ? parseBrowserGatewayTarget(config.remote.url, 'remote', config.remote.token.value)
          : getBrowserLocalGatewayTarget()
      const result = await browserFetchJson<{ version?: string }>('/api/status', {}, target).catch(() => null)
      return {
        baseUrl: target.baseUrl,
        ok: Boolean(result),
        version: result?.version ?? null
      } as T
    }
    case 'get_boot_progress':
      return {
        error: null,
        fakeMode: false,
        message: 'Hermes local gateway is ready',
        phase: 'renderer.ready',
        progress: 100,
        running: false,
        timestamp: Date.now()
      } as T
    case 'get_version': {
      const status = await browserFetchJson<{ release_date?: string; version?: string }>('/api/status', {}).catch(() => null)
      return {
        appVersion: status?.version ?? 'browser',
        electronVersion: 'browser',
        hermesRoot: '',
        nodeVersion: 'browser',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'browser'
      } as T
    }
    case 'notify':
      return true as T
    case 'open_external':
      if (typeof window !== 'undefined') {
        window.open(String(args?.url || ''), '_blank', 'noopener,noreferrer')
      }
      return undefined as T
    case 'write_clipboard':
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(args?.text || ''))
      }
      return undefined as T
    case 'reveal_logs':
      return { ok: true, path: '' } as T
    case 'get_recent_logs':
      return { path: '', lines: [] } as T
    case 'get_bootstrap_state':
      return {
        active: false,
        completedAt: null,
        error: null,
        log: [],
        manifest: null,
        startedAt: null,
        stages: {},
        unsupportedPlatform: null
      } as T
    case 'reset_bootstrap':
    case 'repair_bootstrap':
      return { ok: true } as T
    case 'cancel_bootstrap':
      return { ok: false, cancelled: false } as T
    case 'terminal_start':
      return { cwd: '', id: 'browser-terminal', shell: 'browser' } as T
    case 'terminal_write':
    case 'terminal_resize':
    case 'terminal_dispose':
      return true as T
    case 'request_microphone_access':
      return true as T
    case 'set_titlebar_theme':
    case 'set_preview_shortcut_active':
      return undefined as T
    case 'get_connection':
      return browserResolveConnection() as Promise<T>
    case 'get_default_project_dir':
      return readBrowserDefaultProjectDir() as T
    case 'set_default_project_dir':
      return writeBrowserDefaultProjectDir((args?.dir as string | null | undefined) || null) as T
    case 'pick_default_project_dir': {
      const current = readBrowserDefaultProjectDir()
      const answer = window.prompt('Choose default project directory', current.dir || '')
      return {
        canceled: !answer,
        dir: answer?.trim() || null
      } as T
    }
    case 'save_image_from_url':
      return true as T
    case 'save_image_buffer': {
      const data = args?.data
      const ext = String(args?.ext || '.png')
      if (!data) {
        throw new Error('saveImageBuffer: missing data')
      }

      const bytes = Array.isArray(data)
        ? Uint8Array.from(data as number[])
        : data instanceof Uint8Array
          ? data
          : new Uint8Array(data as ArrayBuffer)

      const path = browserImagePath(ext)
      const store = browserImageStore()
      store[path] = browserBytesToDataUrl(bytes, ext)
      writeBrowserImageStore(store)
      return path as T
    }
    case 'save_clipboard_image':
      return '' as T
    case 'select_paths':
      return [] as T
    case 'watch_preview_file':
      return { id: 'browser-preview', path: String(args?.url || '') } as T
    case 'stop_preview_file_watch':
      return true as T
    default:
      throw new Error(`Browser preview does not support ${cmd}`)
  }
}

// ============================================================================
// API Proxy
// ============================================================================

async function api<T>(request: ApiRequest): Promise<T> {
  return safeInvoke<T>('hermes_api', { request })
}

// ============================================================================
// Connection
// ============================================================================

async function getConnection() {
  return safeInvoke('start_hermes')
}

async function getConnectionConfig() {
  const config = await safeInvoke<ConnectionConfig | DesktopConnectionConfig>('get_connection_config')
  return isDesktopConnectionConfig(config) ? config : toDesktopConnectionConfig(config)
}

async function saveConnectionConfig(config: unknown) {
  const next = toInternalConnectionConfig(config as DesktopConnectionConfigInput)
  const saved = await safeInvoke<ConnectionConfig | DesktopConnectionConfig>('save_connection_config', { config: next })
  return isDesktopConnectionConfig(saved) ? saved : toDesktopConnectionConfig(saved)
}

async function applyConnectionConfig(config: unknown) {
  const next = toInternalConnectionConfig(config as DesktopConnectionConfigInput)
  const saved = await safeInvoke<ConnectionConfig | DesktopConnectionConfig>('apply_connection_config', { config: next })
  return isDesktopConnectionConfig(saved) ? saved : toDesktopConnectionConfig(saved)
}

async function testConnectionConfig(config: unknown) {
  const next = toInternalConnectionConfig(config as DesktopConnectionConfigInput)
  return safeInvoke('test_connection_config', { config: next })
}

// ============================================================================
// Boot
// ============================================================================

async function getBootProgress() {
  return safeInvoke('get_boot_progress')
}

function onBootProgress(callback: (progress: unknown) => void): () => void {
  const interval = setInterval(async () => {
    try {
      const progress = await getBootProgress()
      callback(progress)
    } catch {}
  }, 1000)
  return () => clearInterval(interval)
}

// ============================================================================
// Bootstrap
// ============================================================================

async function getBootstrapState() {
  return safeInvoke('get_bootstrap_state')
}

async function resetBootstrap() {
  return safeInvoke('reset_bootstrap')
}

async function repairBootstrap() {
  return safeInvoke('repair_bootstrap')
}

async function cancelBootstrap() {
  return safeInvoke('cancel_bootstrap')
}

// ============================================================================
// File
// ============================================================================

async function readFileDataUrl(filePath: string) {
  return safeInvoke('read_file_data_url', { path: filePath })
}

async function readFileText(filePath: string) {
  return safeInvoke('read_file_text', { path: filePath })
}

async function readDir(dirPath: string) {
  return safeInvoke('read_dir', { path: dirPath })
}

async function gitRoot(startPath: string) {
  return safeInvoke('git_root', { startPath })
}

function getPathForFile(file: File) {
  return (file as File & { path?: string }).path ?? file.name
}

// ============================================================================
// Clipboard
// ============================================================================

async function writeClipboard(text: string) {
  return safeInvoke('write_clipboard', { text })
}

// ============================================================================
// Notifications
// ============================================================================

async function notify(payload: { title?: string; body?: string; silent?: boolean }) {
  const title = payload.title || 'Hermes'
  const body = payload.body || ''
  const silent = Boolean(payload.silent)
  const notificationCtor = typeof window !== 'undefined' ? window.Notification : undefined

  if (notificationCtor) {
    try {
      if (notificationCtor.permission === 'granted') {
        new notificationCtor(title, { body, silent })
        return true
      }

      if (notificationCtor.permission === 'default' && typeof notificationCtor.requestPermission === 'function') {
        const permission = await notificationCtor.requestPermission()
        if (permission === 'granted') {
          new notificationCtor(title, { body, silent })
          return true
        }

        if (!isTauri()) {
          return false
        }
      } else if (notificationCtor.permission === 'denied' && !isTauri()) {
        return false
      }
    } catch {
      if (!isTauri()) {
        return false
      }
    }
  }

  return safeInvoke('notify', { title, body, silent })
}

// ============================================================================
// External
// ============================================================================

async function openExternal(url: string) {
  return safeInvoke('open_external', { url })
}

// ============================================================================
// Updates
// ============================================================================

async function checkUpdates() {
  return safeInvoke('check_updates')
}

async function applyUpdates(opts?: DesktopUpdateApplyOptions) {
  return safeInvoke('apply_updates', { opts })
}

async function getUpdateBranch() {
  if (isTauri()) {
    return safeInvoke('get_update_branch')
  }

  return readBrowserUpdateBranch()
}

async function setUpdateBranch(name: string) {
  if (isTauri()) {
    return safeInvoke('set_update_branch', { name })
  }

  return writeBrowserUpdateBranch(name)
}

function onUpdateProgress(_callback: (payload: unknown) => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen('hermes:updates:progress', event => _callback(event.payload)).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

// ============================================================================
// Version
// ============================================================================

async function getVersion() {
  return safeInvoke('get_version')
}

// ============================================================================
// Logs
// ============================================================================

async function revealLogs() {
  return safeInvoke('reveal_logs')
}

async function getRecentLogs() {
  return safeInvoke('get_recent_logs')
}

// ============================================================================
// Terminal
// ============================================================================

async function terminalStart(payload?: unknown) {
  return safeInvoke('terminal_start', { payload })
}

async function terminalWrite(id: string, data: string) {
  return safeInvoke('terminal_write', { id, data })
}

async function terminalResize(id: string, size: unknown) {
  return safeInvoke('terminal_resize', { id, size })
}

async function terminalDispose(id: string) {
  return safeInvoke('terminal_dispose', { id })
}

function onTerminalData(id: string, callback: (payload: string) => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen(`hermes:terminal:${id}:data`, event => callback(String(event.payload ?? ''))).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

function onTerminalExit(
  id: string,
  callback: (payload: { code: number | null; signal: string | null }) => void
): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen(`hermes:terminal:${id}:exit`, event => {
    const payload = event.payload as { code?: number | null; signal?: string | null } | null | undefined
    callback({
      code: typeof payload?.code === 'number' ? payload.code : null,
      signal: typeof payload?.signal === 'string' ? payload.signal : null
    })
  }).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

// ============================================================================
// Window
// ============================================================================

function onWindowStateChanged(_callback: (state: unknown) => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen('hermes:window-state-changed', event => _callback(event.payload)).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

function onOpenUpdatesRequested(_callback: () => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen('hermes:open-updates', () => _callback()).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

function onClosePreviewRequested(_callback: () => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen('hermes:close-preview-requested', () => _callback()).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

function onPreviewFileChanged(_callback: (payload: unknown) => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen('hermes:preview-file-changed', event => _callback(event.payload)).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

function onBackendExit(_callback: (payload: unknown) => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen('hermes:backend-exit', event => _callback(event.payload)).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

function onBootstrapEvent(callback: (payload: unknown) => void): () => void {
  if (!isTauri()) {
    return () => {}
  }

  let unlisten: (() => void) | null = null
  void listen('hermes:bootstrap:event', event => callback(event.payload)).then(fn => {
    unlisten = fn
  })

  return () => {
    unlisten?.()
  }
}

// ============================================================================
// Settings
// ============================================================================

async function getDefaultProjectDir() {
  return safeInvoke('get_default_project_dir')
}

async function setDefaultProjectDir(dir: string | null) {
  return safeInvoke('set_default_project_dir', { dir })
}

async function pickDefaultProjectDir() {
  return safeInvoke('pick_default_project_dir')
}

// ============================================================================
// Image
// ============================================================================

async function saveImageFromUrl(url: string) {
  return safeInvoke('save_image_from_url', { url })
}

async function saveImageBuffer(data: ArrayBuffer | Uint8Array, ext: string) {
  const bytes =
    data instanceof Uint8Array
      ? Array.from(data)
      : data instanceof ArrayBuffer
        ? Array.from(new Uint8Array(data))
        : Array.from(new TextEncoder().encode(String(data)))
  return safeInvoke('save_image_buffer', { data: bytes, ext })
}

async function saveClipboardImage() {
  return safeInvoke('save_clipboard_image')
}

// ============================================================================
// Preview
// ============================================================================

async function normalizePreviewTarget(target: string, baseDir?: string) {
  return safeInvoke('normalize_preview_target', { target, baseDir: baseDir || '' })
}

async function watchPreviewFile(url: string) {
  return safeInvoke('watch_preview_file', { url })
}

async function stopPreviewFileWatch(id: string) {
  return safeInvoke('stop_preview_file_watch', { id })
}

// ============================================================================
// Titlebar
// ============================================================================

function setTitleBarTheme(payload: unknown) {
  const normalized = normalizeTitleBarThemePayload(payload)
  if (!normalized) {
    return
  }

  safeInvoke('set_titlebar_theme', { payload: normalized })
}

function setPreviewShortcutActive(active: boolean) {
  safeInvoke('set_preview_shortcut_active', { active })
}

function clampTauriZoom(next: number) {
  return Math.min(Math.max(next, 0.2), 10)
}

function setTauriWebviewZoom(next: number) {
  tauriWebviewZoomLevel = clampTauriZoom(next)
  void invoke('plugin:webview|set_webview_zoom', { value: tauriWebviewZoomLevel }).catch(() => undefined)
}

function toggleTauriDevtools() {
  void invoke('plugin:webview|internal_toggle_devtools').catch(() => undefined)
}

function installNativeHotkeys() {
  if (!isTauri() || typeof window === 'undefined' || nativeHotkeysInstalled) {
    return
  }

  nativeHotkeysInstalled = true

  window.addEventListener(
    'keydown',
    event => {
      const key = String(event.key || '').toLowerCase()
      const mod = event.metaKey || event.ctrlKey

      if (key === 'f12' || (event.metaKey && event.altKey && key === 'i') || (event.ctrlKey && event.shiftKey && key === 'i')) {
        event.preventDefault()
        event.stopPropagation()
        toggleTauriDevtools()
        return
      }

      if (!mod || event.altKey || event.shiftKey) {
        return
      }

      if (key === '0') {
        event.preventDefault()
        event.stopPropagation()
        setTauriWebviewZoom(1)
        return
      }

      if (key === '=' || key === '+') {
        event.preventDefault()
        event.stopPropagation()
        setTauriWebviewZoom(tauriWebviewZoomLevel + 0.1)
        return
      }

      if (key === '-') {
        event.preventDefault()
        event.stopPropagation()
        setTauriWebviewZoom(tauriWebviewZoomLevel - 0.1)
      }
    },
    { capture: true }
  )
}

function installNativeContextMenu() {
  if (!isTauri() || typeof window === 'undefined' || nativeContextMenuInstalled) {
    return
  }

  nativeContextMenuInstalled = true

  window.addEventListener('contextmenu', event => {
    if (event.defaultPrevented) {
      return
    }

    event.preventDefault()
    const target = event.target as Element | null
    void buildContextMenuRequest(target)
      .then(request =>
        invoke('show_context_menu', {
          request
        })
      )
      .catch(() => undefined)
  })
}

// ============================================================================
// Link
// ============================================================================

function normalizeFetchLinkTitleResult(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'title' in value) {
    return String((value as { title?: unknown }).title ?? '')
  }

  return ''
}

async function fetchLinkTitle(url: string) {
  const result = await safeInvoke<unknown>('fetch_link_title', { url })
  return normalizeFetchLinkTitleResult(result)
}

// ============================================================================
// Microphone & Paths
// ============================================================================

async function requestMicrophoneAccess() {
  const mediaDevices =
    (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined) ||
    (typeof window !== 'undefined' ? window.navigator?.mediaDevices : undefined)

  if (mediaDevices?.getUserMedia) {
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      if (isMicrophonePermissionDenied(error)) {
        return false
      }
    }
  }

  return safeInvoke('request_microphone_access')
}

async function selectPaths(_options?: unknown) {
  return safeInvoke('select_paths', { options: _options })
}

// ============================================================================
// Export — inject into window.hermesDesktop
// ============================================================================

const bridge = {
  api,
  getConnection,
  getConnectionConfig,
  saveConnectionConfig,
  applyConnectionConfig,
  testConnectionConfig,
  getBootProgress,
  onBootProgress,
  getBootstrapState,
  resetBootstrap,
  repairBootstrap,
  cancelBootstrap,
  readFileDataUrl,
  readFileText,
  readDir,
  gitRoot,
  getPathForFile,
  writeClipboard,
  notify,
  openExternal,
  checkUpdates,
  applyUpdates,
  updates: {
    check: checkUpdates,
    apply: applyUpdates,
    getBranch: getUpdateBranch,
    setBranch: setUpdateBranch,
    onProgress: onUpdateProgress
  },
  getVersion,
  revealLogs,
  getRecentLogs,
  terminalStart,
  terminalWrite,
  terminalResize,
  terminalDispose,
  terminal: {
    start: terminalStart,
    write: terminalWrite,
    resize: terminalResize,
    dispose: terminalDispose,
    onData: onTerminalData,
    onExit: onTerminalExit
  },
  onWindowStateChanged,
  onOpenUpdatesRequested,
  onClosePreviewRequested,
  getDefaultProjectDir,
  setDefaultProjectDir,
  pickDefaultProjectDir,
  saveImageFromUrl,
  saveImageBuffer,
  saveClipboardImage,
  normalizePreviewTarget,
  watchPreviewFile,
  stopPreviewFileWatch,
  setTitleBarTheme,
  fetchLinkTitle,
  requestMicrophoneAccess,
  selectPaths,
  setPreviewShortcutActive,
  onBootstrapEvent,
  onPreviewFileChanged,
  onBackendExit,
  settings: {
    getDefaultProjectDir,
    setDefaultProjectDir,
    pickDefaultProjectDir
  },
}

// Inject into window
if (typeof window !== 'undefined') {
  (window as any).hermesDesktop = bridge
  installContextMenuController()
  installNativeHotkeys()
  installNativeContextMenu()
}

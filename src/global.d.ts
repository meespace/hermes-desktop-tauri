export {}

declare global {
  interface Window {
    hermesDesktop: {
      getConnection: (profile?: null | string) => Promise<HermesConnection>
      revalidateConnection?: () => Promise<{ ok: boolean; rebuilt: boolean }>
      touchBackend?: (profile?: null | string) => Promise<{ ok: boolean }>
      getGatewayWsUrl?: (profile?: null | string) => Promise<string>
      getBootProgress: () => Promise<DesktopBootProgress>
      getConnectionConfig: (profile?: null | string) => Promise<DesktopConnectionConfig>
      saveConnectionConfig: (payload: DesktopConnectionConfigInput) => Promise<DesktopConnectionConfig>
      applyConnectionConfig: (payload: DesktopConnectionConfigInput) => Promise<DesktopConnectionConfig>
      testConnectionConfig: (payload: DesktopConnectionConfigInput) => Promise<DesktopConnectionTestResult>
      probeConnectionConfig: (remoteUrl: string) => Promise<DesktopConnectionProbeResult>
      oauthLoginConnectionConfig: (remoteUrl: string) => Promise<DesktopOauthLoginResult>
      oauthLogoutConnectionConfig: (remoteUrl?: string) => Promise<DesktopOauthLogoutResult>
      api: <T>(request: HermesApiRequest) => Promise<T>
      localChat?: (request: HermesLocalChatRequest) => Promise<HermesLocalChatResponse>
      localChatStream?: (
        request: HermesLocalChatRequest,
        onDelta: (delta: string) => void
      ) => Promise<HermesLocalChatResponse>
      notify: (payload: HermesNotification) => Promise<boolean>
      requestMicrophoneAccess: () => Promise<boolean>
      readFileDataUrl: (filePath: string) => Promise<string>
      readFileText: (filePath: string) => Promise<HermesReadFileTextResult>
      selectPaths: (options?: HermesSelectPathsOptions) => Promise<string[]>
      writeClipboard: (text: string) => Promise<boolean>
      saveImageFromUrl: (url: string, suggestedName?: string) => Promise<boolean>
      saveImageBuffer: (data: ArrayBuffer | Uint8Array, ext: string) => Promise<string>
      saveClipboardImage: () => Promise<string>
      getPathForFile: (file: File) => string
      normalizePreviewTarget: (target: string, baseDir?: string) => Promise<HermesPreviewTarget | null>
      watchPreviewFile: (url: string) => Promise<HermesPreviewWatch>
      stopPreviewFileWatch: (id: string) => Promise<boolean>
      setTitleBarTheme?: (payload: HermesTitleBarTheme) => void
      setPreviewShortcutActive?: (active: boolean) => void
      openExternal: (url: string) => Promise<void>
      fetchLinkTitle: (url: string) => Promise<string>
      settings: {
        getDefaultProjectDir: () => Promise<{ defaultLabel: string; dir: null | string }>
        getUiPreferences: () => Promise<DesktopUiPreferences>
        pickDefaultProjectDir: () => Promise<{ canceled: boolean; dir: null | string }>
        setDefaultProjectDir: (dir: null | string) => Promise<{ dir: null | string }>
        setUiLanguage: (language: null | string) => Promise<DesktopUiPreferences>
      }
      revealLogs: () => Promise<{ ok: boolean; path: string; error?: string }>
      getRecentLogs: () => Promise<{ path: string; lines: string[] }>
      readDir: (path: string) => Promise<HermesReadDirResult>
      gitRoot?: (path: string) => Promise<string | null>
      terminal: {
        dispose: (id: string) => Promise<boolean>
        onData: (id: string, callback: (payload: string) => void) => () => void
        onExit: (id: string, callback: (payload: HermesTerminalExit) => void) => () => void
        resize: (id: string, size: { cols: number; rows: number }) => Promise<boolean>
        start: (options?: { cols?: number; cwd?: string; rows?: number }) => Promise<HermesTerminalSession>
        write: (id: string, data: string) => Promise<boolean>
      }
      onClosePreviewRequested?: (callback: () => void) => () => void
      onContextMenuCopyChat?: (callback: (format: 'markdown' | 'text') => void) => () => void
      onContextMenuSelectBubble?: (callback: (point: { x: number; y: number }) => void) => () => void
      onOpenUpdatesRequested?: (callback: () => void) => () => void
      onWindowStateChanged?: (callback: (payload: HermesWindowState) => void) => () => void
      onPreviewFileChanged: (callback: (payload: HermesPreviewFileChanged) => void) => () => void
      onBackendExit: (callback: (payload: BackendExit) => void) => () => void
      onPowerResume?: (callback: () => void) => () => void
      onBootProgress: (callback: (payload: DesktopBootProgress) => void) => () => void
      getBootstrapState: () => Promise<DesktopBootstrapState>
      resetBootstrap: () => Promise<{ ok: boolean }>
      repairBootstrap: () => Promise<{ ok: boolean }>
      cancelBootstrap: () => Promise<{ ok: boolean; cancelled: boolean }>
      onBootstrapEvent: (callback: (payload: DesktopBootstrapEvent) => void) => () => void
      getVersion: () => Promise<DesktopVersionInfo>
      checkHermesAgentUpdate: () => Promise<DesktopHermesAgentUpdateStatus>
      installHermesAgent: () => Promise<DesktopHermesAgentActionResult>
      updateHermesAgent: () => Promise<DesktopHermesAgentActionResult>
      repairHermesAgent: () => Promise<DesktopHermesAgentActionResult>
      updates: {
        check: () => Promise<DesktopUpdateStatus>
        apply: (opts?: DesktopUpdateApplyOptions) => Promise<DesktopUpdateApplyResult>
        getBranch: () => Promise<{ branch: string }>
        setBranch: (name: string) => Promise<{ branch: string }>
        getSources: () => Promise<DesktopUpdateSourceConfig>
        setSources: (config: DesktopUpdateSourceConfig) => Promise<DesktopUpdateSourceConfig>
        openRepository: () => Promise<void>
        onProgress: (callback: (payload: DesktopUpdateProgress) => void) => () => void
      }
      profile?: {
        get: () => Promise<DesktopActiveProfile>
        set: (name: null | string) => Promise<DesktopActiveProfile>
      }
    }
  }
}

export interface HermesLocalChatMessage {
  content: string
  role: 'assistant' | 'system' | 'user'
}

export interface HermesLocalChatRequest {
  api: 'ollama' | 'openai-compatible'
  baseUrl: string
  messages: HermesLocalChatMessage[]
  model: string
}

export interface HermesLocalChatResponse {
  model?: string
  text: string
}

export interface HermesTerminalSession {
  cwd: string
  id: string
  shell: string
}

export interface HermesTerminalExit {
  code: number | null
  signal: string | null
}

export interface DesktopVersionInfo {
  appVersion: string
  hermesVersion?: string
  electronVersion: string
  nodeVersion: string
  platform: string
  desktopRoot?: string
  hermesRoot: string
}

export interface DesktopActiveProfile {
  profile: string | null
}

export interface DesktopUpdateCommit {
  sha: string
  summary: string
  author: string
  at: number
}

export interface DesktopUpdateStatus {
  supported: boolean
  branch?: string
  currentBranch?: string
  reason?: string
  message?: string
  error?: string
  behind?: number
  currentSha?: string
  targetSha?: string
  commits?: DesktopUpdateCommit[]
  dirty?: boolean
  desktopRoot?: string
  hermesRoot?: string
  fetchedAt?: number
}

export type DesktopUpdateDirtyStrategy = 'abort' | 'stash' | 'force'

export interface DesktopUpdateApplyOptions {
  dirtyStrategy?: DesktopUpdateDirtyStrategy
}

export interface DesktopUpdateApplyResult {
  ok: boolean
  branch?: string
  error?: string
  message?: string
  handedOff?: boolean
  updater?: string
  backendUpdated?: boolean
  /** True when no staged updater exists (CLI install) and the user should run
   *  `hermes update` themselves. `command` is the exact line to run. */
  manual?: boolean
  command?: string
  desktopRoot?: string
  hermesRoot?: string
  hermesCli?: string
  rebuiltApp?: string | null
  targetApp?: string | null
}

export type DesktopAgentGitSource = 'custom' | 'github' | 'gitee' | 'gitcode'
export type DesktopPythonSource = 'aliyun' | 'custom' | 'pypi' | 'tsinghua'
export type DesktopNpmSource = 'custom' | 'npmjs' | 'npmmirror'

export interface DesktopUpdateSourceConfig {
  agentGitCustomUrl: string
  agentGitSource: DesktopAgentGitSource
  desktopRepoUrl: string
  npmCustomUrl: string
  npmSource: DesktopNpmSource
  pythonCustomUrl: string
  pythonSource: DesktopPythonSource
}

export type DesktopUpdateStage =
  | 'idle'
  | 'prepare'
  | 'fetch'
  | 'pull'
  | 'pydeps'
  | 'update'
  | 'rebuild'
  | 'restart'
  | 'done'
  | 'manual'
  | 'error'

export interface DesktopUpdateProgress {
  stage: DesktopUpdateStage
  message: string
  percent: number | null
  error: string | null
  at: number
}

export interface DesktopHermesAgentUpdateStatus {
  installed: boolean
  managed: boolean
  source: DesktopAgentGitSource
  sourceUrl: string
  branch: string
  currentCommit: null | string
  currentVersion: null | string
  latestCommit: null | string
  latestVersion: null | string
  updateAvailable: boolean
  message: string
}

export interface DesktopHermesAgentActionResult extends DesktopHermesAgentUpdateStatus {
  command?: string
  docsUrl?: string
  manual?: boolean
  ok: boolean
}

export interface HermesConnection {
  authMode?: 'oauth' | 'token'
  baseUrl: string
  isFullscreen: boolean
  mode?: 'local' | 'remote'
  nativeOverlayWidth: number
  profile?: null | string
  source?: 'env' | 'local' | 'settings'
  token: string
  wsUrl: string
  logs: string[]
  windowButtonPosition: { x: number; y: number } | null
}

export interface HermesTitleBarTheme {
  background: string
  foreground: string
}

export interface HermesWindowState {
  isFullscreen: boolean
  nativeOverlayWidth: number
  windowButtonPosition: { x: number; y: number } | null
}

export interface DesktopConnectionConfig {
  envOverride: boolean
  mode: 'local' | 'remote'
  profile: null | string
  remoteAuthMode: 'oauth' | 'token'
  remoteOauthConnected: boolean
  remoteTokenPreview: string | null
  remoteTokenSet: boolean
  remoteUrl: string
}

export interface DesktopConnectionConfigInput {
  mode: 'local' | 'remote'
  profile?: null | string
  remoteAuthMode?: 'oauth' | 'token'
  remoteToken?: string
  remoteUrl?: string
}

export interface DesktopUiPreferences {
  language?: null | string
}

export interface DesktopConnectionTestResult {
  baseUrl: string
  ok: boolean
  version: string | null
}

export interface DesktopAuthProvider {
  displayName: string
  name: string
  supportsPassword?: boolean
}

export interface DesktopConnectionProbeResult {
  authMode: 'oauth' | 'token' | 'unknown'
  baseUrl: string
  error: string | null
  providers: DesktopAuthProvider[]
  reachable: boolean
  version: string | null
}

export interface DesktopOauthLoginResult {
  baseUrl: string
  connected: boolean
  ok: boolean
}

export interface DesktopOauthLogoutResult {
  connected: boolean
  ok: boolean
}

export interface DesktopBootProgress {
  error: string | null
  fakeMode: boolean
  message: string
  phase: string
  progress: number
  running: boolean
  timestamp: number
}

// First-launch install ("bootstrap") event types -- emitted by
// electron/bootstrap-runner.cjs and observed by the renderer install overlay.
// Mirrors the event shapes emitted by runBootstrap()'s onEvent callback.

export interface DesktopBootstrapStageDescriptor {
  name: string
  title?: string
  category?: string
  needs_user_input?: boolean
}

export type DesktopBootstrapStageState = 'pending' | 'running' | 'succeeded' | 'skipped' | 'failed'

export interface DesktopBootstrapStageResult {
  state: DesktopBootstrapStageState
  durationMs: number | null
  startedAt: number | null
  json: { ok: boolean; skipped?: boolean; reason?: string | null; stage: string } | null
  error: string | null
}

export interface DesktopBootstrapUnsupportedPlatform {
  platform: string
  activeRoot: string
  installCommand: string
  docsUrl: string
  missingDependencies?: string[]
}

export interface DesktopBootstrapState {
  active: boolean
  manifest: { type: 'manifest'; stages: DesktopBootstrapStageDescriptor[]; protocolVersion: number | null } | null
  stages: Record<string, DesktopBootstrapStageResult>
  error: string | null
  log: Array<{ ts: number; stage: string | null; line: string }>
  startedAt: number | null
  completedAt: number | null
  unsupportedPlatform: DesktopBootstrapUnsupportedPlatform | null
}

export type DesktopBootstrapEvent =
  | { type: 'manifest'; stages: DesktopBootstrapStageDescriptor[]; protocolVersion: number | null }
  | {
      type: 'stage'
      name: string
      state: DesktopBootstrapStageState
      durationMs?: number
      json?: DesktopBootstrapStageResult['json']
      error?: string | null
    }
  | { type: 'log'; stage?: string | null; line: string }
  | { type: 'complete'; marker: Record<string, unknown> }
  | { type: 'failed'; stage?: string | null; error: string }
  | {
      type: 'unsupported-platform'
      platform: string
      activeRoot: string
      installCommand: string
      docsUrl: string
      missingDependencies?: string[]
    }

export interface HermesApiRequest {
  path: string
  method?: string
  body?: unknown
  profile?: null | string
  timeoutMs?: number
}

export interface HermesNotification {
  title?: string
  body?: string
  silent?: boolean
}

export interface HermesPreviewTarget {
  binary?: boolean
  byteSize?: number
  kind: 'file' | 'url'
  label: string
  large?: boolean
  language?: string
  mimeType?: string
  path?: string
  previewKind?: 'binary' | 'html' | 'image' | 'text'
  renderMode?: 'preview' | 'source'
  source: string
  url: string
}

export interface HermesReadFileTextResult {
  binary?: boolean
  byteSize?: number
  language?: string
  mimeType?: string
  path: string
  text: string
  truncated?: boolean
}

export interface HermesPreviewWatch {
  id: string
  path: string
}

export interface HermesReadDirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface HermesReadDirResult {
  entries: HermesReadDirEntry[]
  error?: string
}

export interface HermesPreviewFileChanged {
  id: string
  path: string
  url: string
}

export interface HermesSelectPathsOptions {
  title?: string
  defaultPath?: string
  directories?: boolean
  multiple?: boolean
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface BackendExit {
  code: number | null
  signal: string | null
}

use base64::Engine as _;
#[cfg(target_os = "macos")]
use block2::RcBlock;
use notify::{recommended_watcher, RecursiveMode, Watcher};
#[cfg(target_os = "macos")]
use objc2::runtime::Bool as ObjcBool;
#[cfg(target_os = "macos")]
use objc2_av_foundation::{AVCaptureDevice, AVMediaTypeAudio};
use portable_pty::{Child, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex as StdMutex,
};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State, Window};
use tokio::sync::Mutex;

const DEFAULT_UPDATE_BRANCH: &str = "main";
const DESKTOP_UPDATE_CONFIG_PATH: &str = "updates.json";
const UPDATE_PROGRESS_EVENT: &str = "hermes:updates:progress";
const OPEN_UPDATES_EVENT: &str = "hermes:open-updates";
const CLOSE_PREVIEW_EVENT: &str = "hermes:close-preview-requested";
const WINDOW_STATE_EVENT: &str = "hermes:window-state-changed";
const BOOTSTRAP_EVENT: &str = "hermes:bootstrap:event";
const CONTEXT_SPELLING_SUGGESTION_PREFIX: &str = "context-spelling-suggestion-";
const DESKTOP_DOCS_URL: &str = "https://hermes-agent.nousresearch.com/docs/";
const BOOTSTRAP_LOG_RING_MAX: usize = 500;
const DEFAULT_FETCH_TIMEOUT_MS: u64 = 15_000;
const PREVIEW_WATCH_DEBOUNCE_MS: u64 = 120;
const DATA_URL_READ_MAX_BYTES: u64 = 16 * 1024 * 1024;
const TEXT_PREVIEW_SOURCE_MAX_BYTES: u64 = 64 * 1024 * 1024;
const TEXT_PREVIEW_MAX_BYTES: u64 = 512 * 1024;
const LINK_TITLE_BYTE_BUDGET: usize = 96 * 1024;
const LINK_TITLE_TIMEOUT_MS: u64 = 5_000;
const LINK_TITLE_RENDER_TIMEOUT_MS: u64 = 8_000;
const LINK_TITLE_RENDER_GRACE_MS: u64 = 700;
const LINK_TITLE_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_0) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const DOCK_PINNED_MARKER: &str = "dock-pinned.json";
const SAFE_ENV_SUFFIXES: &[&str] = &["dist", "example", "sample", "template"];
const SENSITIVE_EXTENSIONS: &[&str] = &[".kdbx", ".p12", ".pem", ".pfx"];
const FS_READDIR_HIDDEN: &[&str] = &[
    ".git",
    ".hg",
    ".svn",
    ".cache",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
    "venv",
];

#[cfg(target_os = "macos")]
const MACOS_WINDOW_BUTTON_POSITION: WindowButtonPosition = WindowButtonPosition { x: 24, y: 10 };
#[cfg(not(target_os = "macos"))]
const MACOS_WINDOW_BUTTON_POSITION: WindowButtonPosition = WindowButtonPosition { x: 24, y: 10 };
const NATIVE_OVERLAY_BUTTON_WIDTH: i32 = 144;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiRequest {
    pub path: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub body: Option<serde_json::Value>,
    #[serde(default, rename = "timeoutMs")]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionConfig {
    pub mode: String,
    #[serde(default)]
    pub remote: Option<RemoteConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DesktopConnectionConfigState {
    #[serde(rename = "envOverride")]
    pub env_override: bool,
    pub mode: String,
    #[serde(rename = "remoteTokenPreview")]
    pub remote_token_preview: Option<String>,
    #[serde(rename = "remoteTokenSet")]
    pub remote_token_set: bool,
    #[serde(rename = "remoteUrl")]
    pub remote_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct RemoteConfig {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub token: Option<TokenValue>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenValue {
    pub value: String,
    #[serde(default)]
    pub encoding: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConnection {
    pub base_url: String,
    pub token: String,
    pub ws_url: String,
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default)]
    pub logs: Vec<String>,
    #[serde(default)]
    pub is_fullscreen: bool,
    #[serde(default)]
    pub native_overlay_width: i32,
    #[serde(default)]
    pub window_button_position: Option<WindowButtonPosition>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HermesCliInfo {
    version: String,
    project_root: Option<PathBuf>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BootProgress {
    pub phase: String,
    pub message: String,
    pub progress: u32,
    pub running: bool,
    pub error: Option<String>,
    #[serde(rename = "fakeMode")]
    pub fake_mode: bool,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DefaultProjectDirState {
    #[serde(rename = "defaultLabel")]
    pub default_label: String,
    pub dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PickDefaultProjectDirResult {
    pub canceled: bool,
    pub dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PreviewWatchPayload {
    id: String,
    path: String,
    url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BootstrapStageResult {
    pub state: String,
    #[serde(rename = "durationMs")]
    pub duration_ms: Option<u64>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<u64>,
    pub json: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BootstrapState {
    pub active: bool,
    pub manifest: Option<serde_json::Value>,
    pub stages: HashMap<String, BootstrapStageResult>,
    pub error: Option<String>,
    pub log: Vec<serde_json::Value>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<u64>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<u64>,
    #[serde(rename = "unsupportedPlatform")]
    pub unsupported_platform: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowButtonPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PreviewWatch {
    pub id: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowStatePayload {
    #[serde(rename = "isFullscreen")]
    pub is_fullscreen: bool,
    #[serde(rename = "nativeOverlayWidth")]
    pub native_overlay_width: i32,
    #[serde(rename = "windowButtonPosition")]
    pub window_button_position: Option<WindowButtonPosition>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ContextMenuEditFlags {
    #[serde(rename = "canCut", default)]
    pub can_cut: bool,
    #[serde(rename = "canCopy", default)]
    pub can_copy: bool,
    #[serde(rename = "canPaste", default)]
    pub can_paste: bool,
    #[serde(rename = "canSelectAll", default)]
    pub can_select_all: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ContextMenuRequest {
    #[serde(rename = "selectionText", default)]
    pub selection_text: String,
    #[serde(rename = "isEditable", default)]
    pub is_editable: bool,
    #[serde(rename = "linkUrl", default)]
    pub link_url: Option<String>,
    #[serde(rename = "imageUrl", default)]
    pub image_url: Option<String>,
    #[serde(rename = "editFlags", default)]
    pub edit_flags: ContextMenuEditFlags,
    #[serde(rename = "misspelledWord", default)]
    pub misspelled_word: Option<String>,
    #[serde(rename = "dictionarySuggestions", default)]
    pub dictionary_suggestions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UpdateApplyOptions {
    #[serde(rename = "dirtyStrategy", default)]
    pub dirty_strategy: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TitlebarThemePayload {
    background: String,
    foreground: String,
}

struct TerminalSession {
    master: StdMutex<Box<dyn portable_pty::MasterPty + Send>>,
    child: StdMutex<Box<dyn Child + Send>>,
    writer: StdMutex<Box<dyn Write + Send>>,
    event_target: String,
    alive: AtomicBool,
    exited: AtomicBool,
}

// ============================================================================
// State
// ============================================================================

pub struct AppState {
    pub connection: Mutex<Option<GatewayConnection>>,
    pub boot_progress: Mutex<BootProgress>,
    pub startup_lock: Mutex<()>,
    pub bootstrap_failure: Mutex<Option<String>>,
    pub backend_pid: StdMutex<Option<u32>>,
    pub bootstrap_state: StdMutex<BootstrapState>,
    pub window_zoom: StdMutex<f64>,
    pub context_menu_request: StdMutex<Option<ContextMenuRequest>>,
    pub preview_watches: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub preview_shortcut_active: AtomicBool,
    pub update_in_flight: AtomicBool,
    terminal_sessions: Arc<StdMutex<HashMap<String, Arc<TerminalSession>>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
            boot_progress: Mutex::new(BootProgress {
                phase: "idle".to_string(),
                message: "Waiting to start Hermes backend".to_string(),
                progress: 0,
                running: false,
                error: None,
                fake_mode: false,
                timestamp: chrono::Utc::now().timestamp_millis(),
            }),
            startup_lock: Mutex::new(()),
            bootstrap_failure: Mutex::new(None),
            backend_pid: StdMutex::new(None),
            bootstrap_state: StdMutex::new(initial_bootstrap_state()),
            window_zoom: StdMutex::new(1.0),
            context_menu_request: StdMutex::new(None),
            preview_watches: Mutex::new(HashMap::new()),
            preview_shortcut_active: AtomicBool::new(false),
            update_in_flight: AtomicBool::new(false),
            terminal_sessions: Arc::new(StdMutex::new(HashMap::new())),
        }
    }
}

fn clamp_boot_progress(value: u32) -> u32 {
    value.min(100)
}

async fn update_boot_progress(
    state: &AppState,
    phase: Option<&str>,
    message: Option<&str>,
    progress: Option<u32>,
    running: Option<bool>,
    error: Option<Option<String>>,
    allow_decrease: bool,
) {
    let mut snapshot = state.boot_progress.lock().await;
    let next_progress_raw = progress
        .map(clamp_boot_progress)
        .unwrap_or(snapshot.progress);
    let next_progress = if allow_decrease {
        next_progress_raw
    } else {
        snapshot.progress.max(next_progress_raw)
    };

    if let Some(value) = phase {
        snapshot.phase = value.to_string();
    }
    if let Some(value) = message {
        snapshot.message = value.to_string();
        append_desktop_log(&format!("[boot] {}\n", value));
    }
    if let Some(value) = running {
        snapshot.running = value;
    }
    if let Some(value) = error {
        snapshot.error = value;
    }

    snapshot.progress = next_progress;
    snapshot.timestamp = chrono::Utc::now().timestamp_millis();
}

async fn fail_boot_progress(state: &AppState, message: String) {
    update_boot_progress(
        state,
        Some("backend.error"),
        Some(&format!("Desktop boot failed: {}", message)),
        None,
        Some(false),
        Some(Some(message)),
        true,
    )
    .await;
}

fn append_desktop_log(chunk: &str) {
    let log_path = desktop_log_path();
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .and_then(|mut file| std::io::Write::write_all(&mut file, chunk.as_bytes()));
}

fn update_bootstrap_state_with_event(state: &AppState, event: &serde_json::Value) {
    let Ok(mut snapshot) = state.bootstrap_state.lock() else {
        return;
    };

    let event_type = event
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    match event_type {
        "manifest" => {
            snapshot.manifest = Some(event.clone());
            snapshot.active = true;
            if snapshot.started_at.is_none() {
                snapshot.started_at = Some(chrono::Utc::now().timestamp_millis() as u64);
            }
            snapshot.stages.clear();
            if let Some(stages) = event.get("stages").and_then(|value| value.as_array()) {
                for stage in stages {
                    if let Some(name) = stage.get("name").and_then(|value| value.as_str()) {
                        snapshot.stages.insert(
                            name.to_string(),
                            BootstrapStageResult {
                                state: "pending".to_string(),
                                duration_ms: None,
                                started_at: None,
                                json: None,
                                error: None,
                            },
                        );
                    }
                }
            }
            snapshot.error = None;
            snapshot.unsupported_platform = None;
        }
        "stage" => {
            let Some(name) = event.get("name").and_then(|value| value.as_str()) else {
                return;
            };
            let current_started_at = snapshot.stages.get(name).and_then(|stage| stage.started_at);
            let next_state = event
                .get("state")
                .and_then(|value| value.as_str())
                .unwrap_or("pending")
                .to_string();
            snapshot.stages.insert(
                name.to_string(),
                BootstrapStageResult {
                    state: next_state.clone(),
                    duration_ms: event.get("durationMs").and_then(|value| value.as_u64()),
                    started_at: if next_state == "running" {
                        current_started_at
                            .or_else(|| Some(chrono::Utc::now().timestamp_millis() as u64))
                    } else {
                        current_started_at
                    },
                    json: event.get("json").cloned(),
                    error: event
                        .get("error")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string()),
                },
            );
        }
        "log" => {
            snapshot.log.push(serde_json::json!({
                "ts": chrono::Utc::now().timestamp_millis(),
                "stage": event.get("stage").and_then(|value| value.as_str()),
                "line": event.get("line").and_then(|value| value.as_str()).unwrap_or_default(),
            }));
            if snapshot.log.len() > BOOTSTRAP_LOG_RING_MAX {
                let drain = snapshot.log.len() - BOOTSTRAP_LOG_RING_MAX;
                snapshot.log.drain(0..drain);
            }
        }
        "complete" => {
            snapshot.active = false;
            snapshot.completed_at = Some(chrono::Utc::now().timestamp_millis() as u64);
            snapshot.error = None;
            snapshot.unsupported_platform = None;
        }
        "failed" => {
            snapshot.active = false;
            snapshot.error = event
                .get("error")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
                .or_else(|| Some("unknown error".to_string()));
        }
        "unsupported-platform" => {
            snapshot.active = false;
            snapshot.unsupported_platform = Some(serde_json::json!({
                "platform": event.get("platform").and_then(|value| value.as_str()).unwrap_or(std::env::consts::OS),
                "activeRoot": event.get("activeRoot").and_then(|value| value.as_str()).unwrap_or_default(),
                "installCommand": event.get("installCommand").and_then(|value| value.as_str()).unwrap_or_default(),
                "docsUrl": event.get("docsUrl").and_then(|value| value.as_str()).unwrap_or(DESKTOP_DOCS_URL),
            }));
        }
        _ => {}
    }
}

fn emit_bootstrap_event(app: &AppHandle, state: &AppState, event: serde_json::Value) {
    update_bootstrap_state_with_event(state, &event);
    let _ = app.emit_to("main", BOOTSTRAP_EVENT, event);
}

// ============================================================================
// Connection Management
// ============================================================================

#[tauri::command]
pub async fn get_connection(state: State<'_, AppState>) -> Result<GatewayConnection, String> {
    let conn = state.connection.lock().await;
    conn.clone().ok_or_else(|| "Not connected".to_string())
}

#[tauri::command]
pub async fn get_connection_config() -> Result<serde_json::Value, String> {
    let config = read_connection_config_from_disk();
    Ok(serde_json::json!(sanitize_connection_config(&config)))
}

#[tauri::command]
pub async fn save_connection_config(config: ConnectionConfig) -> Result<serde_json::Value, String> {
    let existing = read_connection_config_from_disk();
    let next = coerce_connection_config(config, &existing)?;
    write_connection_config_to_disk(&next)?;
    Ok(serde_json::json!(sanitize_connection_config(&next)))
}

#[tauri::command]
pub async fn apply_connection_config(
    config: ConnectionConfig,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let existing = read_connection_config_from_disk();
    let next = coerce_connection_config(config, &existing)?;
    write_connection_config_to_disk(&next)?;
    let mut conn = state.connection.lock().await;
    *conn = None;
    Ok(serde_json::json!(sanitize_connection_config(&next)))
}

#[tauri::command]
pub async fn test_connection_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: ConnectionConfig,
) -> Result<serde_json::Value, String> {
    let existing = read_connection_config_from_disk();
    let next = coerce_connection_config(config, &existing)?;
    let remote = if let Some(remote) = resolve_remote_backend_from_config(&next)? {
        remote
    } else if let Some(remote) = resolve_remote_backend_from_env()? {
        remote
    } else {
        start_hermes_impl(&app, &state).await?
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    let base_url = remote.base_url.clone();
    let response = client
        .get(format!("{}/api/status", base_url))
        .header("X-Hermes-Session-Token", &remote.token)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Connection failed: HTTP {}",
            response.status().as_u16()
        ));
    }

    let status = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse gateway status: {}", e))?;

    Ok(serde_json::json!({
        "ok": true,
        "baseUrl": base_url,
        "version": status.get("version").and_then(|value| value.as_str())
    }))
}

// ============================================================================
// Gateway Connection
// ============================================================================

#[tauri::command]
pub async fn start_hermes(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<GatewayConnection, String> {
    start_hermes_impl(&app, &state).await
}

async fn start_hermes_impl(
    app: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<GatewayConnection, String> {
    if let Some(message) = state.bootstrap_failure.lock().await.clone() {
        return Err(message);
    }

    {
        let conn = state.connection.lock().await;
        if let Some(ref c) = *conn {
            return Ok(c.clone());
        }
    }

    // Match Electron's connectionPromise single-flight behavior so multiple
    // renderer callers cannot spawn duplicate local gateways during startup.
    let _startup_guard = state.startup_lock.lock().await;

    if let Some(message) = state.bootstrap_failure.lock().await.clone() {
        return Err(message);
    }

    {
        let conn = state.connection.lock().await;
        if let Some(ref c) = *conn {
            return Ok(c.clone());
        }
    }

    update_boot_progress(
        &*state,
        Some("backend.resolve"),
        Some("Resolving Hermes backend"),
        Some(8),
        Some(true),
        Some(None),
        false,
    )
    .await;

    if let Some(remote) = resolve_remote_backend_from_env()? {
        let remote = decorate_gateway_connection(remote, app, Some("env"));
        update_boot_progress(
            &*state,
            Some("backend.remote"),
            Some(&format!(
                "Connecting to remote Hermes backend at {}",
                remote.base_url
            )),
            Some(24),
            Some(true),
            Some(None),
            false,
        )
        .await;
        wait_for_hermes(&remote.base_url, &remote.token, 8).await?;
        update_boot_progress(
            &*state,
            Some("backend.ready"),
            Some("Remote Hermes backend is ready"),
            Some(94),
            Some(true),
            Some(None),
            false,
        )
        .await;
        let mut state_conn = state.connection.lock().await;
        *state_conn = Some(remote.clone());
        return Ok(remote);
    }

    let has_saved_config = get_connection_config_path().exists();
    let config = read_connection_config_from_disk();

    if has_saved_config {
        let conn = connect_gateway_from_config(app, state, &config).await?;
        if conn.mode == "remote" {
            update_boot_progress(
                &*state,
                Some("backend.remote"),
                Some(&format!(
                    "Connecting to remote Hermes backend at {}",
                    conn.base_url
                )),
                Some(24),
                Some(true),
                Some(None),
                false,
            )
            .await;
            wait_for_hermes(&conn.base_url, &conn.token, 8).await?;
            update_boot_progress(
                &*state,
                Some("backend.ready"),
                Some("Remote Hermes backend is ready"),
                Some(94),
                Some(true),
                Some(None),
                false,
            )
            .await;
        }
        return Ok(conn);
    }

    // First launch can attach to an already-running gateway, but saved config
    // always wins so reconnect/apply stays deterministic.
    if let Some(conn) = try_auto_detect_gateway().await {
        let conn = decorate_gateway_connection(conn, app, Some("local"));
        update_boot_progress(
            &*state,
            Some("backend.remote"),
            Some("Connecting to existing Hermes gateway"),
            Some(50),
            Some(true),
            Some(None),
            false,
        )
        .await;
        wait_for_hermes(&conn.base_url, &conn.token, 8).await?;
        update_boot_progress(
            &*state,
            Some("backend.ready"),
            Some("Connected to existing gateway"),
            Some(94),
            Some(true),
            Some(None),
            false,
        )
        .await;
        let mut state_conn = state.connection.lock().await;
        *state_conn = Some(conn.clone());
        return Ok(conn);
    }

    match spawn_local_hermes(&app, &state).await {
        Ok(conn) => {
            let conn = decorate_gateway_connection(conn, app, Some("local"));
            let mut state_conn = state.connection.lock().await;
            *state_conn = Some(conn.clone());
            *state.bootstrap_failure.lock().await = None;
            Ok(conn)
        }
        Err(error) => {
            fail_boot_progress(&*state, error.clone()).await;
            *state.bootstrap_failure.lock().await = Some(error.clone());
            Err(error)
        }
    }
}

async fn connect_gateway_from_config(
    app: &AppHandle,
    state: &State<'_, AppState>,
    config: &ConnectionConfig,
) -> Result<GatewayConnection, String> {
    if let Some(conn) = resolve_remote_backend_from_config(config)? {
        let conn = decorate_gateway_connection(conn, app, Some("settings"));
        let mut state_conn = state.connection.lock().await;
        *state_conn = Some(conn.clone());
        return Ok(conn);
    }

    let conn = spawn_local_hermes(app, state).await?;
    let conn = decorate_gateway_connection(conn, app, Some("settings"));
    let mut state_conn = state.connection.lock().await;
    *state_conn = Some(conn.clone());
    Ok(conn)
}

async fn try_auto_detect_gateway() -> Option<GatewayConnection> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .ok()?;

    let resp = client.get("http://127.0.0.1:9119").send().await.ok()?;
    let html = resp.text().await.ok()?;

    let token = extract_token(&html)?;
    let chat_enabled = html.contains("__HERMES_DASHBOARD_EMBEDDED_CHAT__=true");
    if !chat_enabled {
        return None;
    }

    if !probe_desktop_dashboard_routes(&client, "http://127.0.0.1:9119").await {
        return None;
    }

    Some(new_gateway_connection(
        "http://127.0.0.1:9119".to_string(),
        token.clone(),
        build_gateway_ws_url("http://127.0.0.1:9119", &token).ok()?,
        "remote",
    ))
}

fn extract_token(html: &str) -> Option<String> {
    let re = regex::Regex::new(r#"__HERMES_SESSION_TOKEN__="([^"]+)""#).ok()?;
    let caps = re.captures(html)?;
    caps.get(1).map(|m| m.as_str().to_string())
}

fn local_dashboard_command_args(port: u16) -> Vec<String> {
    vec![
        "dashboard".to_string(),
        "--no-open".to_string(),
        "--host".to_string(),
        "127.0.0.1".to_string(),
        "--port".to_string(),
        port.to_string(),
    ]
}

fn desktop_openapi_has_required_routes(spec: &serde_json::Value) -> bool {
    let Some(paths) = spec.get("paths").and_then(|value| value.as_object()) else {
        return false;
    };

    let has_method = |path: &str, method: &str| {
        paths
            .get(path)
            .and_then(|entry| entry.get(method))
            .is_some()
    };

    has_method("/api/audio/transcribe", "post")
        && has_method("/api/audio/speak", "post")
        && has_method("/api/sessions/{session_id}", "patch")
}

async fn probe_desktop_dashboard_routes(client: &reqwest::Client, base_url: &str) -> bool {
    let Ok(response) = client
        .get(format!("{}/openapi.json", base_url.trim_end_matches('/')))
        .send()
        .await
    else {
        return false;
    };

    if !response.status().is_success() {
        return false;
    }

    let Ok(spec) = response.json::<serde_json::Value>().await else {
        return false;
    };

    desktop_openapi_has_required_routes(&spec)
}

async fn spawn_local_hermes(
    app: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<GatewayConnection, String> {
    update_boot_progress(
        &*state,
        Some("backend.port"),
        Some("Finding an open local port"),
        Some(16),
        Some(true),
        Some(None),
        false,
    )
    .await;
    let port = find_free_port().ok_or("No free port available")?;
    let token = generate_token();

    update_boot_progress(
        &*state,
        Some("backend.runtime"),
        Some("Resolving Hermes runtime"),
        Some(28),
        Some(true),
        Some(None),
        false,
    )
    .await;

    let active_root = active_hermes_root();
    let hermes_command = if let Some(command) = resolve_hermes_cli_binary(&active_root) {
        command.to_string_lossy().to_string()
    } else {
        let install_command =
            "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --include-desktop";
        emit_bootstrap_event(
            app,
            &*state,
            serde_json::json!({
                "type": "unsupported-platform",
                "platform": std::env::consts::OS,
                "activeRoot": active_root.to_string_lossy().to_string(),
                "installCommand": install_command,
                "docsUrl": DESKTOP_DOCS_URL,
            }),
        );
        return Err(format!(
            "Hermes CLI is not installed yet. Run `{}` or `hermes desktop` first. Logs: {}",
            install_command,
            desktop_log_path().to_string_lossy()
        ));
    };

    update_boot_progress(
        &*state,
        Some("backend.spawn"),
        Some("Starting Hermes backend"),
        Some(84),
        Some(true),
        Some(None),
        false,
    )
    .await;

    let mut child = StdCommand::new(&hermes_command)
        .args(local_dashboard_command_args(port))
        .env("HERMES_DASHBOARD_SESSION_TOKEN", &token)
        .env("HERMES_DASHBOARD_TUI", "1")
        .env("HERMES_HOME", resolve_hermes_home())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn hermes: {}", e))?;

    if let Ok(mut tracked_pid) = state.backend_pid.lock() {
        *tracked_pid = Some(child.id());
    }

    if let Some(stdout) = child.stdout.take() {
        spawn_process_logger(stdout, None);
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_process_logger(stderr, Some("stderr"));
    }

    let base_url = format!("http://127.0.0.1:{}", port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    update_boot_progress(
        &*state,
        Some("backend.wait"),
        Some("Waiting for Hermes backend to become ready"),
        Some(90),
        Some(true),
        Some(None),
        false,
    )
    .await;

    for _ in 0..60 {
        if let Ok(Some(status)) = child.try_wait() {
            let signal = status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "unknown".to_string());
            return Err(format!(
                "Hermes backend exited before it became ready ({}). Log: {}",
                signal,
                desktop_log_path().to_string_lossy()
            ));
        }

        if let Ok(resp) = client.get(format!("{}/api/status", base_url)).send().await {
            if resp.status().is_success() {
                if !probe_desktop_dashboard_routes(&client, &base_url).await {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "Hermes dashboard started on {}, but it is missing desktop routes. Upgrade Hermes Agent and restart Hermes Desktop. Log: {}",
                        base_url,
                        desktop_log_path().to_string_lossy()
                    ));
                }

                let actual_token = if let Ok(html_resp) = client.get(&base_url).send().await {
                    if let Ok(html) = html_resp.text().await {
                        extract_token(&html).unwrap_or(token.clone())
                    } else {
                        token.clone()
                    }
                } else {
                    token.clone()
                };

                let conn = new_gateway_connection(
                    base_url.clone(),
                    actual_token.clone(),
                    build_gateway_ws_url(&base_url, &actual_token)?,
                    "local",
                );

                let mut state_conn = state.connection.lock().await;
                *state_conn = Some(conn.clone());
                update_boot_progress(
                    &*state,
                    Some("backend.ready"),
                    Some("Hermes backend is ready. Finalizing desktop startup"),
                    Some(94),
                    Some(true),
                    Some(None),
                    false,
                )
                .await;
                spawn_backend_exit_monitor(app.clone(), child);
                return Ok(conn);
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }

    let _ = child.kill();
    let _ = child.wait();
    Err(format!(
        "Hermes backend failed to start. Log: {}",
        desktop_log_path().to_string_lossy()
    ))
}

// ============================================================================
// API Proxy (core handler)
// ============================================================================

#[tauri::command]
pub async fn hermes_api(
    request: ApiRequest,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let (base_url, token, mode) = {
        let conn = state.connection.lock().await;
        let conn = conn.as_ref().ok_or("Not connected to Hermes gateway")?;
        (conn.base_url.clone(), conn.token.clone(), conn.mode.clone())
    };

    if let Some(value) = try_handle_local_session_rename(&request, &base_url, &token, &mode).await?
    {
        return Ok(value);
    }

    let url = format!("{}{}", base_url, request.path);
    let method = request.method.as_deref().unwrap_or("GET");
    let timeout_ms = resolve_timeout_ms(request.timeout_ms, DEFAULT_FETCH_TIMEOUT_MS);
    let timeout = std::time::Duration::from_millis(timeout_ms);

    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let mut req_builder = match method {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };

    req_builder = req_builder.header("X-Hermes-Session-Token", &token);

    if let Some(body) = request.body {
        req_builder = req_builder.json(&body);
    }

    let resp = req_builder.send().await.map_err(|e| {
        if e.is_timeout() {
            format!(
                "Timed out connecting to Hermes backend after {}ms",
                timeout_ms
            )
        } else {
            format!("Request failed: {}", e)
        }
    })?;
    let status = resp.status();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    parse_hermes_api_response(&url, status, content_type.as_deref(), &text)
}

// ============================================================================
// Boot Progress
// ============================================================================

#[tauri::command]
pub async fn get_boot_progress(state: State<'_, AppState>) -> Result<BootProgress, String> {
    let progress = state.boot_progress.lock().await;
    Ok(progress.clone())
}

#[tauri::command]
pub async fn get_bootstrap_state(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    let snapshot = state
        .bootstrap_state
        .lock()
        .map_err(|_| "Failed to access bootstrap state".to_string())?
        .clone();

    Ok(snapshot)
}

#[tauri::command]
pub async fn reset_bootstrap(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    *state.bootstrap_failure.lock().await = None;
    *state.connection.lock().await = None;
    terminate_tracked_backend(&state);
    {
        let mut snapshot = state
            .bootstrap_state
            .lock()
            .map_err(|_| "Failed to access bootstrap state".to_string())?;
        *snapshot = initial_bootstrap_state();
    }
    update_boot_progress(
        &*state,
        Some("idle"),
        Some("Waiting to start Hermes backend"),
        Some(0),
        Some(false),
        Some(None),
        true,
    )
    .await;
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn repair_bootstrap(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    *state.bootstrap_failure.lock().await = None;
    *state.connection.lock().await = None;
    terminate_tracked_backend(&state);
    let marker = bootstrap_complete_marker_path();
    if marker.exists() {
        let _ = fs::remove_file(&marker);
    }
    {
        let mut snapshot = state
            .bootstrap_state
            .lock()
            .map_err(|_| "Failed to access bootstrap state".to_string())?;
        *snapshot = initial_bootstrap_state();
    }
    update_boot_progress(
        &*state,
        Some("idle"),
        Some("Waiting to start Hermes backend"),
        Some(0),
        Some(false),
        Some(None),
        true,
    )
    .await;
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn cancel_bootstrap(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let mut snapshot = state
        .bootstrap_state
        .lock()
        .map_err(|_| "Failed to access bootstrap state".to_string())?;
    let cancelled = snapshot.active;
    snapshot.active = false;
    if cancelled {
        snapshot.error = Some("bootstrap cancelled by user".to_string());
    }
    Ok(serde_json::json!({ "ok": cancelled, "cancelled": cancelled }))
}

// ============================================================================
// File Operations
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ReadFileTextResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    binary: Option<bool>,
    #[serde(rename = "byteSize", skip_serializing_if = "Option::is_none")]
    byte_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    #[serde(rename = "mimeType", skip_serializing_if = "Option::is_none")]
    mime_type: Option<String>,
    path: String,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    truncated: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ReadDirEntryResult {
    name: String,
    path: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    size: u64,
}

#[derive(Debug, Serialize)]
pub struct ReadDirResult {
    entries: Vec<ReadDirEntryResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct PreviewTargetResult {
    kind: String,
    label: String,
    source: String,
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    binary: Option<bool>,
    #[serde(rename = "byteSize", skip_serializing_if = "Option::is_none")]
    byte_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    large: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    #[serde(rename = "mimeType", skip_serializing_if = "Option::is_none")]
    mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(rename = "previewKind", skip_serializing_if = "Option::is_none")]
    preview_kind: Option<String>,
    #[serde(rename = "renderMode", skip_serializing_if = "Option::is_none")]
    render_mode: Option<String>,
}

#[tauri::command]
pub async fn read_file_data_url(path: String) -> Result<String, String> {
    let (resolved_path, _) = resolve_readable_file_for_ipc(
        &path,
        ResolveReadableFileOptions {
            max_bytes: Some(DATA_URL_READ_MAX_BYTES),
            purpose: "File preview",
            ..Default::default()
        },
    )?;
    let data = fs::read(&resolved_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let mime = mime_guess::from_path(&resolved_path).first_or_octet_stream();
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub async fn read_file_text(path: String) -> Result<ReadFileTextResult, String> {
    let (resolved_path, stat) = resolve_readable_file_for_ipc(
        &path,
        ResolveReadableFileOptions {
            max_bytes: Some(TEXT_PREVIEW_SOURCE_MAX_BYTES),
            purpose: "Text preview",
            ..Default::default()
        },
    )?;
    let ext = PathBuf::from(&resolved_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value.to_lowercase()))
        .unwrap_or_default();
    let bytes_to_read = stat.len().min(TEXT_PREVIEW_MAX_BYTES) as usize;
    let mut buffer = vec![0u8; bytes_to_read];
    let mut file =
        fs::File::open(&resolved_path).map_err(|e| format!("Failed to read file: {}", e))?;
    use std::io::Read;
    let bytes_read = file
        .read(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    buffer.truncate(bytes_read);

    Ok(ReadFileTextResult {
        binary: Some(looks_binary(&buffer[..buffer.len().min(4096)])),
        byte_size: Some(stat.len()),
        language: preview_language_for_ext(&ext).or_else(|| Some("text".to_string())),
        mime_type: Some(
            mime_guess::from_path(&resolved_path)
                .first_or_octet_stream()
                .to_string(),
        ),
        path: resolved_path.to_string_lossy().to_string(),
        text: String::from_utf8_lossy(&buffer).to_string(),
        truncated: Some(stat.len() > TEXT_PREVIEW_MAX_BYTES),
    })
}

#[tauri::command]
pub async fn read_dir(path: String) -> Result<ReadDirResult, String> {
    let resolved = resolve_dir_path(&path);
    if resolved.as_os_str().is_empty() {
        return Ok(ReadDirResult {
            entries: Vec::new(),
            error: Some("invalid-path".to_string()),
        });
    }

    let entries = match fs::read_dir(&resolved) {
        Ok(entries) => entries,
        Err(error) => {
            return Ok(ReadDirResult {
                entries: Vec::new(),
                error: Some(io_error_code(&error)),
            });
        }
    };
    let mut result = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                return Ok(ReadDirResult {
                    entries: Vec::new(),
                    error: Some(io_error_code(&error)),
                });
            }
        };
        let name = entry.file_name().to_string_lossy().to_string();
        if FS_READDIR_HIDDEN.contains(&name.as_str()) {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        result.push(ReadDirEntryResult {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
        });
    }
    result.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(ReadDirResult {
        entries: result,
        error: None,
    })
}

#[tauri::command]
pub async fn git_root(start_path: String) -> Result<Option<String>, String> {
    let input = start_path.trim();
    let resolved = resolve_requested_file_path(input, None, "Git root lookup")?;
    let start = match fs::metadata(&resolved) {
        Ok(metadata) if metadata.is_dir() => resolved,
        Ok(_) => resolved
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| resolved.clone()),
        Err(_) => resolved,
    };

    Ok(find_git_root(&start).map(|path| path.to_string_lossy().to_string()))
}

// ============================================================================
// Clipboard
// ============================================================================

#[tauri::command]
pub async fn write_clipboard(text: String) -> Result<(), String> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to access clipboard: {}", e))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to write clipboard: {}", e))
}

// ============================================================================
// Notifications
// ============================================================================

#[tauri::command]
pub async fn notify(title: String, body: String, _silent: Option<bool>) -> Result<bool, String> {
    let title = if title.trim().is_empty() {
        "Hermes".to_string()
    } else {
        title
    };

    #[cfg(target_os = "macos")]
    {
        let output = StdCommand::new("osascript")
            .args([
                "-e",
                &format!(
                    "display notification \"{}\" with title \"{}\"",
                    body.replace('"', "\\\""),
                    title.replace('"', "\\\"")
                ),
            ])
            .output()
            .map_err(|e| format!("Failed to send notification: {}", e))?;

        return Ok(output.status.success());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let silent = _silent.unwrap_or(false);
        let mut notification = notify_rust::Notification::new();
        notification.summary(&title).body(&body);

        #[cfg(all(unix, not(target_os = "macos")))]
        if silent {
            notification.hint(notify_rust::Hint::SuppressSound(true));
        }

        return Ok(notification.show().is_ok());
    }
}

// ============================================================================
// External Links
// ============================================================================

#[derive(Debug, PartialEq, Eq)]
enum OpenExternalTarget {
    File(PathBuf),
    Url(String),
}

fn parse_open_external_target(raw_url: &str) -> Result<OpenExternalTarget, String> {
    let raw = raw_url.trim();
    if raw.is_empty() {
        return Err("Invalid external URL".to_string());
    }

    let parsed = reqwest::Url::parse(raw).map_err(|_| "Invalid external URL".to_string())?;

    if parsed.scheme() == "file" {
        let path = parsed
            .to_file_path()
            .map_err(|_| "Invalid external URL".to_string())?;
        return Ok(OpenExternalTarget::File(path));
    }

    Ok(OpenExternalTarget::Url(parsed.to_string()))
}

fn open_external_target(target: OpenExternalTarget) -> Result<(), String> {
    match target {
        OpenExternalTarget::File(path) => match open::that(&path) {
            Ok(()) => Ok(()),
            Err(open_error) => {
                if reveal_path_in_file_manager(&path)? {
                    Ok(())
                } else {
                    Err(format!("Failed to open file URL: {}", open_error))
                }
            }
        },
        OpenExternalTarget::Url(url) => {
            open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
        }
    }
}

#[tauri::command]
pub async fn open_external(url: String) -> Result<(), String> {
    let target = parse_open_external_target(&url)?;
    open_external_target(target)
}

// ============================================================================
// Updates (disabled)
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DesktopUpdateConfig {
    branch: String,
}

#[derive(Debug)]
struct GitResult {
    code: i32,
    stdout: String,
    stderr: String,
}

fn desktop_update_config_path() -> PathBuf {
    desktop_app_data_dir().join(DESKTOP_UPDATE_CONFIG_PATH)
}

fn default_connection_config() -> ConnectionConfig {
    ConnectionConfig {
        mode: "local".to_string(),
        remote: None,
    }
}

fn token_preview(value: &str) -> Option<String> {
    let raw = value.trim();
    if raw.is_empty() {
        return None;
    }

    if raw.len() <= 8 {
        Some("set".to_string())
    } else {
        Some(format!("...{}", &raw[raw.len() - 6..]))
    }
}

fn normalize_remote_base_url(raw_url: &str) -> Result<String, String> {
    let value = raw_url.trim();
    if value.is_empty() {
        return Err("Remote gateway URL is required.".to_string());
    }

    let mut parsed = reqwest::Url::parse(value)
        .map_err(|e| format!("Remote gateway URL is not valid: {}", e))?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!(
            "Remote gateway URL must be http:// or https://, got {}",
            parsed.scheme()
        ));
    }

    parsed.set_fragment(None);
    parsed.set_query(None);
    let next_path = parsed.path().trim_end_matches('/').to_string();
    if next_path.is_empty() {
        parsed.set_path("/");
    } else {
        parsed.set_path(&next_path);
    }

    Ok(parsed.to_string().trim_end_matches('/').to_string())
}

fn build_gateway_ws_url(base_url: &str, token: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(base_url)
        .map_err(|e| format!("Remote gateway URL is not valid: {}", e))?;
    let mut ws_url = parsed.clone();
    ws_url
        .set_scheme(if parsed.scheme() == "https" {
            "wss"
        } else {
            "ws"
        })
        .map_err(|_| "Could not derive gateway websocket URL".to_string())?;
    let prefix = parsed.path().trim_end_matches('/');
    let next_path = if prefix.is_empty() {
        "/api/ws".to_string()
    } else {
        format!("{}/api/ws", prefix)
    };
    ws_url.set_path(&next_path);
    ws_url.set_query(None);
    ws_url.set_fragment(None);
    ws_url.query_pairs_mut().append_pair("token", token);
    Ok(ws_url.to_string())
}

fn sanitize_connection_config(config: &ConnectionConfig) -> DesktopConnectionConfigState {
    let remote_token = config
        .remote
        .as_ref()
        .and_then(|remote| remote.token.as_ref())
        .map(|token| token.value.trim().to_string())
        .unwrap_or_default();

    DesktopConnectionConfigState {
        env_override: std::env::var("HERMES_DESKTOP_REMOTE_URL")
            .ok()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
        mode: if config.mode == "remote" {
            "remote".to_string()
        } else {
            "local".to_string()
        },
        remote_token_preview: token_preview(&remote_token),
        remote_token_set: !remote_token.is_empty(),
        remote_url: config
            .remote
            .as_ref()
            .and_then(|remote| remote.url.as_ref())
            .map(|value| value.trim().to_string())
            .unwrap_or_default(),
    }
}

fn read_connection_config_from_disk() -> ConnectionConfig {
    match fs::read_to_string(get_connection_config_path()) {
        Ok(content) => serde_json::from_str::<ConnectionConfig>(&content)
            .ok()
            .map(|mut config| {
                if config.mode != "remote" {
                    config.mode = "local".to_string();
                }
                config
            })
            .unwrap_or_else(default_connection_config),
        Err(_) => default_connection_config(),
    }
}

fn write_connection_config_to_disk(config: &ConnectionConfig) -> Result<(), String> {
    let config_path = get_connection_config_path();
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content).map_err(|e| format!("Failed to write config: {}", e))
}

fn coerce_connection_config(
    input: ConnectionConfig,
    existing: &ConnectionConfig,
) -> Result<ConnectionConfig, String> {
    let mode = if input.mode == "remote" {
        "remote"
    } else {
        "local"
    }
    .to_string();
    let existing_remote = existing.remote.as_ref();
    let input_remote = input.remote.as_ref();

    let incoming_token = input_remote
        .and_then(|remote| remote.token.as_ref())
        .map(|token| token.value.trim().to_string())
        .unwrap_or_default();
    let next_token = if incoming_token.is_empty() {
        existing_remote.and_then(|remote| remote.token.clone())
    } else {
        Some(TokenValue {
            value: incoming_token,
            encoding: Some("plain".to_string()),
        })
    };

    let raw_url = input_remote
        .and_then(|remote| remote.url.as_deref())
        .or_else(|| existing_remote.and_then(|remote| remote.url.as_deref()))
        .unwrap_or("")
        .trim()
        .to_string();

    let url = if mode == "remote" {
        Some(normalize_remote_base_url(&raw_url)?)
    } else if raw_url.is_empty() {
        None
    } else {
        Some(normalize_remote_base_url(&raw_url)?)
    };

    let remote = RemoteConfig {
        url,
        token: next_token,
    };

    if mode == "remote"
        && remote
            .token
            .as_ref()
            .map(|token| token.value.trim().is_empty())
            .unwrap_or(true)
    {
        return Err("Remote gateway session token is required.".to_string());
    }

    Ok(ConnectionConfig {
        mode,
        remote: Some(remote),
    })
}

fn read_desktop_update_config() -> DesktopUpdateConfig {
    match fs::read_to_string(desktop_update_config_path()) {
        Ok(content) => {
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&content);
            let branch = parsed
                .ok()
                .and_then(|value| {
                    value
                        .get("branch")
                        .and_then(|value| value.as_str())
                        .map(|value| value.trim().to_string())
                })
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| DEFAULT_UPDATE_BRANCH.to_string());
            DesktopUpdateConfig { branch }
        }
        Err(_) => DesktopUpdateConfig {
            branch: DEFAULT_UPDATE_BRANCH.to_string(),
        },
    }
}

fn write_desktop_update_config(config: &DesktopUpdateConfig) -> Result<(), String> {
    let path = desktop_update_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))
}

fn resolve_hermes_home() -> PathBuf {
    if let Ok(home) = std::env::var("HERMES_HOME") {
        let trimmed = home.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    #[cfg(windows)]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local_app_data).join("hermes");
            let legacy = dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".hermes");
            if !local.exists() && legacy.exists() {
                return legacy;
            }
            return local;
        }
    }

    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".hermes")
}

fn desktop_log_path() -> PathBuf {
    resolve_hermes_home().join("logs").join("desktop.log")
}

fn reveal_path_command(path: &Path) -> Option<(String, Vec<String>)> {
    #[cfg(target_os = "macos")]
    {
        return Some((
            "open".to_string(),
            vec!["-R".to_string(), path.to_string_lossy().to_string()],
        ));
    }

    #[cfg(target_os = "windows")]
    {
        return Some((
            "explorer".to_string(),
            vec![format!("/select,{}", path.display())],
        ));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = path;
        None
    }
}

fn reveal_path_in_file_manager(path: &Path) -> Result<bool, String> {
    let Some((program, args)) = reveal_path_command(path) else {
        return Ok(false);
    };

    let status = StdCommand::new(&program)
        .args(&args)
        .status()
        .map_err(|e| format!("Failed to reveal log file: {}", e))?;

    Ok(status.success())
}

fn active_hermes_root() -> PathBuf {
    resolve_hermes_home().join("hermes-agent")
}

fn bootstrap_complete_marker_path() -> PathBuf {
    active_hermes_root().join(".hermes-bootstrap-complete")
}

fn find_on_path(command: &str) -> Option<String> {
    let candidate = command.trim();
    if candidate.is_empty() {
        return None;
    }

    let path_value = std::env::var_os("PATH")?;
    let extensions: Vec<String> = if cfg!(windows) {
        std::env::var("PATHEXT")
            .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string())
            .split(';')
            .filter(|value| !value.is_empty())
            .map(|value| value.to_string())
            .chain(std::iter::once(String::new()))
            .collect()
    } else {
        vec![String::new()]
    };

    for entry in std::env::split_paths(&path_value) {
        for ext in &extensions {
            let path = if ext.is_empty() {
                entry.join(candidate)
            } else {
                entry.join(format!("{}{}", candidate, ext))
            };
            if path.is_file() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }

    None
}

fn spawn_process_logger<R>(stream: R, prefix: Option<&'static str>)
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let reader = std::io::BufReader::new(stream);
        for line in reader.lines().flatten() {
            if line.trim().is_empty() {
                continue;
            }

            match prefix {
                Some(tag) => append_desktop_log(&format!("{}: {}\n", tag, line)),
                None => append_desktop_log(&format!("{}\n", line)),
            }
        }
    });
}

async fn wait_for_hermes(base_url: &str, token: &str, timeout_secs: u64) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);

    while std::time::Instant::now() < deadline {
        if let Ok(response) = client
            .get(format!("{}/api/status", base_url))
            .header("X-Hermes-Session-Token", token)
            .send()
            .await
        {
            if response.status().is_success() {
                return Ok(());
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    }

    Err(format!(
        "Hermes gateway did not become ready at {}",
        base_url
    ))
}

fn resolve_update_root() -> PathBuf {
    if let Ok(override_root) = std::env::var("HERMES_DESKTOP_HERMES_ROOT") {
        let root = PathBuf::from(override_root);
        if root.exists() {
            return root;
        }
    }

    if let Some(root) = probe_hermes_cli_info().and_then(|info| info.project_root) {
        if root.exists() {
            return root;
        }
    }

    if let Ok(current_dir) = std::env::current_dir() {
        for ancestor in current_dir.ancestors() {
            if ancestor.join(".git").is_dir() {
                return ancestor.to_path_buf();
            }
        }
        return current_dir;
    }

    PathBuf::from(".")
}

fn parse_hermes_cli_info(output: &str) -> Option<HermesCliInfo> {
    let mut version = None;
    let mut project_root = None;

    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("Hermes Agent v") {
            let candidate = rest.split_whitespace().next().unwrap_or("").trim();
            if !candidate.is_empty() {
                version = Some(candidate.to_string());
            }
        } else if let Some(rest) = trimmed.strip_prefix("Project:") {
            let candidate = rest.trim();
            if !candidate.is_empty() {
                project_root = Some(PathBuf::from(candidate));
            }
        }
    }

    if version.is_none() && project_root.is_none() {
        return None;
    }

    Some(HermesCliInfo {
        version: version.unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),
        project_root,
    })
}

fn probe_hermes_cli_info() -> Option<HermesCliInfo> {
    let output = StdCommand::new("hermes")
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Some(info) = parse_hermes_cli_info(&stdout) {
        return Some(info);
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    parse_hermes_cli_info(&stderr)
}

fn read_hermes_version_from_root(root: &PathBuf) -> Option<String> {
    let init_path = root.join("hermes_cli").join("__init__.py");
    let raw = fs::read_to_string(init_path).ok()?;
    let pattern = regex::Regex::new(r#"__version__\s*=\s*["']([^"']+)["']"#).ok()?;
    pattern
        .captures(&raw)
        .and_then(|caps| caps.get(1))
        .map(|value| value.as_str().to_string())
}

fn resolve_hermes_version() -> String {
    if let Some(version) = read_hermes_version_from_root(&resolve_update_root()) {
        return version;
    }

    if let Some(info) = probe_hermes_cli_info() {
        return info.version;
    }

    env!("CARGO_PKG_VERSION").to_string()
}

fn default_window_state_payload() -> WindowStatePayload {
    WindowStatePayload {
        is_fullscreen: false,
        native_overlay_width: if cfg!(target_os = "macos") {
            0
        } else {
            NATIVE_OVERLAY_BUTTON_WIDTH
        },
        window_button_position: if cfg!(target_os = "macos") {
            Some(MACOS_WINDOW_BUTTON_POSITION)
        } else {
            None
        },
    }
}

fn current_window_state_payload(
    app: Option<&AppHandle>,
    override_fullscreen: Option<bool>,
) -> WindowStatePayload {
    let mut payload = default_window_state_payload();

    if let Some(app) = app {
        payload.is_fullscreen = app
            .get_webview_window("main")
            .and_then(|window| window.is_fullscreen().ok())
            .unwrap_or(false);
    }

    if let Some(value) = override_fullscreen {
        payload.is_fullscreen = value;
        payload.window_button_position = if cfg!(target_os = "macos") && !value {
            Some(MACOS_WINDOW_BUTTON_POSITION)
        } else {
            None
        };
    }

    payload
}

fn recent_desktop_log_lines(limit: usize) -> Vec<String> {
    let log_path = desktop_log_path();
    let Ok(content) = fs::read_to_string(log_path) else {
        return Vec::new();
    };

    let lines: Vec<String> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect();
    let start = lines.len().saturating_sub(limit);
    lines.into_iter().skip(start).collect()
}

fn new_gateway_connection(
    base_url: String,
    token: String,
    ws_url: String,
    mode: impl Into<String>,
) -> GatewayConnection {
    let window_state = default_window_state_payload();
    GatewayConnection {
        base_url,
        token,
        ws_url,
        mode: mode.into(),
        source: None,
        logs: Vec::new(),
        is_fullscreen: window_state.is_fullscreen,
        native_overlay_width: window_state.native_overlay_width,
        window_button_position: window_state.window_button_position,
    }
}

fn decorate_gateway_connection(
    mut conn: GatewayConnection,
    app: &AppHandle,
    source: Option<&str>,
) -> GatewayConnection {
    let window_state = current_window_state_payload(Some(app), None);
    conn.source = source.map(|value| value.to_string());
    conn.logs = recent_desktop_log_lines(80);
    conn.is_fullscreen = window_state.is_fullscreen;
    conn.native_overlay_width = window_state.native_overlay_width;
    conn.window_button_position = window_state.window_button_position;
    conn
}

fn resolve_remote_backend_from_env() -> Result<Option<GatewayConnection>, String> {
    let raw_url = std::env::var("HERMES_DESKTOP_REMOTE_URL").unwrap_or_default();
    if raw_url.trim().is_empty() {
        return Ok(None);
    }

    let raw_token = std::env::var("HERMES_DESKTOP_REMOTE_TOKEN").unwrap_or_default();
    if raw_token.trim().is_empty() {
        return Err(
            "HERMES_DESKTOP_REMOTE_URL is set but HERMES_DESKTOP_REMOTE_TOKEN is not.".to_string(),
        );
    }

    let base_url = normalize_remote_base_url(&raw_url)?;
    let token = raw_token.trim().to_string();
    let ws_url = build_gateway_ws_url(&base_url, &token)?;

    Ok(Some(new_gateway_connection(
        base_url, token, ws_url, "remote",
    )))
}

fn resolve_remote_backend_from_config(
    config: &ConnectionConfig,
) -> Result<Option<GatewayConnection>, String> {
    if config.mode != "remote" {
        return Ok(None);
    }

    let remote = config
        .remote
        .as_ref()
        .ok_or_else(|| "Invalid remote gateway configuration".to_string())?;
    let base_url = normalize_remote_base_url(remote.url.as_deref().unwrap_or_default())?;
    let token = remote
        .token
        .as_ref()
        .map(|value| value.value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Remote gateway session token is required.".to_string())?;
    let ws_url = build_gateway_ws_url(&base_url, &token)?;

    Ok(Some(new_gateway_connection(
        base_url, token, ws_url, "remote",
    )))
}

fn run_git(args: &[&str], cwd: &PathBuf) -> Result<GitResult, String> {
    let output = StdCommand::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    Ok(GitResult {
        code: output.status.code().unwrap_or(1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn first_line(text: &str) -> String {
    text.lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn emit_update_progress(app: &AppHandle, payload: serde_json::Value) {
    let _ = app.emit_to("main", UPDATE_PROGRESS_EVENT, payload);
}

fn resolve_healed_branch(update_root: &PathBuf, branch: &str) -> Result<String, String> {
    let next_branch = branch.trim();
    if next_branch.is_empty() || next_branch == DEFAULT_UPDATE_BRANCH {
        return Ok(DEFAULT_UPDATE_BRANCH.to_string());
    }

    let probe = run_git(
        &["ls-remote", "--exit-code", "--heads", "origin", next_branch],
        update_root,
    )?;
    if probe.code != 2 {
        return Ok(next_branch.to_string());
    }

    let config = read_desktop_update_config();
    if config.branch != DEFAULT_UPDATE_BRANCH {
        let _ = write_desktop_update_config(&DesktopUpdateConfig {
            branch: DEFAULT_UPDATE_BRANCH.to_string(),
        });
    }

    Ok(DEFAULT_UPDATE_BRANCH.to_string())
}

fn read_commit_log(update_root: &PathBuf, branch: &str) -> Result<Vec<serde_json::Value>, String> {
    let sep = "\x1f";
    let rec = "\x1e";
    let format = format!("%H{}%s{}%an{}%at{}", sep, sep, sep, rec);
    let output = run_git(
        &[
            "log",
            &format!("HEAD..origin/{}", branch),
            &format!("--pretty=format:{}", format),
            "-n",
            "40",
        ],
        update_root,
    )?;

    if output.code != 0 {
        return Err(first_line(&output.stderr));
    }

    Ok(output
        .stdout
        .split(rec)
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }

            let mut parts = trimmed.split(sep);
            let sha = parts.next()?.to_string();
            let summary = parts.next()?.to_string();
            let author = parts.next()?.to_string();
            let at = parts
                .next()
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(0)
                * 1000;

            Some(serde_json::json!({
                "sha": sha,
                "summary": summary,
                "author": author,
                "at": at
            }))
        })
        .collect())
}

fn resolve_updater_binary() -> Option<PathBuf> {
    let home = resolve_hermes_home();
    let name = if cfg!(windows) {
        "hermes-setup.exe"
    } else {
        "hermes-setup"
    };
    let candidate = home.join(name);
    if candidate.exists() {
        Some(candidate)
    } else {
        None
    }
}

fn resolve_hermes_cli_binary(update_root: &PathBuf) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let candidate = update_root.join("venv").join("Scripts").join("hermes.exe");
        if candidate.exists() {
            return Some(candidate);
        }

        let candidate = update_root.join(".venv").join("Scripts").join("hermes.exe");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    let candidate = update_root.join("venv").join("bin").join("hermes");
    if candidate.exists() {
        return Some(candidate);
    }

    let candidate = update_root.join(".venv").join("bin").join("hermes");
    if candidate.exists() {
        return Some(candidate);
    }

    if let Some(path_candidate) = find_on_path("hermes").map(PathBuf::from) {
        return Some(path_candidate);
    }

    if let Some(home_dir) = dirs::home_dir() {
        let candidate = home_dir.join(".local").join("bin").join("hermes");
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn resolve_current_update_branch(update_root: &PathBuf) -> Option<String> {
    let head = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], update_root).ok()?;
    if head.code != 0 {
        return None;
    }

    let current = head.stdout.trim();
    if current.is_empty() || current == "HEAD" {
        return None;
    }

    resolve_healed_branch(update_root, current).ok()
}

#[allow(dead_code)]
fn manual_update_command(update_root: &PathBuf) -> String {
    match resolve_current_update_branch(update_root).as_deref() {
        Some(branch) if branch != DEFAULT_UPDATE_BRANCH => {
            format!("hermes update --branch {}", branch)
        }
        _ => "hermes update".to_string(),
    }
}

fn update_command_env(update_root: &PathBuf) -> Vec<(String, String)> {
    let mut path_entries = Vec::new();

    #[cfg(not(windows))]
    {
        path_entries.push(resolve_hermes_home().join("node").join("bin"));
        path_entries.push(update_root.join("venv").join("bin"));
    }

    #[cfg(windows)]
    {
        path_entries.push(resolve_hermes_home().join("node"));
        path_entries.push(update_root.join("venv").join("Scripts"));
    }

    let mut paths: Vec<PathBuf> = path_entries
        .into_iter()
        .filter(|value| !value.as_os_str().is_empty())
        .collect();
    if let Some(path_value) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&path_value));
    }

    let joined_path = std::env::join_paths(paths)
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    vec![
        (
            "HERMES_HOME".to_string(),
            resolve_hermes_home().to_string_lossy().to_string(),
        ),
        ("PATH".to_string(), joined_path),
    ]
}

fn running_app_bundle() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let exe = std::env::current_exe().ok()?;
        let bundle = exe.parent()?.parent()?.parent()?;
        if bundle.extension().and_then(|value| value.to_str()) == Some("app") {
            return Some(bundle.to_path_buf());
        }
    }

    None
}

fn rebuilt_desktop_app(update_root: &PathBuf) -> Option<PathBuf> {
    [
        update_root
            .join("apps")
            .join("desktop")
            .join("release")
            .join("mac-arm64")
            .join("Hermes.app"),
        update_root
            .join("apps")
            .join("desktop")
            .join("release")
            .join("mac")
            .join("Hermes.app"),
    ]
    .into_iter()
    .find(|path| path.is_dir())
}

fn schedule_app_exit(app: &AppHandle) {
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(600));
        app.exit(0);
    });
}

fn applications_bundle_target(bundle: &Path) -> PathBuf {
    let bundle_name = bundle
        .file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("Hermes.app"));
    PathBuf::from("/Applications").join(bundle_name)
}

fn dock_tile_file_url(bundle: &Path) -> String {
    let mut url = reqwest::Url::from_file_path(bundle)
        .map(|value| value.to_string())
        .unwrap_or_else(|_| "file:///Applications/Hermes.app/".to_string());
    if !url.ends_with('/') {
        url.push('/');
    }
    url
}

fn is_system_applications_bundle(bundle: &Path) -> bool {
    bundle.starts_with("/Applications/")
}

#[cfg(target_os = "macos")]
fn write_dock_pin_marker(marker: &Path, bundle: &Path, already_present: bool) {
    if let Some(parent) = marker.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let payload = serde_json::json!({
        "bundle": bundle.to_string_lossy().to_string(),
        "pinnedAt": chrono::Utc::now().to_rfc3339(),
        "alreadyPresent": already_present,
    });
    let _ = fs::write(
        marker,
        format!(
            "{}\n",
            serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string())
        ),
    );
}

#[cfg(target_os = "macos")]
fn maybe_relocate_to_applications(app: &AppHandle) -> bool {
    if cfg!(debug_assertions)
        || std::env::var("HERMES_DESKTOP_NO_AUTO_MOVE").ok().as_deref() == Some("1")
    {
        return false;
    }

    let Some(bundle) = running_app_bundle() else {
        return false;
    };
    if is_system_applications_bundle(&bundle) {
        return false;
    }

    let target = applications_bundle_target(&bundle);
    let copy_result = (|| -> Result<(), String> {
        if target.exists() {
            fs::remove_dir_all(&target)
                .map_err(|e| format!("Failed to remove stale /Applications copy: {}", e))?;
        }

        let status = StdCommand::new("ditto")
            .arg(&bundle)
            .arg(&target)
            .status()
            .map_err(|e| format!("Failed to copy app bundle into /Applications: {}", e))?;
        if !status.success() {
            return Err(format!(
                "Copy into /Applications failed with status {}",
                status.code().unwrap_or(1)
            ));
        }

        Ok(())
    })();

    if copy_result.is_err() && !target.exists() {
        return false;
    }

    let launched = StdCommand::new("open").arg(&target).spawn().is_ok();
    if launched {
        schedule_app_exit(app);
    }
    launched
}

#[cfg(not(target_os = "macos"))]
fn maybe_relocate_to_applications(_app: &AppHandle) -> bool {
    false
}

#[cfg(target_os = "macos")]
fn maybe_pin_to_dock(app: &AppHandle) {
    if cfg!(debug_assertions)
        || std::env::var("HERMES_DESKTOP_NO_DOCK_PIN").ok().as_deref() == Some("1")
    {
        return;
    }

    let Some(bundle) = running_app_bundle() else {
        return;
    };
    if !is_system_applications_bundle(&bundle) {
        return;
    }

    let marker = match app.path().app_data_dir() {
        Ok(dir) => dir.join(DOCK_PINNED_MARKER),
        Err(_) => return,
    };
    if marker.exists() {
        return;
    }

    let url = dock_tile_file_url(&bundle);
    if let Ok(output) = StdCommand::new("defaults")
        .args(["read", "com.apple.dock", "persistent-apps"])
        .output()
    {
        if String::from_utf8_lossy(&output.stdout).contains(&url) {
            write_dock_pin_marker(&marker, &bundle, true);
            return;
        }
    }

    let tile = format!(
        "<dict><key>tile-data</key><dict><key>file-data</key><dict>\
         <key>_CFURLString</key><string>{}</string>\
         <key>_CFURLStringType</key><integer>15</integer>\
         </dict></dict></dict>",
        url
    );

    let wrote_tile = StdCommand::new("defaults")
        .args([
            "write",
            "com.apple.dock",
            "persistent-apps",
            "-array-add",
            &tile,
        ])
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    if !wrote_tile {
        return;
    }

    let _ = StdCommand::new("defaults")
        .args(["read", "com.apple.dock", "persistent-apps"])
        .status();
    let _ = StdCommand::new("killall").arg("Dock").status();
    write_dock_pin_marker(&marker, &bundle, false);
}

#[cfg(not(target_os = "macos"))]
fn maybe_pin_to_dock(_app: &AppHandle) {}

pub fn maybe_handle_macos_first_launch(app: &AppHandle) -> bool {
    if maybe_relocate_to_applications(app) {
        return true;
    }

    maybe_pin_to_dock(app);
    false
}

fn posix_update_restart_fallback_payload(rebuilt_app: Option<&Path>) -> serde_json::Value {
    serde_json::json!({
        "ok": true,
        "backendUpdated": true,
        "rebuiltApp": rebuilt_app.map(|path| path.to_string_lossy().to_string())
    })
}

fn emit_posix_update_restart_fallback(app: &AppHandle) {
    emit_update_progress(
        app,
        serde_json::json!({
            "stage": "done",
            "message": "Backend + app updated. Restart Hermes to load the new version.",
            "percent": 100,
            "error": serde_json::Value::Null,
            "at": chrono::Utc::now().timestamp_millis()
        }),
    );
}

#[allow(dead_code)]
fn run_streamed_update(
    command: &PathBuf,
    args: &[&str],
    cwd: &PathBuf,
    stage: &'static str,
    app: &AppHandle,
    extra_env: &[(String, String)],
) -> Result<i32, String> {
    let mut command_builder = StdCommand::new(command);
    command_builder
        .args(args)
        .current_dir(cwd)
        .envs(std::env::vars())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    for (key, value) in extra_env {
        command_builder.env(key, value);
    }

    let mut child = command_builder
        .spawn()
        .map_err(|e| format!("Failed to spawn updater: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    let app_stdout = app.clone();
    let stage_stdout = stage;
    thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                emit_update_progress(
                    &app_stdout,
                    serde_json::json!({
                        "stage": stage_stdout,
                        "message": trimmed,
                        "percent": serde_json::Value::Null,
                        "error": serde_json::Value::Null,
                        "at": chrono::Utc::now().timestamp_millis()
                    }),
                );
            }
        }
    });

    let app_stderr = app.clone();
    let stage_stderr = stage;
    thread::spawn(move || {
        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                emit_update_progress(
                    &app_stderr,
                    serde_json::json!({
                        "stage": stage_stderr,
                        "message": trimmed,
                        "percent": serde_json::Value::Null,
                        "error": serde_json::Value::Null,
                        "at": chrono::Utc::now().timestamp_millis()
                    }),
                );
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for updater: {}", e))?;
    Ok(status.code().unwrap_or(1))
}

fn apply_updates_posix_in_app(
    app: &AppHandle,
    update_root: &PathBuf,
) -> Result<serde_json::Value, String> {
    let Some(hermes) = resolve_hermes_cli_binary(update_root) else {
        emit_update_progress(
            app,
            serde_json::json!({
                "stage": "manual",
                "message": "hermes update",
                "percent": serde_json::Value::Null,
                "error": serde_json::Value::Null,
                "at": chrono::Utc::now().timestamp_millis()
            }),
        );

        return Ok(serde_json::json!({
            "ok": true,
            "manual": true,
            "command": "hermes update",
            "hermesRoot": update_root.to_string_lossy().to_string()
        }));
    };

    let env = update_command_env(update_root);
    let branch = resolve_current_update_branch(update_root);
    let mut update_args = vec!["update", "--yes"];
    if let Some(branch) = branch.as_deref() {
        if branch != DEFAULT_UPDATE_BRANCH {
            update_args.push("--branch");
            update_args.push(branch);
        }
    }

    emit_update_progress(
        app,
        serde_json::json!({
            "stage": "update",
            "message": "Updating Hermes (git + dependencies)…",
            "percent": 10,
            "error": serde_json::Value::Null,
            "at": chrono::Utc::now().timestamp_millis()
        }),
    );
    let updated = run_streamed_update(&hermes, &update_args, update_root, "update", app, &env)?;
    if updated != 0 {
        emit_update_progress(
            app,
            serde_json::json!({
                "stage": "error",
                "message": "hermes update failed.",
                "percent": serde_json::Value::Null,
                "error": "update-failed",
                "at": chrono::Utc::now().timestamp_millis()
            }),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "error": "hermes update failed"
        }));
    }

    emit_update_progress(
        app,
        serde_json::json!({
            "stage": "rebuild",
            "message": "Rebuilding the desktop app…",
            "percent": 60,
            "error": serde_json::Value::Null,
            "at": chrono::Utc::now().timestamp_millis()
        }),
    );
    let rebuilt = run_streamed_update(
        &hermes,
        &["desktop", "--build-only"],
        update_root,
        "rebuild",
        app,
        &env,
    )?;
    if rebuilt != 0 {
        emit_update_progress(
            app,
            serde_json::json!({
                "stage": "error",
                "message": "Backend updated, but the desktop rebuild failed. Restart Hermes to retry.",
                "percent": serde_json::Value::Null,
                "error": "rebuild-failed",
                "at": chrono::Utc::now().timestamp_millis()
            }),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "backendUpdated": true,
            "error": "desktop rebuild failed"
        }));
    }

    let rebuilt_app = rebuilt_desktop_app(update_root);
    let target_app = running_app_bundle();

    if rebuilt_app.is_none() || target_app.is_none() {
        emit_update_progress(
            app,
            serde_json::json!({
                "stage": "done",
                "message": "Backend updated. Restart Hermes to load the new version.",
                "percent": 100,
                "error": serde_json::Value::Null,
                "at": chrono::Utc::now().timestamp_millis()
            }),
        );

        return Ok(serde_json::json!({
            "ok": true,
            "backendUpdated": true,
            "rebuiltApp": rebuilt_app.map(|path| path.to_string_lossy().to_string())
        }));
    }

    let rebuilt_app = rebuilt_app.expect("checked above");
    let target_app = target_app.expect("checked above");

    emit_update_progress(
        app,
        serde_json::json!({
            "stage": "restart",
            "message": "Installing the updated app and restarting…",
            "percent": 95,
            "error": serde_json::Value::Null,
            "at": chrono::Utc::now().timestamp_millis()
        }),
    );

    let script_path = std::env::temp_dir().join(format!(
        "hermes-desktop-update-{}-{}.sh",
        std::process::id(),
        chrono::Utc::now().timestamp_millis()
    ));
    let script = r#"#!/bin/bash
set -u
APP_PID="$1"
SRC="$2"
DST="$3"
for _ in $(seq 1 240); do
  kill -0 "$APP_PID" 2>/dev/null || break
  sleep 0.5
done
if [ "$SRC" != "$DST" ]; then
  if /usr/bin/ditto "$SRC" "$DST.hermes-update-new"; then
    rm -rf "$DST.hermes-update-old" 2>/dev/null || true
    mv "$DST" "$DST.hermes-update-old" 2>/dev/null || rm -rf "$DST"
    mv "$DST.hermes-update-new" "$DST"
    rm -rf "$DST.hermes-update-old" 2>/dev/null || true
  fi
fi
/usr/bin/xattr -dr com.apple.quarantine "$DST" 2>/dev/null || true
/usr/bin/open "$DST"
"#;
    if let Err(error) = fs::write(&script_path, script) {
        emit_posix_update_restart_fallback(app);
        log::warn!(
            "Could not write app swap script ({}); rebuilt app remains at {}",
            error,
            rebuilt_app.to_string_lossy()
        );
        return Ok(posix_update_restart_fallback_payload(Some(
            rebuilt_app.as_path(),
        )));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = match fs::metadata(&script_path) {
            Ok(metadata) => metadata.permissions(),
            Err(error) => {
                emit_posix_update_restart_fallback(app);
                log::warn!(
                    "Could not inspect app swap script permissions ({}); rebuilt app remains at {}",
                    error,
                    rebuilt_app.to_string_lossy()
                );
                return Ok(posix_update_restart_fallback_payload(Some(
                    rebuilt_app.as_path(),
                )));
            }
        };
        permissions.set_mode(0o755);
        if let Err(error) = fs::set_permissions(&script_path, permissions) {
            emit_posix_update_restart_fallback(app);
            log::warn!(
                "Could not chmod app swap script ({}); rebuilt app remains at {}",
                error,
                rebuilt_app.to_string_lossy()
            );
            return Ok(posix_update_restart_fallback_payload(Some(
                rebuilt_app.as_path(),
            )));
        }
    }

    let child = match StdCommand::new("/bin/bash")
        .arg(&script_path)
        .arg(std::process::id().to_string())
        .arg(rebuilt_app.to_string_lossy().to_string())
        .arg(target_app.to_string_lossy().to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            emit_posix_update_restart_fallback(app);
            log::warn!(
                "Could not launch app swapper ({}); rebuilt app remains at {}",
                error,
                rebuilt_app.to_string_lossy()
            );
            return Ok(posix_update_restart_fallback_payload(Some(
                rebuilt_app.as_path(),
            )));
        }
    };

    drop(child);
    schedule_app_exit(app);

    Ok(serde_json::json!({
        "ok": true,
        "handedOff": true,
        "rebuiltApp": rebuilt_app.to_string_lossy().to_string(),
        "targetApp": target_app.to_string_lossy().to_string()
    }))
}

pub fn emit_window_state_changed(app: &AppHandle, override_fullscreen: Option<bool>) {
    let payload = current_window_state_payload(Some(app), override_fullscreen);
    let _ = app.emit_to("main", WINDOW_STATE_EVENT, payload);
}

pub fn emit_open_updates_requested(app: &AppHandle) {
    let _ = app.emit_to("main", OPEN_UPDATES_EVENT, serde_json::Value::Null);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn emit_close_preview_requested(app: &AppHandle) {
    let _ = app.emit_to("main", CLOSE_PREVIEW_EVENT, serde_json::Value::Null);
}

fn set_context_menu_request(state: &AppState, request: ContextMenuRequest) {
    if let Ok(mut stored) = state.context_menu_request.lock() {
        *stored = Some(request);
    }
}

fn current_context_menu_request(state: &AppState) -> Option<ContextMenuRequest> {
    state
        .context_menu_request
        .lock()
        .ok()
        .and_then(|request| request.clone())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ContextTextActionMode {
    Editable,
    NonEditableSelection,
    FallbackSelectAll,
    None,
}

fn can_open_context_image_url(url: Option<&str>) -> bool {
    parse_context_open_target(url, true).is_some()
}

fn parse_context_open_target(
    raw_url: Option<&str>,
    block_data_urls: bool,
) -> Option<OpenExternalTarget> {
    let raw = raw_url?.trim();
    if raw.is_empty() {
        return None;
    }
    if block_data_urls && raw.starts_with("data:") {
        return None;
    }

    parse_open_external_target(raw).ok()
}

fn context_text_action_mode(
    request: &ContextMenuRequest,
    has_items_before_text_actions: bool,
) -> ContextTextActionMode {
    let has_selection = !request.selection_text.trim().is_empty();
    if request.is_editable {
        return ContextTextActionMode::Editable;
    }
    if has_selection {
        return ContextTextActionMode::NonEditableSelection;
    }
    if !has_items_before_text_actions {
        return ContextTextActionMode::FallbackSelectAll;
    }
    ContextTextActionMode::None
}

fn is_hex_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}

fn parse_hex_rgb(value: &str) -> Option<(u8, u8, u8)> {
    if !is_hex_color(value) {
        return None;
    }

    let red = u8::from_str_radix(&value[1..3], 16).ok()?;
    let green = u8::from_str_radix(&value[3..5], 16).ok()?;
    let blue = u8::from_str_radix(&value[5..7], 16).ok()?;
    Some((red, green, blue))
}

fn parse_titlebar_theme_payload(payload: &serde_json::Value) -> Option<TitlebarThemePayload> {
    let background = payload.get("background")?.as_str()?.trim();
    let foreground = payload.get("foreground")?.as_str()?.trim();

    if !is_hex_color(background) || !is_hex_color(foreground) {
        return None;
    }

    Some(TitlebarThemePayload {
        background: background.to_string(),
        foreground: foreground.to_string(),
    })
}

fn color_luminance((red, green, blue): (u8, u8, u8)) -> f32 {
    (0.299 * red as f32 + 0.587 * green as f32 + 0.114 * blue as f32) / 255.0
}

fn titlebar_window_theme(payload: &TitlebarThemePayload) -> tauri::Theme {
    let foreground = parse_hex_rgb(&payload.foreground).unwrap_or((36, 36, 36));
    if color_luminance(foreground) >= 0.6 {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    }
}

fn titlebar_background_color(payload: &TitlebarThemePayload) -> Option<tauri::window::Color> {
    let (red, green, blue) = parse_hex_rgb(&payload.background)?;
    Some(tauri::window::Color(red, green, blue, 255))
}

fn main_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window("main")
}

fn reload_main_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.reload();
    }
}

fn force_reload_main_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.eval("window.location.reload()");
    }
}

fn toggle_main_devtools(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
}

fn set_main_window_zoom(app: &AppHandle, state: &AppState, next_zoom: f64) {
    let next_zoom = next_zoom.clamp(0.2, 10.0);

    if let Some(window) = main_window(app) {
        let _ = window.set_zoom(next_zoom);
    }

    if let Ok(mut zoom) = state.window_zoom.lock() {
        *zoom = next_zoom;
    }
}

fn adjust_main_window_zoom(app: &AppHandle, state: &AppState, delta: f64) {
    let current = state.window_zoom.lock().map(|zoom| *zoom).unwrap_or(1.0);
    set_main_window_zoom(app, state, current + delta);
}

fn copy_text_to_clipboard(text: String) -> Result<(), String> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to access clipboard: {}", e))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to copy text: {}", e))
}

async fn copy_image_from_url(url: String) -> Result<(), String> {
    let (buffer, _) = resource_buffer_from_url(&url).await?;
    let decoded =
        image::load_from_memory(&buffer).map_err(|e| format!("Failed to decode image: {}", e))?;
    let rgba = decoded.to_rgba8();
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to access clipboard: {}", e))?;
    clipboard
        .set_image(arboard::ImageData {
            width: rgba.width() as usize,
            height: rgba.height() as usize,
            bytes: std::borrow::Cow::Owned(rgba.into_raw()),
        })
        .map_err(|e| format!("Failed to copy image: {}", e))
}

fn exec_document_command(app: &AppHandle, command: &str) {
    if let Some(window) = main_window(app) {
        let command = serde_json::to_string(command).unwrap_or_else(|_| "\"\"".to_string());
        let _ = window.eval(&format!("document.execCommand({command})"));
    }
}

fn select_all_in_main_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.eval(
            r#"
(() => {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    active.select();
    return;
  }
  if (active && typeof active.closest === 'function') {
    const editable = active.closest('[contenteditable="true"], [contenteditable="plaintext-only"]');
    if (editable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editable);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
  }
  document.execCommand('selectAll');
})();
"#,
        );
    }
}

fn paste_clipboard_into_main_window(app: &AppHandle) {
    let Ok(mut clipboard) = arboard::Clipboard::new() else {
        return;
    };
    let Ok(text) = clipboard.get_text() else {
        return;
    };
    let Ok(serialized) = serde_json::to_string(&text) else {
        return;
    };

    if let Some(window) = main_window(app) {
        let script = format!(
            r#"
(() => {{
  const text = {serialized};
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {{
    const start = active.selectionStart ?? active.value.length;
    const end = active.selectionEnd ?? active.value.length;
    active.setRangeText(text, start, end, 'end');
    active.dispatchEvent(new Event('input', {{ bubbles: true }}));
    active.dispatchEvent(new Event('change', {{ bubbles: true }}));
    return;
  }}
  if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {{
    document.execCommand('insertText', false, text);
    return;
  }}
  const editable = active && typeof active.closest === 'function'
    ? active.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')
    : null;
  if (editable) {{
    editable.focus();
    document.execCommand('insertText', false, text);
  }}
}})();
"#
        );
        let _ = window.eval(&script);
    }
}

fn context_menu_spellcheck_suggestions(request: &ContextMenuRequest) -> Vec<String> {
    if !request.is_editable {
        return Vec::new();
    }

    let misspelled_word = request
        .misspelled_word
        .as_deref()
        .map(str::trim)
        .unwrap_or_default();
    if misspelled_word.is_empty() {
        return Vec::new();
    }

    request
        .dictionary_suggestions
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .take(5)
        .map(ToString::to_string)
        .collect()
}

fn call_context_menu_controller(app: &AppHandle, method: &str, arg: &str) {
    let Some(window) = main_window(app) else {
        return;
    };
    let Ok(serialized_arg) = serde_json::to_string(arg) else {
        return;
    };

    let script = format!(
        r#"
(() => {{
  const controller = window.__HERMES_DESKTOP_CONTEXT_MENU__;
  if (!controller || typeof controller.{method} !== 'function') {{
    return;
  }}
  void controller.{method}({serialized_arg});
}})();
"#
    );
    let _ = window.eval(&script);
}

fn replace_misspelling_in_main_window(app: &AppHandle, suggestion: &str) {
    call_context_menu_controller(app, "replaceMisspelling", suggestion);
}

fn add_word_to_dictionary_in_main_window(app: &AppHandle, word: &str) {
    call_context_menu_controller(app, "addWordToDictionary", word);
}

#[tauri::command]
pub async fn show_context_menu(
    app: AppHandle,
    state: State<'_, AppState>,
    request: ContextMenuRequest,
) -> Result<(), String> {
    set_context_menu_request(&state, request.clone());

    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable".to_string())?;

    let mut has_items = false;

    let has_selection = !request.selection_text.trim().is_empty();
    let has_link = request
        .link_url
        .as_ref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let has_image = request
        .image_url
        .as_ref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let can_cut = request.edit_flags.can_cut || (request.is_editable && has_selection);
    let can_copy = request.edit_flags.can_copy || has_selection;
    let can_paste = request.edit_flags.can_paste || request.is_editable;
    let can_select_all = request.edit_flags.can_select_all || request.is_editable || has_selection;
    let can_open_link = parse_context_open_target(request.link_url.as_deref(), false).is_some();

    let menu = Menu::new(&app).map_err(|e| e.to_string())?;

    if has_image {
        let can_open_image = can_open_context_image_url(request.image_url.as_deref());
        let open_image = MenuItem::with_id(
            &app,
            "context-open-image",
            "Open Image",
            can_open_image,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        let copy_image =
            MenuItem::with_id(&app, "context-copy-image", "Copy Image", true, None::<&str>)
                .map_err(|e| e.to_string())?;
        let copy_image_address = MenuItem::with_id(
            &app,
            "context-copy-image-address",
            "Copy Image Address",
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        let save_image = MenuItem::with_id(
            &app,
            "context-save-image",
            "Save Image As...",
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        menu.append(&open_image).map_err(|e| e.to_string())?;
        menu.append(&copy_image).map_err(|e| e.to_string())?;
        menu.append(&copy_image_address)
            .map_err(|e| e.to_string())?;
        menu.append(&save_image).map_err(|e| e.to_string())?;
        has_items = true;
    }

    if has_link {
        if has_items {
            let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
            menu.append(&separator).map_err(|e| e.to_string())?;
        }
        let open_link = MenuItem::with_id(
            &app,
            "context-open-link",
            "Open Link",
            can_open_link,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        let copy_link =
            MenuItem::with_id(&app, "context-copy-link", "Copy Link", true, None::<&str>)
                .map_err(|e| e.to_string())?;
        menu.append(&open_link).map_err(|e| e.to_string())?;
        menu.append(&copy_link).map_err(|e| e.to_string())?;
        has_items = true;
    }

    let spelling_suggestions = context_menu_spellcheck_suggestions(&request);
    if !spelling_suggestions.is_empty() {
        if has_items {
            let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
            menu.append(&separator).map_err(|e| e.to_string())?;
        }

        for (index, suggestion) in spelling_suggestions.iter().enumerate() {
            let item = MenuItem::with_id(
                &app,
                format!("{}{}", CONTEXT_SPELLING_SUGGESTION_PREFIX, index),
                suggestion,
                true,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
            menu.append(&item).map_err(|e| e.to_string())?;
        }

        let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
        let add_to_dictionary = MenuItem::with_id(
            &app,
            "context-add-to-dictionary",
            "Add to dictionary",
            true,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        menu.append(&separator).map_err(|e| e.to_string())?;
        menu.append(&add_to_dictionary).map_err(|e| e.to_string())?;
        has_items = true;
    }

    let text_action_mode = context_text_action_mode(&request, has_items);

    match text_action_mode {
        ContextTextActionMode::Editable => {
            if has_items {
                let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
                menu.append(&separator).map_err(|e| e.to_string())?;
            }
            let cut = MenuItem::with_id(&app, "context-cut", "Cut", can_cut, None::<&str>)
                .map_err(|e| e.to_string())?;
            let copy = MenuItem::with_id(&app, "context-copy", "Copy", can_copy, None::<&str>)
                .map_err(|e| e.to_string())?;
            let paste = MenuItem::with_id(&app, "context-paste", "Paste", can_paste, None::<&str>)
                .map_err(|e| e.to_string())?;
            let select_all = MenuItem::with_id(
                &app,
                "context-select-all",
                "Select All",
                can_select_all,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
            let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
            menu.append(&cut).map_err(|e| e.to_string())?;
            menu.append(&copy).map_err(|e| e.to_string())?;
            menu.append(&paste).map_err(|e| e.to_string())?;
            menu.append(&separator).map_err(|e| e.to_string())?;
            menu.append(&select_all).map_err(|e| e.to_string())?;
        }
        ContextTextActionMode::NonEditableSelection => {
            if has_items {
                let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
                menu.append(&separator).map_err(|e| e.to_string())?;
            }
            let copy = MenuItem::with_id(&app, "context-copy", "Copy", can_copy, None::<&str>)
                .map_err(|e| e.to_string())?;
            menu.append(&copy).map_err(|e| e.to_string())?;
        }
        ContextTextActionMode::FallbackSelectAll => {
            let select_all = MenuItem::with_id(
                &app,
                "context-select-all",
                "Select All",
                can_select_all,
                None::<&str>,
            )
            .map_err(|e| e.to_string())?;
            menu.append(&select_all).map_err(|e| e.to_string())?;
        }
        ContextTextActionMode::None => {}
    }

    window.popup_menu(&menu).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn build_application_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

    let check_updates_app = MenuItem::with_id(
        app,
        "check-updates-app",
        "Check for Updates…",
        true,
        None::<&str>,
    )?;
    let check_updates_help = MenuItem::with_id(
        app,
        "check-updates-help",
        "Check for Updates…",
        true,
        None::<&str>,
    )?;
    let reload_item = MenuItem::with_id(app, "reload", "Reload", true, Some("CommandOrControl+R"))?;
    let force_reload_item = MenuItem::with_id(
        app,
        "force-reload",
        "Force Reload",
        true,
        Some("CommandOrControl+Shift+R"),
    )?;
    let toggle_devtools_item = MenuItem::with_id(
        app,
        "toggle-devtools",
        "Toggle Developer Tools",
        true,
        Some("F12"),
    )?;
    let actual_size_item = MenuItem::with_id(
        app,
        "actual-size",
        "Actual Size",
        true,
        Some("CommandOrControl+0"),
    )?;
    let zoom_in_item = MenuItem::with_id(
        app,
        "zoom-in",
        "Zoom In",
        true,
        Some("CommandOrControl+Plus"),
    )?;
    let zoom_out_item = MenuItem::with_id(
        app,
        "zoom-out",
        "Zoom Out",
        true,
        Some("CommandOrControl+-"),
    )?;
    let delete_item = MenuItem::with_id(app, "delete", "Delete", true, None::<&str>)?;
    let toggle_fullscreen_item = MenuItem::with_id(
        app,
        "toggle-fullscreen",
        "Toggle Full Screen",
        true,
        Some("F11"),
    )?;
    let close_item = PredefinedMenuItem::close_window(app, Some("Close"))?;
    let about_item = PredefinedMenuItem::about(
        app,
        None,
        Some(
            tauri::menu::AboutMetadataBuilder::new()
                .version(Some(env!("CARGO_PKG_VERSION")))
                .build(),
        ),
    )?;
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let separator3 = PredefinedMenuItem::separator(app)?;
    let separator4 = PredefinedMenuItem::separator(app)?;
    let separator5 = PredefinedMenuItem::separator(app)?;
    let separator6 = PredefinedMenuItem::separator(app)?;
    let services = PredefinedMenuItem::services(app, None)?;
    let hide = PredefinedMenuItem::hide(app, None)?;
    let hide_others = PredefinedMenuItem::hide_others(app, None)?;
    let show_all = PredefinedMenuItem::show_all(app, None)?;
    let quit = PredefinedMenuItem::quit(app, None)?;
    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let maximize = PredefinedMenuItem::maximize(app, Some("Zoom"))?;
    let front = PredefinedMenuItem::bring_all_to_front(app, Some("Front"))?;

    let app_menu = if cfg!(target_os = "macos") {
        Some(Submenu::with_items(
            app,
            "Hermes",
            true,
            &[
                &about_item,
                &check_updates_app,
                &separator1,
                &services,
                &separator2,
                &hide,
                &hide_others,
                &show_all,
                &separator3,
                &quit,
            ],
        )?)
    } else {
        None
    };

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &separator4,
            &cut,
            &copy,
            &paste,
            &delete_item,
            &select_all,
        ],
    )?;
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &reload_item,
            &force_reload_item,
            &toggle_devtools_item,
            &separator5,
            &actual_size_item,
            &zoom_in_item,
            &zoom_out_item,
            &separator6,
            &toggle_fullscreen_item,
        ],
    )?;
    let file_menu = if cfg!(target_os = "macos") {
        Submenu::with_items(app, "File", true, &[&close_item])?
    } else {
        Submenu::with_items(app, "File", true, &[&quit])?
    };
    let window_menu = if cfg!(target_os = "macos") {
        Submenu::with_items(app, "Window", true, &[&minimize, &maximize, &front])?
    } else {
        Submenu::with_items(app, "Window", true, &[&minimize, &close_item])?
    };
    let help_menu = Submenu::with_items(app, "Help", true, &[&check_updates_help])?;

    let menu = Menu::new(app)?;
    if let Some(app_menu) = app_menu {
        menu.append(&app_menu)?;
    }
    menu.append(&file_menu)?;
    menu.append(&edit_menu)?;
    menu.append(&view_menu)?;
    menu.append(&window_menu)?;
    menu.append(&help_menu)?;

    Ok(menu)
}

pub fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent, state: &AppState) {
    let id = event.id().as_ref();

    if id == "check-updates-app" || id == "check-updates-help" {
        emit_open_updates_requested(app);
        return;
    }

    if id == "reload" {
        reload_main_window(app);
        return;
    }

    if id == "force-reload" {
        force_reload_main_window(app);
        return;
    }

    if id == "toggle-devtools" {
        toggle_main_devtools(app);
        return;
    }

    if id == "actual-size" {
        set_main_window_zoom(app, state, 1.0);
        return;
    }

    if id == "zoom-in" {
        adjust_main_window_zoom(app, state, 0.1);
        return;
    }

    if id == "zoom-out" {
        adjust_main_window_zoom(app, state, -0.1);
        return;
    }

    if id == "toggle-fullscreen" {
        if let Some(window) = main_window(app) {
            if let Ok(is_fullscreen) = window.is_fullscreen() {
                let _ = window.set_fullscreen(!is_fullscreen);
            }
        }
        return;
    }

    if id == "delete" {
        exec_document_command(app, "delete");
        return;
    }

    if id == "context-open-image"
        || id == "context-copy-image"
        || id == "context-copy-image-address"
        || id == "context-save-image"
        || id == "context-open-link"
        || id == "context-copy-link"
        || id == "context-add-to-dictionary"
        || id == "context-cut"
        || id == "context-copy"
        || id == "context-paste"
        || id == "context-select-all"
        || id.starts_with(CONTEXT_SPELLING_SUGGESTION_PREFIX)
    {
        if id == "context-cut" {
            exec_document_command(app, "cut");
            return;
        }

        if id == "context-copy" {
            exec_document_command(app, "copy");
            return;
        }

        if id == "context-paste" {
            paste_clipboard_into_main_window(app);
            return;
        }

        if id == "context-select-all" {
            select_all_in_main_window(app);
            return;
        }

        let request = current_context_menu_request(state);
        if let Some(request) = request {
            match id {
                "context-open-image" => {
                    if let Some(target) =
                        parse_context_open_target(request.image_url.as_deref(), true)
                    {
                        let _ = open_external_target(target);
                    }
                }
                "context-copy-image" => {
                    if let Some(url) = request.image_url.as_deref() {
                        let url = url.to_string();
                        let _ = tauri::async_runtime::spawn(async move {
                            let _ = copy_image_from_url(url).await;
                        });
                    }
                }
                "context-copy-image-address" => {
                    if let Some(url) = request.image_url.as_deref() {
                        let _ = copy_text_to_clipboard(url.to_string());
                    }
                }
                "context-save-image" => {
                    if let Some(url) = request.image_url.as_deref() {
                        let url = url.to_string();
                        let _ = tauri::async_runtime::spawn(async move {
                            let _ = save_image_from_url(url).await;
                        });
                    }
                }
                "context-open-link" => {
                    if let Some(target) =
                        parse_context_open_target(request.link_url.as_deref(), false)
                    {
                        let _ = open_external_target(target);
                    }
                }
                "context-copy-link" => {
                    if let Some(url) = request.link_url.as_deref() {
                        let _ = copy_text_to_clipboard(url.to_string());
                    }
                }
                "context-add-to-dictionary" => {
                    if let Some(word) = request.misspelled_word.as_deref() {
                        add_word_to_dictionary_in_main_window(app, word);
                    }
                }
                _ => {}
            }

            if let Some(index) = id
                .strip_prefix(CONTEXT_SPELLING_SUGGESTION_PREFIX)
                .and_then(|value| value.parse::<usize>().ok())
            {
                if let Some(suggestion) = context_menu_spellcheck_suggestions(&request).get(index) {
                    replace_misspelling_in_main_window(app, suggestion);
                }
            }
        }
        return;
    }

    if id == "close-window" {
        if state.preview_shortcut_active.load(Ordering::Relaxed) {
            emit_close_preview_requested(app);
        } else if let Some(window) = app.get_webview_window("main") {
            let _ = window.close();
        }
    }
}

#[tauri::command]
pub async fn check_updates(
    app: AppHandle,
    _state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let update_root = resolve_update_root();
    let config = read_desktop_update_config();
    let branch = config.branch;
    let git_dir = update_root.join(".git");

    if !git_dir.is_dir() {
        return Ok(serde_json::json!({
            "supported": false,
            "reason": "not-a-git-checkout",
            "message": format!("{} isn't a git checkout — desktop self-update only runs against a source install.", update_root.to_string_lossy()),
            "hermesRoot": update_root.to_string_lossy().to_string(),
            "branch": branch,
            "fetchedAt": chrono::Utc::now().timestamp_millis()
        }));
    }

    let healed_branch = resolve_healed_branch(&update_root, &branch)?;
    let fetched = run_git(
        &["fetch", "--quiet", "origin", &healed_branch],
        &update_root,
    )?;
    if fetched.code != 0 {
        let message = {
            let line = first_line(&fetched.stderr);
            if line.is_empty() {
                "git fetch failed.".to_string()
            } else {
                line
            }
        };

        return Ok(serde_json::json!({
            "supported": true,
            "branch": healed_branch,
            "error": "fetch-failed",
            "message": message,
            "hermesRoot": update_root.to_string_lossy().to_string(),
            "fetchedAt": chrono::Utc::now().timestamp_millis()
        }));
    }

    let current_sha = run_git(&["rev-parse", "HEAD"], &update_root)?
        .stdout
        .trim()
        .to_string();
    let target_sha = run_git(
        &["rev-parse", &format!("origin/{}", healed_branch)],
        &update_root,
    )?
    .stdout
    .trim()
    .to_string();
    let count_str = run_git(
        &[
            "rev-list",
            &format!("HEAD..origin/{}", healed_branch),
            "--count",
        ],
        &update_root,
    )?
    .stdout
    .trim()
    .to_string();
    let dirty_str = run_git(&["status", "--porcelain"], &update_root)?
        .stdout
        .trim()
        .to_string();
    let current_branch = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], &update_root)?
        .stdout
        .trim()
        .to_string();

    let behind = count_str.parse::<u32>().unwrap_or(0);
    let commits = if behind > 0 {
        read_commit_log(&update_root, &healed_branch)?
    } else {
        Vec::new()
    };

    emit_update_progress(
        &app,
        serde_json::json!({
            "stage": "idle",
            "message": "Update status refreshed",
            "percent": serde_json::Value::Null,
            "error": serde_json::Value::Null,
            "at": chrono::Utc::now().timestamp_millis()
        }),
    );

    Ok(serde_json::json!({
        "supported": true,
        "branch": healed_branch,
        "currentBranch": current_branch,
        "behind": behind,
        "currentSha": current_sha,
        "targetSha": target_sha,
        "commits": commits,
        "dirty": !dirty_str.is_empty(),
        "hermesRoot": update_root.to_string_lossy().to_string(),
        "fetchedAt": chrono::Utc::now().timestamp_millis()
    }))
}

#[tauri::command]
pub async fn apply_updates(
    app: AppHandle,
    state: State<'_, AppState>,
    opts: Option<UpdateApplyOptions>,
) -> Result<serde_json::Value, String> {
    let _ = opts;
    if state.update_in_flight.swap(true, Ordering::Relaxed) {
        return Err("An update is already in progress.".to_string());
    }

    let update_root = resolve_update_root();
    let result = (|| {
        if let Some(updater) = resolve_updater_binary() {
            emit_update_progress(
                &app,
                serde_json::json!({
                    "stage": "restart",
                    "message": "Handing off to the Hermes updater…",
                    "percent": 100,
                    "error": serde_json::Value::Null,
                    "at": chrono::Utc::now().timestamp_millis()
                }),
            );

            let child = StdCommand::new(&updater)
                .arg("--update")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to launch updater: {}", e))?;

            drop(child);
            schedule_app_exit(&app);

            return Ok(serde_json::json!({
                "ok": true,
                "handedOff": true,
                "updater": updater.to_string_lossy().to_string()
            }));
        }

        #[cfg(not(windows))]
        {
            return apply_updates_posix_in_app(&app, &update_root);
        }

        #[cfg(windows)]
        {
            let command = manual_update_command(&update_root);
            let hermes = resolve_hermes_cli_binary(&update_root);

            emit_update_progress(
                &app,
                serde_json::json!({
                    "stage": "manual",
                    "message": command,
                    "percent": serde_json::Value::Null,
                    "error": serde_json::Value::Null,
                    "at": chrono::Utc::now().timestamp_millis()
                }),
            );

            return Ok(serde_json::json!({
                "ok": true,
                "manual": true,
                "command": command,
                "hermesRoot": update_root.to_string_lossy().to_string(),
                "hermesCli": hermes.map(|path| path.to_string_lossy().to_string())
            }));
        }
    })();

    state.update_in_flight.store(false, Ordering::Relaxed);
    result
}

#[tauri::command]
pub async fn get_update_branch() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!(read_desktop_update_config()))
}

#[tauri::command]
pub async fn set_update_branch(name: String) -> Result<serde_json::Value, String> {
    let branch = if name.trim().is_empty() {
        DEFAULT_UPDATE_BRANCH.to_string()
    } else {
        name.trim().to_string()
    };
    write_desktop_update_config(&DesktopUpdateConfig {
        branch: branch.clone(),
    })?;
    Ok(serde_json::json!({ "branch": branch }))
}

#[tauri::command]
pub async fn set_preview_shortcut_active(
    active: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .preview_shortcut_active
        .store(active, Ordering::Relaxed);
    Ok(())
}

// ============================================================================
// Version
// ============================================================================

#[tauri::command]
pub async fn get_version() -> Result<serde_json::Value, String> {
    let update_root = resolve_update_root();
    Ok(serde_json::json!({
        "appVersion": resolve_hermes_version(),
        "electronVersion": "tauri",
        "nodeVersion": "rust",
        "platform": std::env::consts::OS,
        "hermesRoot": update_root.to_string_lossy().to_string()
    }))
}

// ============================================================================
// Logs
// ============================================================================

#[tauri::command]
pub async fn reveal_logs() -> Result<serde_json::Value, String> {
    let log_path = desktop_log_path();
    let result = (|| -> Result<(), String> {
        if let Some(parent) = log_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create log dir: {}", e))?;
        }
        if !log_path.exists() {
            fs::write(&log_path, "").map_err(|e| format!("Failed to create log file: {}", e))?;
        }

        if !reveal_path_in_file_manager(&log_path)? {
            let target = log_path
                .parent()
                .map(PathBuf::from)
                .unwrap_or_else(|| log_path.clone());
            open::that(&target).map_err(|e| format!("Failed to open logs: {}", e))?;
        }

        Ok(())
    })();

    Ok(match result {
        Ok(()) => serde_json::json!({ "ok": true, "path": log_path.to_string_lossy() }),
        Err(error) => serde_json::json!({
            "ok": false,
            "path": log_path.to_string_lossy(),
            "error": error,
        }),
    })
}

#[tauri::command]
pub async fn get_recent_logs() -> Result<serde_json::Value, String> {
    let log_path = desktop_log_path();
    if log_path.exists() {
        let content = fs::read_to_string(&log_path).unwrap_or_default();
        let all_lines: Vec<&str> = content.lines().collect();
        let start = all_lines.len().saturating_sub(200);
        let lines = all_lines
            .into_iter()
            .skip(start)
            .map(|line| format!("{}\n", line))
            .collect::<Vec<_>>();
        Ok(serde_json::json!({ "path": log_path.to_string_lossy(), "lines": lines }))
    } else {
        Ok(serde_json::json!({ "path": log_path.to_string_lossy(), "lines": [] }))
    }
}

// ============================================================================
// Settings
// ============================================================================

#[tauri::command]
pub async fn get_default_project_dir() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!(default_project_dir_state()))
}

#[tauri::command]
pub async fn set_default_project_dir(dir: Option<String>) -> Result<serde_json::Value, String> {
    let next = dir
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(path) = next.as_ref() {
        fs::create_dir_all(path).map_err(|e| format!("Could not create directory: {}", e))?;
    }

    write_default_project_dir(next.as_deref())?;
    Ok(serde_json::json!({ "dir": next }))
}

#[tauri::command]
pub async fn pick_default_project_dir() -> Result<PickDefaultProjectDirResult, String> {
    let default_dir = read_default_project_dir().or_else(|| dirs::home_dir());
    let picked = rfd::FileDialog::new()
        .set_title("Choose default project directory")
        .set_directory(default_dir.unwrap_or_else(|| PathBuf::from(".")))
        .pick_folder();

    Ok(match picked {
        Some(path) => PickDefaultProjectDirResult {
            canceled: false,
            dir: Some(path.to_string_lossy().to_string()),
        },
        None => PickDefaultProjectDirResult {
            canceled: true,
            dir: None,
        },
    })
}

// ============================================================================
// Image Operations (placeholder)
// ============================================================================

#[tauri::command]
pub async fn save_image_from_url(url: String) -> Result<serde_json::Value, String> {
    let (buffer, fallback_name) = resource_buffer_from_url(&url).await?;
    let fallback = fallback_name.unwrap_or_else(|| "image.png".to_string());
    let picked = rfd::FileDialog::new()
        .set_title("Save Image")
        .set_file_name(&fallback)
        .save_file();

    let Some(file_path) = picked else {
        return Ok(serde_json::json!(false));
    };

    fs::write(&file_path, buffer).map_err(|e| format!("Failed to save image: {}", e))?;
    Ok(serde_json::json!(true))
}

#[tauri::command]
pub async fn save_image_buffer(data: Vec<u8>, ext: String) -> Result<serde_json::Value, String> {
    let file_path = write_composer_image(&data, &ext)?;
    Ok(serde_json::json!(file_path.to_string_lossy()))
}

#[tauri::command]
pub async fn save_clipboard_image() -> Result<serde_json::Value, String> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to access clipboard: {}", e))?;
    let Ok(image) = clipboard.get_image() else {
        return Ok(serde_json::json!(""));
    };
    let path = write_png_from_rgba(
        image.bytes.into_owned(),
        image.width as u32,
        image.height as u32,
    )?;
    Ok(serde_json::json!(path.to_string_lossy()))
}

// ============================================================================
// Preview (placeholder)
// ============================================================================

#[tauri::command]
pub async fn normalize_preview_target(
    target: String,
    base_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let normalized = normalize_preview_target_impl(&target, base_dir.as_deref().unwrap_or(""));
    Ok(match normalized {
        Some(value) => serde_json::to_value(value)
            .map_err(|e| format!("Failed to serialize preview target: {}", e))?,
        None => serde_json::Value::Null,
    })
}

#[tauri::command]
pub async fn watch_preview_file(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PreviewWatch, String> {
    watch_preview_file_impl(url, app, state).await
}

#[tauri::command]
pub async fn stop_preview_file_watch(
    id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(stop_preview_file_watch_impl(id, state).await)
}

// ============================================================================
// Titlebar
// ============================================================================

#[tauri::command]
pub async fn set_titlebar_theme(app: AppHandle, payload: serde_json::Value) -> Result<(), String> {
    let Some(payload) = parse_titlebar_theme_payload(&payload) else {
        return Ok(());
    };
    let Some(window) = main_window(&app) else {
        return Ok(());
    };

    let _ = window.set_theme(Some(titlebar_window_theme(&payload)));
    let _ = window.set_background_color(titlebar_background_color(&payload));
    Ok(())
}

// ============================================================================
// Fetch Link Title
// ============================================================================

#[derive(Default)]
struct LinkTitleProbeState {
    generation: u64,
    finished: bool,
}

fn decode_html_entities(value: &str) -> String {
    let decoded = value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&#39;", "'");

    let decoded = regex::Regex::new(r"&#x([0-9a-fA-F]+);")
        .ok()
        .map(|re| {
            re.replace_all(&decoded, |caps: &regex::Captures| {
                u32::from_str_radix(&caps[1], 16)
                    .ok()
                    .and_then(char::from_u32)
                    .unwrap_or(' ')
                    .to_string()
            })
            .into_owned()
        })
        .unwrap_or(decoded);

    regex::Regex::new(r"&#(\d+);")
        .ok()
        .map(|re| {
            re.replace_all(&decoded, |caps: &regex::Captures| {
                caps[1]
                    .parse::<u32>()
                    .ok()
                    .and_then(char::from_u32)
                    .unwrap_or(' ')
                    .to_string()
            })
            .into_owned()
        })
        .unwrap_or(decoded)
}

fn parse_html_title(html: &str) -> String {
    regex::Regex::new(r"(?is)<title[^>]*>(.*?)</title>")
        .ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|value| decode_html_entities(value.as_str()))
        .map(|value| value.split_whitespace().collect::<Vec<_>>().join(" "))
        .unwrap_or_default()
}

fn sanitize_link_title(value: &str) -> String {
    let clean = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.is_empty() {
        return String::new();
    }

    let lower = clean.to_ascii_lowercase();
    for blocked in [
        "access denied",
        "attention required",
        "captcha",
        "error",
        "forbidden",
        "just a moment",
        "request blocked",
        "too many requests",
    ] {
        if lower.contains(blocked) {
            return String::new();
        }
    }

    clean.chars().take(240).collect()
}

async fn fetch_html_title_with_http(raw_url: &str) -> String {
    let client = match reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(3))
        .timeout(Duration::from_millis(LINK_TITLE_TIMEOUT_MS))
        .user_agent(LINK_TITLE_USER_AGENT)
        .build()
    {
        Ok(client) => client,
        Err(_) => return String::new(),
    };

    let response = match client
        .get(raw_url)
        .header(
            reqwest::header::ACCEPT,
            "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        )
        .header(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.7")
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => return String::new(),
    };

    let body = match response.bytes().await {
        Ok(body) => body,
        Err(_) => return String::new(),
    };

    let budget = body.len().min(LINK_TITLE_BYTE_BUDGET);
    parse_html_title(&String::from_utf8_lossy(&body[..budget]))
}

async fn fetch_html_title_with_curl(raw_url: &str) -> String {
    let url = raw_url.trim().to_string();
    if url.is_empty() {
        return String::new();
    }

    tauri::async_runtime::spawn_blocking(move || {
        let output = StdCommand::new("curl")
            .args([
                "--silent",
                "--show-error",
                "--location",
                "--max-redirs",
                "3",
                "--max-time",
                "5",
                "--connect-timeout",
                "4",
                "--user-agent",
                LINK_TITLE_USER_AGENT,
                "--header",
                "Accept: text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
                "--header",
                "Accept-Language: en-US,en;q=0.7",
                "--header",
                "Accept-Encoding: identity",
                "--raw",
                &url,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output();

        let Ok(output) = output else {
            return String::new();
        };

        let budget = output.stdout.len().min(LINK_TITLE_BYTE_BUDGET);
        parse_html_title(&String::from_utf8_lossy(&output.stdout[..budget]))
    })
    .await
    .unwrap_or_default()
}

fn finish_link_title_probe(
    app: &AppHandle,
    label: &str,
    state: &Arc<StdMutex<LinkTitleProbeState>>,
    sender: &Arc<StdMutex<Option<tokio::sync::oneshot::Sender<String>>>>,
    title: String,
) {
    let should_send = {
        let Ok(mut state) = state.lock() else {
            return;
        };
        if state.finished {
            false
        } else {
            state.finished = true;
            true
        }
    };

    if should_send {
        if let Ok(mut sender) = sender.lock() {
            if let Some(tx) = sender.take() {
                let _ = tx.send(sanitize_link_title(&title));
            }
        }
    }

    if let Some(window) = app.get_webview_window(label) {
        let _ = window.destroy();
    }
}

fn schedule_link_title_probe(
    app: AppHandle,
    label: String,
    state: Arc<StdMutex<LinkTitleProbeState>>,
    sender: Arc<StdMutex<Option<tokio::sync::oneshot::Sender<String>>>>,
) {
    let generation = {
        let Ok(mut state) = state.lock() else {
            return;
        };
        if state.finished {
            return;
        }
        state.generation += 1;
        state.generation
    };

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(LINK_TITLE_RENDER_GRACE_MS)).await;

        let current_generation = {
            let Ok(state) = state.lock() else {
                return;
            };
            if state.finished {
                return;
            }
            state.generation
        };

        if current_generation != generation {
            return;
        }

        let title = app
            .get_webview_window(&label)
            .and_then(|window| window.title().ok())
            .unwrap_or_default();
        finish_link_title_probe(&app, &label, &state, &sender, title);
    });
}

async fn fetch_html_title_with_webview(app: &AppHandle, raw_url: &str) -> String {
    let Ok(url) = reqwest::Url::parse(raw_url) else {
        return String::new();
    };

    let label = format!("link-title-{}", generate_token());
    let state = Arc::new(StdMutex::new(LinkTitleProbeState::default()));
    let (tx, rx) = tokio::sync::oneshot::channel();
    let sender = Arc::new(StdMutex::new(Some(tx)));

    let app_for_title = app.clone();
    let label_for_title = label.clone();
    let state_for_title = Arc::clone(&state);
    let sender_for_title = Arc::clone(&sender);

    let app_for_load = app.clone();
    let label_for_load = label.clone();
    let state_for_load = Arc::clone(&state);
    let sender_for_load = Arc::clone(&sender);

    let window =
        match tauri::WebviewWindowBuilder::new(app, &label, tauri::WebviewUrl::External(url))
            .title("")
            .visible(false)
            .focused(false)
            .decorations(false)
            .skip_taskbar(true)
            .user_agent(LINK_TITLE_USER_AGENT)
            .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
            .on_document_title_changed(move |window, title| {
                let _ = window.set_title(&title);
                schedule_link_title_probe(
                    app_for_title.clone(),
                    label_for_title.clone(),
                    Arc::clone(&state_for_title),
                    Arc::clone(&sender_for_title),
                );
            })
            .on_page_load(move |_window, payload| {
                if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                    schedule_link_title_probe(
                        app_for_load.clone(),
                        label_for_load.clone(),
                        Arc::clone(&state_for_load),
                        Arc::clone(&sender_for_load),
                    );
                }
            })
            .build()
        {
            Ok(window) => window,
            Err(_) => return String::new(),
        };

    let result =
        tokio::time::timeout(Duration::from_millis(LINK_TITLE_RENDER_TIMEOUT_MS), rx).await;
    let fallback_title = window.title().unwrap_or_default();
    finish_link_title_probe(app, &label, &state, &sender, fallback_title.clone());

    match result {
        Ok(Ok(title)) => title,
        _ => sanitize_link_title(&fallback_title),
    }
}

#[tauri::command]
pub async fn fetch_link_title(app: AppHandle, url: String) -> Result<String, String> {
    let raw_url = url.trim();
    if raw_url.is_empty() {
        return Ok(String::new());
    }

    let curl_title = sanitize_link_title(&fetch_html_title_with_curl(raw_url).await);
    if !curl_title.is_empty() {
        return Ok(curl_title);
    }

    let http_title = sanitize_link_title(&fetch_html_title_with_http(raw_url).await);
    if !http_title.is_empty() {
        return Ok(http_title);
    }

    Ok(fetch_html_title_with_webview(&app, raw_url).await)
}

// ============================================================================
// Terminal (placeholder)
// ============================================================================

#[tauri::command]
pub async fn terminal_start(
    app: AppHandle,
    window: Window,
    payload: Option<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let id = generate_token();
    let (command, args, shell_name) = terminal_shell_command();
    let event_target = terminal_event_target(Some(window.label())).to_string();
    let cwd = safe_terminal_cwd(
        payload
            .as_ref()
            .and_then(|value| value.get("cwd"))
            .and_then(|value| value.as_str()),
    );
    let cols = payload
        .as_ref()
        .and_then(|value| value.get("cols"))
        .and_then(|value| value.as_u64())
        .map(|value| value as u16)
        .unwrap_or(80)
        .max(2);
    let rows = payload
        .as_ref()
        .and_then(|value| value.get("rows"))
        .and_then(|value| value.as_u64())
        .map(|value| value as u16)
        .unwrap_or(24)
        .max(2);

    let pty_system = portable_pty::native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut builder = CommandBuilder::new(command);
    builder.args(args);
    builder.cwd(cwd.clone());
    configure_terminal_env(&mut builder);

    let master = pair.master;
    let reader = master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;
    let writer = master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {}", e))?;
    let child = pair
        .slave
        .spawn_command(builder)
        .map_err(|e| format!("Failed to spawn PTY shell: {}", e))?;

    let session = Arc::new(TerminalSession {
        master: StdMutex::new(master),
        child: StdMutex::new(child),
        writer: StdMutex::new(writer),
        event_target,
        alive: AtomicBool::new(true),
        exited: AtomicBool::new(false),
    });

    {
        let mut sessions = state
            .terminal_sessions
            .lock()
            .map_err(|_| "Failed to access terminal sessions".to_string())?;
        sessions.insert(id.clone(), session.clone());
    }

    spawn_terminal_reader(
        app.clone(),
        id.clone(),
        reader,
        state.terminal_sessions.clone(),
        session.clone(),
    );

    Ok(serde_json::json!({
        "cwd": cwd.to_string_lossy().to_string(),
        "id": id,
        "shell": shell_name,
    }))
}

#[tauri::command]
pub async fn terminal_write(
    id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let session = {
        let sessions = state
            .terminal_sessions
            .lock()
            .map_err(|_| "Failed to access terminal sessions".to_string())?;
        sessions.get(&id).cloned()
    };

    let Some(session) = session else {
        return Ok(false);
    };

    let mut writer = session
        .writer
        .lock()
        .map_err(|_| "Failed to access terminal writer".to_string())?;
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|e| format!("Failed to write terminal input: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub async fn terminal_resize(
    id: String,
    size: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let session = {
        let sessions = state
            .terminal_sessions
            .lock()
            .map_err(|_| "Failed to access terminal sessions".to_string())?;
        sessions.get(&id).cloned()
    };

    let Some(session) = session else {
        return Ok(false);
    };

    let cols = size
        .get("cols")
        .and_then(|value| value.as_u64())
        .map(|value| value as u16)
        .unwrap_or(80)
        .max(2);
    let rows = size
        .get("rows")
        .and_then(|value| value.as_u64())
        .map(|value| value as u16)
        .unwrap_or(24)
        .max(2);

    let master = session
        .master
        .lock()
        .map_err(|_| "Failed to access terminal pty".to_string())?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize terminal: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub async fn terminal_dispose(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let session = {
        let mut sessions = state
            .terminal_sessions
            .lock()
            .map_err(|_| "Failed to access terminal sessions".to_string())?;
        sessions.remove(&id)
    };

    let Some(session) = session else {
        return Ok(false);
    };

    dispose_terminal_session_impl(session.as_ref());

    Ok(true)
}

// ============================================================================
// Path Selection
// ============================================================================

#[tauri::command]
pub async fn select_paths(options: Option<serde_json::Value>) -> Result<Vec<String>, String> {
    let options = options.unwrap_or_default();
    let is_directory = options
        .get("directories")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let allow_multiple = options
        .get("multiple")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let title = options
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Add context");
    let default_path = options
        .get("defaultPath")
        .and_then(|v| v.as_str())
        .map(PathBuf::from)
        .filter(|path| path.exists());

    let mut dialog = rfd::FileDialog::new().set_title(title);

    if let Some(path) = default_path {
        dialog = dialog.set_directory(path);
    }

    if let Some(filters) = options.get("filters").and_then(|v| v.as_array()) {
        for filter in filters {
            let name = filter
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Files");
            let extensions: Vec<String> = filter
                .get("extensions")
                .and_then(|v| v.as_array())
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| {
                            item.as_str()
                                .map(|ext| ext.trim_start_matches('.').to_string())
                        })
                        .filter(|ext| !ext.is_empty())
                        .collect()
                })
                .unwrap_or_default();

            if !extensions.is_empty() {
                dialog = dialog.add_filter(name, &extensions);
            }
        }
    }

    let paths = if is_directory {
        if allow_multiple {
            dialog.pick_folders().unwrap_or_default()
        } else {
            dialog.pick_folder().into_iter().collect()
        }
    } else if allow_multiple {
        dialog.pick_files().unwrap_or_default()
    } else {
        dialog.pick_file().into_iter().collect()
    };

    Ok(paths
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect())
}

// ============================================================================
// Microphone
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MicrophoneAccessAction {
    Return(bool),
    RequestSystemPrompt,
}

fn microphone_access_action(status_code: i64) -> MicrophoneAccessAction {
    match status_code {
        0 => MicrophoneAccessAction::RequestSystemPrompt,
        1 | 2 => MicrophoneAccessAction::Return(false),
        3 => MicrophoneAccessAction::Return(true),
        _ => MicrophoneAccessAction::Return(true),
    }
}

#[tauri::command]
pub async fn request_microphone_access() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        return request_microphone_access_macos().await;
    }

    #[cfg(not(target_os = "macos"))]
    Ok(true)
}

#[cfg(target_os = "macos")]
async fn request_microphone_access_macos() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(request_microphone_access_macos_blocking)
        .await
        .map_err(|error| format!("Failed to request microphone access: {}", error))?
}

#[cfg(target_os = "macos")]
fn request_microphone_access_macos_blocking() -> Result<bool, String> {
    let media_type = unsafe { AVMediaTypeAudio }
        .ok_or_else(|| "AVMediaTypeAudio is unavailable.".to_string())?;
    let status_code =
        unsafe { AVCaptureDevice::authorizationStatusForMediaType(media_type) }.0 as i64;

    match microphone_access_action(status_code) {
        MicrophoneAccessAction::Return(value) => Ok(value),
        MicrophoneAccessAction::RequestSystemPrompt => {
            let (tx, rx) = std::sync::mpsc::channel();
            let sender = Arc::new(StdMutex::new(Some(tx)));
            let sender_ref = Arc::clone(&sender);
            let handler = RcBlock::new(move |granted: ObjcBool| {
                if let Ok(mut slot) = sender_ref.lock() {
                    if let Some(tx) = slot.take() {
                        let _ = tx.send(granted.as_bool());
                    }
                }
            });

            unsafe {
                AVCaptureDevice::requestAccessForMediaType_completionHandler(media_type, &handler);
            }

            rx.recv_timeout(Duration::from_secs(60)).map_err(|error| {
                format!(
                    "Timed out waiting for microphone access response: {}",
                    error
                )
            })
        }
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn get_connection_config_path() -> PathBuf {
    desktop_app_data_dir().join("connection.json")
}

fn desktop_app_data_dir() -> PathBuf {
    dirs::data_dir()
        .or_else(|| dirs::home_dir().map(|home| home.join(".local/share")))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Hermes")
}

fn default_project_dir_config_path() -> PathBuf {
    desktop_app_data_dir().join("project-dir.json")
}

fn default_project_dir_state() -> DefaultProjectDirState {
    DefaultProjectDirState {
        default_label: dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("hermes-projects")
            .to_string_lossy()
            .to_string(),
        dir: read_default_project_dir().map(|path| path.to_string_lossy().to_string()),
    }
}

fn read_default_project_dir() -> Option<PathBuf> {
    let content = fs::read_to_string(default_project_dir_config_path()).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    let path = value.get("dir")?.as_str()?.trim();
    if path.is_empty() {
        return None;
    }

    let resolved = PathBuf::from(path);
    if resolved.is_dir() {
        Some(resolved)
    } else {
        None
    }
}

fn write_default_project_dir(dir: Option<&str>) -> Result<(), String> {
    let path = default_project_dir_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }

    let payload = match dir
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        Some(value) => {
            serde_json::json!({ "dir": PathBuf::from(value).to_string_lossy().to_string() })
        }
        None => serde_json::json!({}),
    };

    fs::write(
        &path,
        serde_json::to_string_pretty(&payload)
            .map_err(|e| format!("Failed to serialize config: {}", e))?
            + "\n",
    )
    .map_err(|e| format!("Failed to write config: {}", e))
}

fn resolve_timeout_ms(timeout_ms: Option<u64>, fallback_ms: u64) -> u64 {
    let fallback = if fallback_ms > 0 {
        fallback_ms
    } else {
        DEFAULT_FETCH_TIMEOUT_MS
    };

    match timeout_ms {
        Some(value) if value > 0 => value,
        _ => fallback,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SessionRenameRequest {
    session_id: String,
    session_path: String,
    title: String,
}

fn parse_session_rename_request(request: &ApiRequest) -> Option<SessionRenameRequest> {
    let method = request.method.as_deref().unwrap_or("GET");
    if method != "PATCH" {
        return None;
    }

    let parsed = reqwest::Url::parse(&format!("http://127.0.0.1{}", request.path)).ok()?;
    let segments = parsed.path_segments()?.collect::<Vec<_>>();
    if segments.len() != 3 || segments[0] != "api" || segments[1] != "sessions" {
        return None;
    }

    let body = request.body.as_ref()?.as_object()?;
    let title = match body.get("title") {
        Some(serde_json::Value::Null) => String::new(),
        Some(serde_json::Value::String(value)) => value.clone(),
        _ => return None,
    };

    Some(SessionRenameRequest {
        session_id: segments[2].to_string(),
        session_path: parsed.path().to_string(),
        title,
    })
}

fn rename_title_fallback(title: &str) -> String {
    title.split_whitespace().collect::<Vec<_>>().join(" ")
}

async fn try_handle_local_session_rename(
    request: &ApiRequest,
    base_url: &str,
    token: &str,
    mode: &str,
) -> Result<Option<serde_json::Value>, String> {
    if mode != "local" {
        return Ok(None);
    }

    let Some(rename) = parse_session_rename_request(request) else {
        return Ok(None);
    };

    let active_root = active_hermes_root();
    let Some(hermes) = resolve_hermes_cli_binary(&active_root) else {
        return Err(
            "Hermes CLI is installed, but Hermes Desktop could not resolve it for session rename."
                .to_string(),
        );
    };

    let env = update_command_env(&active_root);
    let session_id = rename.session_id.clone();
    let title = rename.title.clone();
    let hermes = hermes.clone();
    let active_root_for_command = active_root.clone();

    let output = tokio::task::spawn_blocking(move || {
        let mut command = StdCommand::new(&hermes);
        command
            .current_dir(&active_root_for_command)
            .arg("sessions")
            .arg("rename")
            .arg(&session_id)
            .arg(&title);

        for (key, value) in &env {
            command.env(key, value);
        }

        command.output()
    })
    .await
    .map_err(|error| format!("Failed to run Hermes session rename: {}", error))?
    .map_err(|error| format!("Failed to run Hermes session rename: {}", error))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!(
                "Hermes session rename exited with status {}",
                output.status.code().unwrap_or(1)
            )
        };
        return Err(detail);
    }

    let timeout_ms = resolve_timeout_ms(request.timeout_ms, DEFAULT_FETCH_TIMEOUT_MS);
    let timeout = std::time::Duration::from_millis(timeout_ms);
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let fallback_title = rename_title_fallback(&rename.title);
    let detail_url = format!("{}{}", base_url, rename.session_path);
    let final_title = match client
        .get(&detail_url)
        .header("X-Hermes-Session-Token", token)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            let text = response
                .text()
                .await
                .map_err(|e| format!("Failed to read response: {}", e))?;
            serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|value| {
                    value
                        .get("title")
                        .and_then(|title| title.as_str())
                        .map(|title| title.to_string())
                })
                .unwrap_or(fallback_title)
        }
        _ => fallback_title,
    };

    Ok(Some(serde_json::json!({
        "ok": true,
        "title": final_title,
    })))
}

fn parse_hermes_api_response(
    url: &str,
    status: reqwest::StatusCode,
    content_type: Option<&str>,
    text: &str,
) -> Result<serde_json::Value, String> {
    if status.as_u16() >= 400 {
        let message = if text.trim().is_empty() {
            status
                .canonical_reason()
                .unwrap_or("Request failed")
                .to_string()
        } else {
            text.to_string()
        };
        return Err(format!("{}: {}", status.as_u16(), message));
    }

    if text.trim().is_empty() {
        return Ok(serde_json::Value::Null);
    }

    let content_type = content_type.unwrap_or_default();
    let looks_html = regex::Regex::new(r"^\s*<(?:!doctype|html)")
        .ok()
        .map(|re| re.is_match(text))
        .unwrap_or(false);
    if looks_html || content_type.contains("text/html") {
        return Err(format!(
            "Expected JSON from {} but got HTML (status {}). The endpoint is likely missing on the Hermes backend.",
            url,
            status.as_u16()
        ));
    }

    serde_json::from_str(text).map_err(|_| {
        format!(
            "Invalid JSON from {} (status {}): {}",
            url,
            status.as_u16(),
            text.chars().take(200).collect::<String>()
        )
    })
}

fn sensitive_file_block_reason(file_path: &Path) -> Option<String> {
    let normalized = file_path
        .to_string_lossy()
        .replace('\\', "/")
        .to_lowercase();
    let basename = file_path.file_name()?.to_string_lossy().to_lowercase();
    let ext = Path::new(&basename)
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy().to_lowercase()))
        .unwrap_or_default();

    if normalized.contains("/.ssh/") {
        return Some("SSH key/config files are blocked.".to_string());
    }
    if normalized.contains("/.gnupg/") {
        return Some("GPG key material is blocked.".to_string());
    }
    if normalized.ends_with("/.aws/credentials") {
        return Some("AWS credential files are blocked.".to_string());
    }
    if basename == ".env" {
        return Some(".env files are blocked because they commonly contain secrets.".to_string());
    }
    if let Some(suffix) = basename.strip_prefix(".env.") {
        if !SAFE_ENV_SUFFIXES.contains(&suffix) {
            return Some(format!(
                "{} is blocked because it appears to contain environment secrets.",
                basename
            ));
        }
    }
    if regex::Regex::new(r"^id_(rsa|dsa|ecdsa|ed25519)(?:\..+)?$")
        .ok()
        .map(|re| re.is_match(&basename))
        .unwrap_or(false)
        && !basename.ends_with(".pub")
    {
        return Some("SSH private key files are blocked.".to_string());
    }
    if SENSITIVE_EXTENSIONS.contains(&ext.as_str()) {
        return Some(format!("{} key/certificate files are blocked.", ext));
    }
    if matches!(basename.as_str(), ".npmrc" | ".netrc" | ".pypirc") {
        return Some(format!(
            "{} is blocked because it may include auth credentials.",
            basename
        ));
    }

    None
}

fn resolve_requested_file_path(
    file_path: &str,
    base_dir: Option<&Path>,
    purpose: &str,
) -> Result<PathBuf, String> {
    let raw = file_path.trim();
    if raw.is_empty() {
        return Err(format!("{} failed: file path is required.", purpose));
    }
    if raw.contains('\0') {
        return Err(format!("{} failed: file path is invalid.", purpose));
    }
    if raw.to_ascii_lowercase().starts_with("file:") {
        let parsed = reqwest::Url::parse(raw)
            .map_err(|_| format!("{} failed: file URL is invalid.", purpose))?;
        return parsed
            .to_file_path()
            .map_err(|_| format!("{} failed: file URL is invalid.", purpose));
    }

    let resolved_base = base_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    Ok(if PathBuf::from(raw).is_absolute() {
        PathBuf::from(raw)
    } else {
        resolved_base.join(raw)
    })
}

struct ResolveReadableFileOptions<'a> {
    base_dir: Option<&'a Path>,
    block_sensitive: bool,
    max_bytes: Option<u64>,
    purpose: &'a str,
}

impl Default for ResolveReadableFileOptions<'_> {
    fn default() -> Self {
        Self {
            base_dir: None,
            block_sensitive: true,
            max_bytes: None,
            purpose: "",
        }
    }
}

fn resolve_readable_file_for_ipc(
    file_path: &str,
    options: ResolveReadableFileOptions<'_>,
) -> Result<(PathBuf, fs::Metadata), String> {
    let purpose = if options.purpose.trim().is_empty() {
        "File read"
    } else {
        options.purpose
    };
    let resolved_path = resolve_requested_file_path(file_path, options.base_dir, purpose)?;
    if options.block_sensitive && !matches!(options.purpose, "Media stream") {
        if let Some(reason) = sensitive_file_block_reason(&resolved_path) {
            return Err(format!(
                "{} blocked for sensitive file: {}",
                purpose, reason
            ));
        }
    }

    let stat = fs::metadata(&resolved_path).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => format!("{} failed: file does not exist.", purpose),
        _ => format!("{} failed: {}", purpose, error),
    })?;

    if stat.is_dir() {
        return Err(format!("{} failed: path points to a directory.", purpose));
    }
    if !stat.is_file() {
        return Err(format!(
            "{} failed: only regular files can be read.",
            purpose
        ));
    }
    if let Some(max_bytes) = options.max_bytes.filter(|value| *value > 0) {
        if stat.len() > max_bytes {
            return Err(format!(
                "{} failed: file is too large ({} bytes; limit {} bytes).",
                purpose,
                stat.len(),
                max_bytes
            ));
        }
    }
    fs::File::open(&resolved_path)
        .and_then(|file| file.metadata())
        .map_err(|_| format!("{} failed: file is not readable.", purpose))?;

    Ok((resolved_path, stat))
}

fn resolve_dir_path(path: &str) -> PathBuf {
    let raw = path.trim();
    let base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    if raw.is_empty() {
        base
    } else {
        let candidate = PathBuf::from(raw);
        if candidate.is_absolute() {
            candidate
        } else {
            base.join(candidate)
        }
    }
}

fn io_error_code(error: &std::io::Error) -> String {
    match error.kind() {
        std::io::ErrorKind::NotFound => "ENOENT".to_string(),
        std::io::ErrorKind::PermissionDenied => "EACCES".to_string(),
        std::io::ErrorKind::AlreadyExists => "EEXIST".to_string(),
        std::io::ErrorKind::InvalidInput => "EINVAL".to_string(),
        std::io::ErrorKind::TimedOut => "ETIMEDOUT".to_string(),
        _ => error
            .raw_os_error()
            .map(|code| format!("OS-{}", code))
            .unwrap_or_else(|| "read-error".to_string()),
    }
}

fn find_git_root(start: &Path) -> Option<PathBuf> {
    let mut dir = PathBuf::from(start);
    for _ in 0..50 {
        if dir.join(".git").exists() {
            return Some(dir);
        }
        let parent = dir.parent().map(PathBuf::from)?;
        if parent == dir {
            return None;
        }
        dir = parent;
    }
    None
}

fn decode_data_url_text(data: &str) -> Result<Vec<u8>, String> {
    let bytes = data.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err("Failed to decode data URL: incomplete percent escape".to_string());
            }

            let hi = bytes[index + 1];
            let lo = bytes[index + 2];
            let hex = [hi, lo];
            let value = std::str::from_utf8(&hex)
                .ok()
                .and_then(|value| u8::from_str_radix(value, 16).ok())
                .ok_or_else(|| "Failed to decode data URL: invalid percent escape".to_string())?;

            decoded.push(value);
            index += 3;
            continue;
        }

        decoded.push(bytes[index]);
        index += 1;
    }

    Ok(decoded)
}

fn filename_from_url(raw_url: &str, fallback: &str) -> String {
    let Ok(parsed) = reqwest::Url::parse(raw_url) else {
        return fallback.to_string();
    };

    let encoded = parsed
        .path()
        .rsplit('/')
        .next()
        .map(str::trim)
        .unwrap_or_default();
    if encoded.is_empty() {
        return fallback.to_string();
    }

    let decoded = decode_data_url_text(encoded)
        .ok()
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_else(|| encoded.to_string());

    if decoded.contains('.') {
        decoded
    } else {
        fallback.to_string()
    }
}

async fn resource_buffer_from_url(raw_url: &str) -> Result<(Vec<u8>, Option<String>), String> {
    let url = raw_url.trim();
    if url.is_empty() {
        return Err("Missing URL".to_string());
    }

    if let Some(rest) = url.strip_prefix("data:") {
        let (meta, data) = rest
            .split_once(',')
            .ok_or_else(|| "Invalid data URL".to_string())?;
        let mime = meta.split(';').next().unwrap_or("application/octet-stream");
        let bytes = if meta.contains(";base64") {
            base64::engine::general_purpose::STANDARD
                .decode(data)
                .map_err(|e| format!("Failed to decode data URL: {}", e))?
        } else {
            decode_data_url_text(data)?
        };
        return Ok((bytes, Some(default_image_name_from_mime(mime))));
    }

    if let Ok(parsed) = reqwest::Url::parse(url) {
        if parsed.scheme() == "file" {
            let path = parsed
                .to_file_path()
                .map_err(|_| "Invalid file URL".to_string())?;
            let bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
            return Ok((
                bytes,
                path.file_name()
                    .map(|name| name.to_string_lossy().to_string()),
            ));
        }
    }

    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("Failed to fetch image: HTTP {}", status.as_u16()));
    }

    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|s| s.to_string());
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image: {}", e))?
        .to_vec();
    let fallback = mime
        .as_deref()
        .map(default_image_name_from_mime)
        .unwrap_or_else(|| "image.png".to_string());
    Ok((bytes, Some(filename_from_url(url, &fallback))))
}

fn default_image_name_from_mime(mime: &str) -> String {
    let normalized = mime
        .split(';')
        .next()
        .unwrap_or(mime)
        .trim()
        .to_ascii_lowercase();
    let ext = mime_guess::get_mime_extensions_str(&normalized)
        .and_then(|items| items.first())
        .copied()
        .unwrap_or("png");
    format!("image.{}", ext)
}

fn write_composer_image(buffer: &[u8], ext: &str) -> Result<PathBuf, String> {
    let dir = desktop_app_data_dir().join("composer-images");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    let normalized = ext.trim().to_lowercase();
    let safe_ext = if normalized.starts_with('.') {
        normalized
    } else {
        format!(".{}", normalized)
    };
    let safe_ext = if safe_ext
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && safe_ext.len() <= 8
    {
        safe_ext
    } else {
        ".png".to_string()
    };

    let stamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let random = format!("{:06x}", rand::random::<u32>() & 0x00ff_ffff);
    let path = dir.join(format!("composer_{}_{}{}", stamp, random, safe_ext));
    fs::write(&path, buffer).map_err(|e| format!("Failed to write image: {}", e))?;
    Ok(path)
}

fn write_png_from_rgba(bytes: Vec<u8>, width: u32, height: u32) -> Result<PathBuf, String> {
    let dir = desktop_app_data_dir().join("composer-images");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    let stamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let random = format!("{:06x}", rand::random::<u32>() & 0x00ff_ffff);
    let path = dir.join(format!("composer_{}_{}.png", stamp, random));
    let file = fs::File::create(&path).map_err(|e| format!("Failed to create image: {}", e))?;
    let mut encoder = png::Encoder::new(file, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder
        .write_header()
        .map_err(|e| format!("Failed to start PNG write: {}", e))?;
    writer
        .write_image_data(&bytes)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;
    Ok(path)
}

fn preview_language_for_ext(ext: &str) -> Option<String> {
    Some(
        match ext.to_lowercase().as_str() {
            ".c" => "c",
            ".conf" => "ini",
            ".cpp" => "cpp",
            ".css" => "css",
            ".csv" => "csv",
            ".go" => "go",
            ".graphql" => "graphql",
            ".h" => "c",
            ".hpp" => "cpp",
            ".html" => "html",
            ".java" => "java",
            ".js" => "javascript",
            ".json" => "json",
            ".jsx" => "jsx",
            ".kt" => "kotlin",
            ".lua" => "lua",
            ".md" => "markdown",
            ".mjs" => "javascript",
            ".py" => "python",
            ".rb" => "ruby",
            ".rs" => "rust",
            ".sh" => "shell",
            ".sql" => "sql",
            ".svg" => "xml",
            ".toml" => "toml",
            ".ts" => "typescript",
            ".tsx" => "tsx",
            ".txt" => "text",
            ".xml" => "xml",
            ".yaml" => "yaml",
            ".yml" => "yaml",
            ".zsh" => "shell",
            _ => return None,
        }
        .to_string(),
    )
}

fn looks_binary(buffer: &[u8]) -> bool {
    if buffer.is_empty() {
        return false;
    }

    let mut suspicious = 0usize;
    for byte in buffer {
        if *byte == 0 {
            return true;
        }
        if *byte < 32 && *byte != 9 && *byte != 10 && *byte != 13 {
            suspicious += 1;
        }
    }

    (suspicious as f64 / buffer.len() as f64) > 0.12
}

fn resolve_hermes_cwd() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
}

fn expand_user_path(file_path: &str) -> PathBuf {
    let value = file_path.trim();
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    if value == "~" {
        return home;
    }

    if let Some(rest) = value
        .strip_prefix("~/")
        .or_else(|| value.strip_prefix("~\\"))
    {
        return home.join(rest);
    }

    PathBuf::from(value)
}

fn resolve_preview_base_dir(base_dir: &str) -> PathBuf {
    let candidate = expand_user_path(base_dir);
    if candidate.as_os_str().is_empty() {
        return resolve_hermes_cwd();
    }
    if candidate.is_absolute() {
        candidate
    } else {
        resolve_hermes_cwd().join(candidate)
    }
}

fn preview_url_host_label(url: &reqwest::Url) -> String {
    let host = url.host_str().unwrap_or_default();
    match url.port() {
        Some(port) => format!("{}:{}", host, port),
        None => host.to_string(),
    }
}

fn preview_file_target(raw_target: &str, base_dir: &str) -> Option<PreviewTargetResult> {
    let raw = raw_target.trim();
    if raw.is_empty() {
        return None;
    }

    if raw.starts_with("http://") || raw.starts_with("https://") {
        let mut url = reqwest::Url::parse(raw).ok()?;
        let host = url.host_str()?.to_lowercase();
        if !matches!(host.as_str(), "0.0.0.0" | "127.0.0.1" | "::1" | "localhost") {
            return None;
        }
        if host == "0.0.0.0" {
            url.set_host(Some("127.0.0.1")).ok()?;
        }

        let host_label = preview_url_host_label(&url);
        let label = if url.path() == "/" {
            host_label
        } else {
            format!("{}{}", host_label, url.path())
        };

        return Some(PreviewTargetResult {
            kind: "url".to_string(),
            label,
            source: raw.to_string(),
            url: url.to_string(),
            binary: None,
            byte_size: None,
            large: None,
            language: None,
            mime_type: None,
            path: None,
            preview_kind: None,
            render_mode: None,
        });
    }

    let base = if base_dir.trim().is_empty() {
        resolve_hermes_cwd()
    } else {
        resolve_preview_base_dir(base_dir.trim())
    };

    let mut resolved = if raw.starts_with("file://") {
        reqwest::Url::parse(raw).ok()?.to_file_path().ok()?
    } else {
        let candidate = expand_user_path(raw);
        if candidate.is_absolute() {
            candidate
        } else {
            base.join(candidate)
        }
    };

    if resolved.is_dir() {
        resolved = resolved.join("index.html");
    }
    if !resolved.exists() {
        return None;
    }

    let ext = resolved
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value.to_lowercase()))
        .unwrap_or_default();
    let mime = mime_guess::from_path(&resolved)
        .first_or_octet_stream()
        .to_string();
    let stat = fs::metadata(&resolved).ok()?;
    let bytes = fs::read(&resolved).ok()?;
    let binary = looks_binary(&bytes[..bytes.len().min(4096)]);
    let preview_kind = if matches!(ext.as_str(), ".html" | ".htm") {
        "html"
    } else if mime.starts_with("image/") {
        "image"
    } else if binary {
        "binary"
    } else {
        "text"
    };

    Some(PreviewTargetResult {
        kind: "file".to_string(),
        label: resolved
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_string(),
        source: raw.to_string(),
        url: format!("file://{}", resolved.to_string_lossy().replace('\\', "/")),
        binary: Some(binary),
        byte_size: Some(stat.len()),
        large: Some(stat.len() > 1024 * 1024),
        language: preview_language_for_ext(&ext),
        mime_type: Some(mime),
        path: Some(resolved.to_string_lossy().to_string()),
        preview_kind: Some(preview_kind.to_string()),
        render_mode: if preview_kind == "html" {
            Some("preview".to_string())
        } else {
            None
        },
    })
}

fn normalize_preview_target_impl(target: &str, base_dir: &str) -> Option<PreviewTargetResult> {
    preview_file_target(target, base_dir)
}

fn start_preview_file_watcher(
    watch_dir: &Path,
    tx: std::sync::mpsc::Sender<notify::Result<notify::Event>>,
) -> Result<notify::RecommendedWatcher, String> {
    let mut watcher = recommended_watcher(move |result| {
        let _ = tx.send(result);
    })
    .map_err(|e| format!("Failed to watch preview file: {}", e))?;

    watcher
        .watch(watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch preview file: {}", e))?;

    Ok(watcher)
}

async fn watch_preview_file_impl(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PreviewWatch, String> {
    let file_path = file_path_from_preview_url(&url)?;
    let watch_dir = file_path
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "Preview file has no parent directory".to_string())?;
    let target_name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_string)
        .ok_or_else(|| "Preview file has no file name".to_string())?;
    let watched_path = file_path.clone();
    let id = generate_token();
    let stop_flag = Arc::new(AtomicBool::new(false));
    let event_id = id.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    let watcher = start_preview_file_watcher(&watch_dir, tx)?;
    {
        let mut watchers = state.preview_watches.lock().await;
        watchers.insert(id.clone(), stop_flag.clone());
    }

    thread::spawn(move || {
        let _watcher = watcher;

        let mut pending_emit = None::<std::time::Instant>;

        loop {
            if stop_flag.load(Ordering::Relaxed) {
                break;
            }

            match rx.recv_timeout(Duration::from_millis(60)) {
                Ok(Ok(event)) => {
                    if preview_watch_matches_target(&event.paths, &target_name) {
                        pending_emit = Some(std::time::Instant::now());
                    }
                }
                Ok(Err(_)) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }

            if let Some(started_at) = pending_emit {
                if started_at.elapsed() >= Duration::from_millis(PREVIEW_WATCH_DEBOUNCE_MS) {
                    pending_emit = None;
                    if !watched_path.is_file() {
                        continue;
                    }

                    let _ = app.emit(
                        "hermes:preview-file-changed",
                        PreviewWatchPayload {
                            id: event_id.clone(),
                            path: watched_path.to_string_lossy().to_string(),
                            url: format!(
                                "file://{}",
                                watched_path.to_string_lossy().replace('\\', "/")
                            ),
                        },
                    );
                }
            }
        }
    });

    Ok(PreviewWatch {
        id,
        path: file_path.to_string_lossy().to_string(),
    })
}

async fn stop_preview_file_watch_impl(id: String, state: State<'_, AppState>) -> bool {
    let stop_flag = {
        let mut watchers = state.preview_watches.lock().await;
        watchers.remove(&id)
    };

    if let Some(flag) = stop_flag {
        flag.store(true, Ordering::Relaxed);
        true
    } else {
        false
    }
}

async fn stop_all_preview_file_watches_impl(state: &AppState) -> usize {
    let stop_flags = {
        let mut watchers = state.preview_watches.lock().await;
        watchers.drain().map(|(_, flag)| flag).collect::<Vec<_>>()
    };

    let count = stop_flags.len();
    for flag in stop_flags {
        flag.store(true, Ordering::Relaxed);
    }

    count
}

fn preview_watch_matches_target(paths: &[PathBuf], target_name: &str) -> bool {
    if paths.is_empty() {
        return true;
    }

    paths.iter().any(|path| {
        path.file_name()
            .and_then(|value| value.to_str())
            .map(|value| value == target_name)
            .unwrap_or(false)
    })
}

fn file_path_from_preview_url(raw_url: &str) -> Result<PathBuf, String> {
    let url = reqwest::Url::parse(raw_url.trim())
        .map_err(|_| "Preview file is not readable".to_string())?;
    if url.scheme() != "file" {
        return Err("Preview file is not readable".to_string());
    }

    let path = url
        .to_file_path()
        .map_err(|_| "Preview file is not readable".to_string())?;
    if path.exists() {
        Ok(path)
    } else {
        Err("Preview file is not readable".to_string())
    }
}

fn initial_bootstrap_state() -> BootstrapState {
    BootstrapState {
        active: false,
        manifest: None,
        stages: HashMap::new(),
        error: None,
        log: Vec::new(),
        started_at: None,
        completed_at: None,
        unsupported_platform: None,
    }
}

fn terminal_shell_command() -> (String, Vec<String>, String) {
    #[cfg(windows)]
    {
        let command = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
        let shell_name = PathBuf::from(&command)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("cmd.exe")
            .to_string();
        return (command, Vec::new(), shell_name);
    }

    #[cfg(not(windows))]
    {
        let configured_shell = std::env::var("SHELL").unwrap_or_default();
        let shell_path = if PathBuf::from(&configured_shell).is_absolute()
            && PathBuf::from(&configured_shell).exists()
        {
            configured_shell
        } else {
            ["/bin/zsh", "/bin/bash", "/bin/sh"]
                .iter()
                .find(|candidate| PathBuf::from(candidate).exists())
                .map(|value| value.to_string())
                .unwrap_or_else(|| "/bin/sh".to_string())
        };

        let shell_name = PathBuf::from(&shell_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("sh")
            .to_string();
        let args = if shell_name.contains("zsh") || shell_name.contains("bash") {
            vec!["-il".to_string()]
        } else {
            vec!["-i".to_string()]
        };

        (shell_path, args, shell_name)
    }
}

fn safe_terminal_cwd(cwd: Option<&str>) -> PathBuf {
    let fallback = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let candidate = cwd
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            let path = PathBuf::from(value);
            if path.is_absolute() {
                path
            } else {
                std::env::current_dir()
                    .unwrap_or_else(|_| fallback.clone())
                    .join(path)
            }
        })
        .unwrap_or_else(|| fallback.clone());

    match fs::metadata(&candidate) {
        Ok(metadata) if metadata.is_dir() => candidate,
        Ok(_) => candidate.parent().map(PathBuf::from).unwrap_or(fallback),
        Err(_) => fallback,
    }
}

fn configure_terminal_env(builder: &mut CommandBuilder) {
    let keys_to_remove = builder
        .iter_full_env_as_str()
        .filter_map(|(key, _)| {
            if key == "npm_config_prefix"
                || key.starts_with("npm_config_")
                || key.starts_with("npm_package_")
                || key == "NO_COLOR"
                || key == "FORCE_COLOR"
                || key == "COLORFGBG"
            {
                Some(key.to_string())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    for key in keys_to_remove {
        builder.env_remove(key);
    }

    builder.env("COLORTERM", "truecolor");
    let has_lc_ctype = builder
        .get_env("LC_CTYPE")
        .and_then(|value| value.to_str())
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    if !has_lc_ctype {
        builder.env("LC_CTYPE", "UTF-8");
    }
    builder.env("TERM", "xterm-256color");
    builder.env("TERM_PROGRAM", "Hermes");
    builder.env("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION"));
}

fn terminal_event_target(label: Option<&str>) -> &str {
    label
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("main")
}

fn terminal_channel(id: &str, suffix: &str) -> String {
    format!("hermes:terminal:{}:{}", id, suffix)
}

fn spawn_terminal_reader(
    app: AppHandle,
    id: String,
    mut reader: Box<dyn Read + Send>,
    terminal_sessions: Arc<StdMutex<HashMap<String, Arc<TerminalSession>>>>,
    session: Arc<TerminalSession>,
) {
    thread::spawn(move || {
        let mut buffer = [0u8; 8192];

        loop {
            if !session.alive.load(Ordering::Relaxed) {
                break;
            }

            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(length) => {
                    if session.alive.load(Ordering::Relaxed) {
                        let text = String::from_utf8_lossy(&buffer[..length]).to_string();
                        let _ = app.emit_to(
                            session.event_target.as_str(),
                            &terminal_channel(&id, "data"),
                            text,
                        );
                    }
                }
                Err(_) => break,
            }
        }

        let exit_status = session
            .child
            .lock()
            .ok()
            .and_then(|mut child| child.wait().ok());

        if session.exited.swap(true, Ordering::Relaxed) {
            let _ = terminal_sessions
                .lock()
                .map(|mut sessions| sessions.remove(&id));
            return;
        }

        let payload = if let Some(status) = exit_status {
            serde_json::json!({
                "code": status.exit_code(),
                "signal": status.signal().map(|value| value.to_string()),
            })
        } else {
            serde_json::json!({ "code": null, "signal": null })
        };

        let _ = app.emit_to(
            session.event_target.as_str(),
            &terminal_channel(&id, "exit"),
            payload,
        );
        let _ = terminal_sessions
            .lock()
            .map(|mut sessions| sessions.remove(&id));
    });
}

fn dispose_terminal_session_impl(session: &TerminalSession) {
    session.alive.store(false, Ordering::Relaxed);

    if let Ok(mut child) = session.child.lock() {
        let _ = child.kill();
    }
}

fn dispose_all_terminal_sessions_impl(state: &AppState) -> usize {
    let sessions = {
        let Ok(mut sessions) = state.terminal_sessions.lock() else {
            return 0;
        };
        sessions
            .drain()
            .map(|(_, session)| session)
            .collect::<Vec<_>>()
    };

    let count = sessions.len();
    for session in sessions {
        dispose_terminal_session_impl(session.as_ref());
    }

    count
}

fn spawn_backend_exit_monitor(app: AppHandle, mut child: std::process::Child) {
    thread::spawn(move || {
        let pid = child.id();
        if let Ok(status) = child.wait() {
            if let Ok(mut tracked_pid) = app.state::<AppState>().backend_pid.lock() {
                if tracked_pid.as_ref() == Some(&pid) {
                    *tracked_pid = None;
                }
            }
            let code = status.code();
            let signal = None::<String>;
            let _ = app.emit(
                "hermes:backend-exit",
                serde_json::json!({ "code": code, "signal": signal }),
            );
        }
    });
}

pub fn terminate_tracked_backend(state: &AppState) {
    let pid = state
        .backend_pid
        .lock()
        .ok()
        .and_then(|tracked_pid| *tracked_pid);

    let Some(pid) = pid else {
        return;
    };

    #[cfg(unix)]
    let _ = StdCommand::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status();

    #[cfg(windows)]
    let _ = StdCommand::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .status();

    if let Ok(mut tracked_pid) = state.backend_pid.lock() {
        if tracked_pid.as_ref() == Some(&pid) {
            *tracked_pid = None;
        }
    }
}

pub async fn stop_all_preview_file_watches(state: &AppState) {
    let _ = stop_all_preview_file_watches_impl(state).await;
}

pub fn dispose_all_terminal_sessions(state: &AppState) {
    let _ = dispose_all_terminal_sessions_impl(state);
}

fn find_free_port() -> Option<u16> {
    for port in 9120..9200 {
        if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    None
}

fn generate_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| rng.sample(rand::distributions::Alphanumeric) as char)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_PROCESS_ENV_LOCK: OnceLock<StdMutex<()>> = OnceLock::new();

    struct TempDirGuard {
        path: PathBuf,
    }

    impl TempDirGuard {
        fn new(label: &str) -> Self {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "hermes-desktop-tauri-{}-{}-{}",
                label,
                std::process::id(),
                stamp
            ));
            fs::create_dir_all(&path).expect("temp dir should be created");
            Self { path }
        }
    }

    impl Drop for TempDirGuard {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    struct CurrentDirGuard {
        previous: PathBuf,
    }

    impl CurrentDirGuard {
        fn enter(path: &Path) -> Self {
            let previous = std::env::current_dir().expect("cwd should be readable");
            std::env::set_current_dir(path).expect("cwd should be updated");
            Self { previous }
        }
    }

    impl Drop for CurrentDirGuard {
        fn drop(&mut self) {
            let _ = std::env::set_current_dir(&self.previous);
        }
    }

    struct EnvVarGuard {
        key: &'static str,
        previous: Option<std::ffi::OsString>,
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: std::ffi::OsString) -> Self {
            let previous = std::env::var_os(key);
            std::env::set_var(key, value);
            Self { key, previous }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            if let Some(previous) = &self.previous {
                std::env::set_var(self.key, previous);
            } else {
                std::env::remove_var(self.key);
            }
        }
    }

    fn run_git_test(args: &[&str], cwd: &Path) {
        let status = StdCommand::new("git")
            .args(args)
            .current_dir(cwd)
            .status()
            .expect("git command should start");
        assert!(status.success(), "git {:?} should succeed", args);
    }

    fn init_git_repo(path: &Path) {
        run_git_test(&["init"], path);
        run_git_test(&["config", "user.email", "tests@example.com"], path);
        run_git_test(&["config", "user.name", "Hermes Tests"], path);
        fs::write(path.join("README.md"), "hello\n").expect("repo seed file should be written");
        run_git_test(&["add", "README.md"], path);
        run_git_test(&["commit", "-m", "init"], path);
    }

    fn file_url_for(path: &Path) -> String {
        reqwest::Url::from_file_path(path)
            .expect("path should convert to file url")
            .to_string()
    }

    fn lock_test_process_env() -> std::sync::MutexGuard<'static, ()> {
        TEST_PROCESS_ENV_LOCK
            .get_or_init(|| StdMutex::new(()))
            .lock()
            .expect("test process env lock should acquire")
    }

    fn spawn_test_terminal_session() -> Arc<TerminalSession> {
        let pty_system = portable_pty::native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("test PTY should open");

        #[cfg(windows)]
        let builder = {
            let mut builder = CommandBuilder::new("cmd.exe");
            builder.args(["/C", "ping", "-n", "30", "127.0.0.1"]);
            builder
        };

        #[cfg(not(windows))]
        let builder = {
            let mut builder = CommandBuilder::new("/bin/sh");
            builder.args(["-c", "sleep 30"]);
            builder
        };

        let master = pair.master;
        let writer = master.take_writer().expect("test PTY writer should open");
        let child = pair
            .slave
            .spawn_command(builder)
            .expect("test PTY child should spawn");

        Arc::new(TerminalSession {
            master: StdMutex::new(master),
            child: StdMutex::new(child),
            writer: StdMutex::new(writer),
            event_target: "main".to_string(),
            alive: AtomicBool::new(true),
            exited: AtomicBool::new(false),
        })
    }

    #[test]
    fn token_preview_matches_desktop_behavior() {
        assert_eq!(token_preview(""), None);
        assert_eq!(token_preview("12345678"), Some("set".to_string()));
        assert_eq!(token_preview("123456789"), Some("...456789".to_string()));
    }

    #[test]
    fn normalize_remote_base_url_strips_query_hash_and_trailing_slash() {
        let normalized = normalize_remote_base_url("https://example.com/hermes/?foo=bar#frag")
            .expect("url should normalize");

        assert_eq!(normalized, "https://example.com/hermes");
    }

    #[test]
    fn parse_hermes_cli_info_extracts_version_and_project_root() {
        let info = parse_hermes_cli_info(
            "Hermes Agent v0.14.0 (2026.5.16)\nProject: /tmp/hermes-agent\nPython: 3.11.15\n",
        )
        .expect("cli info should parse");

        assert_eq!(info.version, "0.14.0");
        assert_eq!(info.project_root, Some(PathBuf::from("/tmp/hermes-agent")));
    }

    #[test]
    fn gateway_connection_serializes_with_camel_case_keys() {
        let value = serde_json::to_value(GatewayConnection {
            base_url: "http://127.0.0.1:9120".to_string(),
            token: "secret".to_string(),
            ws_url: "ws://127.0.0.1:9120/api/ws?token=secret".to_string(),
            mode: "local".to_string(),
            source: Some("local".to_string()),
            logs: vec!["[hermes] ready".to_string()],
            is_fullscreen: false,
            native_overlay_width: 144,
            window_button_position: Some(WindowButtonPosition { x: 24, y: 10 }),
        })
        .expect("gateway connection should serialize");

        assert_eq!(
            value.get("baseUrl").and_then(|v| v.as_str()),
            Some("http://127.0.0.1:9120")
        );
        assert_eq!(
            value.get("wsUrl").and_then(|v| v.as_str()),
            Some("ws://127.0.0.1:9120/api/ws?token=secret")
        );
        assert_eq!(value.get("source").and_then(|v| v.as_str()), Some("local"));
        assert_eq!(
            value
                .get("logs")
                .and_then(|v| v.as_array())
                .map(|v| v.len()),
            Some(1)
        );
        assert_eq!(
            value.get("nativeOverlayWidth").and_then(|v| v.as_i64()),
            Some(144)
        );
        assert!(value.get("base_url").is_none());
        assert!(value.get("ws_url").is_none());
    }

    #[test]
    fn preview_watch_serializes_with_expected_shape() {
        let value = serde_json::to_value(PreviewWatch {
            id: "watch-1".to_string(),
            path: "/tmp/index.html".to_string(),
        })
        .expect("preview watch should serialize");

        assert_eq!(value.get("id").and_then(|v| v.as_str()), Some("watch-1"));
        assert_eq!(
            value.get("path").and_then(|v| v.as_str()),
            Some("/tmp/index.html")
        );
    }

    #[test]
    fn preview_watch_matches_target_accepts_empty_paths_and_matching_names() {
        assert!(preview_watch_matches_target(&[], "index.html"));
        assert!(preview_watch_matches_target(
            &[PathBuf::from("/tmp/project/index.html")],
            "index.html"
        ));
        assert!(!preview_watch_matches_target(
            &[PathBuf::from("/tmp/project/other.html")],
            "index.html"
        ));
    }

    #[tokio::test]
    async fn stop_all_preview_file_watches_marks_flags_and_drains_state() {
        let state = AppState::new();
        let flag_a = Arc::new(AtomicBool::new(false));
        let flag_b = Arc::new(AtomicBool::new(false));

        {
            let mut watchers = state.preview_watches.lock().await;
            watchers.insert("watch-a".to_string(), flag_a.clone());
            watchers.insert("watch-b".to_string(), flag_b.clone());
        }

        let stopped = stop_all_preview_file_watches_impl(&state).await;

        assert_eq!(stopped, 2);
        assert!(flag_a.load(Ordering::Relaxed));
        assert!(flag_b.load(Ordering::Relaxed));
        assert!(state.preview_watches.lock().await.is_empty());
    }

    #[test]
    fn dispose_all_terminal_sessions_marks_sessions_dead_and_drains_state() {
        let state = AppState::new();
        let session = spawn_test_terminal_session();

        {
            let mut sessions = state
                .terminal_sessions
                .lock()
                .expect("terminal sessions should lock");
            sessions.insert("term-1".to_string(), session.clone());
        }

        let disposed = dispose_all_terminal_sessions_impl(&state);

        assert_eq!(disposed, 1);
        assert!(!session.alive.load(Ordering::Relaxed));
        assert!(state
            .terminal_sessions
            .lock()
            .expect("terminal sessions should lock")
            .is_empty());

        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        loop {
            let exited = session
                .child
                .lock()
                .expect("terminal child should lock")
                .try_wait()
                .expect("terminal child status should be readable");
            if exited.is_some() {
                break;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "disposed terminal child should exit promptly"
            );
            thread::sleep(Duration::from_millis(25));
        }
    }

    #[test]
    fn bootstrap_state_tracks_unsupported_platform_events() {
        let state = AppState::new();

        update_bootstrap_state_with_event(
            &state,
            &serde_json::json!({
                "type": "unsupported-platform",
                "platform": "darwin",
                "activeRoot": "/tmp/hermes-agent",
                "installCommand": "curl -fsSL install.sh | bash",
                "docsUrl": DESKTOP_DOCS_URL,
            }),
        );

        {
            let snapshot = state
                .bootstrap_state
                .lock()
                .expect("bootstrap state should lock");
            let unsupported = snapshot
                .unsupported_platform
                .as_ref()
                .expect("unsupported platform payload should be stored");
            assert!(!snapshot.active);
            assert_eq!(
                unsupported.get("platform").and_then(|value| value.as_str()),
                Some("darwin")
            );
            assert_eq!(
                unsupported
                    .get("activeRoot")
                    .and_then(|value| value.as_str()),
                Some("/tmp/hermes-agent")
            );
        }

        update_bootstrap_state_with_event(
            &state,
            &serde_json::json!({
                "type": "complete",
                "marker": {},
            }),
        );

        let snapshot = state
            .bootstrap_state
            .lock()
            .expect("bootstrap state should lock");
        assert!(snapshot.unsupported_platform.is_none());
        assert!(snapshot.error.is_none());
    }

    #[tokio::test]
    async fn read_dir_filters_hidden_entries_and_sorts_directories_first() {
        let temp = TempDirGuard::new("read-dir");
        fs::create_dir_all(temp.path.join(".git")).expect("hidden dir should be created");
        fs::create_dir_all(temp.path.join("node_modules")).expect("hidden dir should be created");
        fs::create_dir_all(temp.path.join("zeta")).expect("dir should be created");
        fs::create_dir_all(temp.path.join("alpha")).expect("dir should be created");
        fs::write(temp.path.join("b.txt"), "b").expect("file should be written");
        fs::write(temp.path.join("a.txt"), "a").expect("file should be written");

        let result = read_dir(temp.path.to_string_lossy().to_string())
            .await
            .expect("read_dir should succeed");

        let names = result
            .entries
            .into_iter()
            .map(|entry| entry.name)
            .collect::<Vec<_>>();
        assert_eq!(names, vec!["alpha", "zeta", "a.txt", "b.txt"]);
        assert_eq!(result.error, None);
    }

    #[tokio::test]
    async fn read_dir_returns_error_payload_for_missing_paths() {
        let temp = TempDirGuard::new("read-dir-missing");
        let result = read_dir(temp.path.join("missing").to_string_lossy().to_string())
            .await
            .expect("read_dir should return an error payload");

        assert!(result.entries.is_empty());
        assert_eq!(result.error.as_deref(), Some("ENOENT"));
    }

    #[tokio::test]
    async fn read_file_text_blocks_sensitive_env_files() {
        let temp = TempDirGuard::new("read-file-block");
        let blocked = temp.path.join(".env");
        fs::write(&blocked, "API_KEY=secret\n").expect("file should be written");

        let error = read_file_text(blocked.to_string_lossy().to_string())
            .await
            .expect_err("sensitive env files should be blocked");

        assert!(error.contains(".env files are blocked"));
    }

    #[tokio::test]
    async fn read_file_text_accepts_file_urls_and_resolves_real_paths() {
        let temp = TempDirGuard::new("read-file-url");
        let file_path = temp.path.join("notes.unknown");
        fs::write(&file_path, "hello from file url\n").expect("file should be written");

        let result = read_file_text(file_url_for(&file_path))
            .await
            .expect("file url should be readable");

        assert_eq!(result.path, file_path.to_string_lossy());
        assert_eq!(result.text, "hello from file url\n");
        assert_eq!(result.language.as_deref(), Some("text"));
        assert_eq!(result.truncated, Some(false));
    }

    #[tokio::test]
    async fn git_root_accepts_nested_file_paths() {
        let temp = TempDirGuard::new("git-root");
        fs::create_dir_all(temp.path.join(".git")).expect("git dir should be created");
        fs::create_dir_all(temp.path.join("nested")).expect("nested dir should be created");
        let file_path = temp.path.join("nested").join("main.rs");
        fs::write(&file_path, "fn main() {}\n").expect("file should be written");

        let root = git_root(file_path.to_string_lossy().to_string())
            .await
            .expect("git root should resolve");

        assert_eq!(root, Some(temp.path.to_string_lossy().to_string()));
    }

    #[tokio::test]
    async fn resource_buffer_from_url_decodes_percent_encoded_data_urls() {
        let (buffer, fallback_name) = resource_buffer_from_url(
            "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3Ehi%3C%2Fsvg%3E",
        )
        .await
        .expect("percent-encoded data urls should decode");

        assert_eq!(
            String::from_utf8(buffer).expect("svg bytes should be utf8"),
            "<svg xmlns=\"http://www.w3.org/2000/svg\">hi</svg>"
        );
        assert_eq!(fallback_name.as_deref(), Some("image.svg"));
    }

    #[test]
    fn parse_open_external_target_rejects_blank_and_malformed_urls() {
        assert!(parse_open_external_target("   ").is_err());
        assert!(parse_open_external_target("not a url").is_err());
    }

    #[test]
    fn parse_open_external_target_accepts_http_and_file_urls() {
        assert_eq!(
            parse_open_external_target("https://example.com/path").expect("http urls should parse"),
            OpenExternalTarget::Url("https://example.com/path".to_string())
        );

        let temp = TempDirGuard::new("open-external-target");
        let file_path = temp.path.join("notes.txt");
        fs::write(&file_path, "hello").expect("file should be written");
        let file_url = file_url_for(&file_path);

        assert_eq!(
            parse_open_external_target(&file_url).expect("file urls should parse"),
            OpenExternalTarget::File(file_path)
        );
    }

    #[test]
    fn start_preview_file_watcher_rejects_missing_directories() {
        let temp = TempDirGuard::new("preview-watch-start");
        let missing_dir = temp.path.join("missing");
        let (tx, _rx) = std::sync::mpsc::channel();

        let error = start_preview_file_watcher(&missing_dir, tx)
            .expect_err("missing directories should fail before registration");

        assert!(error.contains("Failed to watch preview file"));
    }

    #[test]
    fn safe_terminal_cwd_resolves_relative_file_paths_to_absolute_parent_dirs() {
        let _env_lock = lock_test_process_env();
        let temp = TempDirGuard::new("terminal-cwd");
        fs::create_dir_all(temp.path.join("nested")).expect("nested dir should be created");
        fs::write(temp.path.join("nested").join("script.sh"), "echo hi\n")
            .expect("file should be written");
        let _cwd = CurrentDirGuard::enter(&temp.path);

        let cwd = safe_terminal_cwd(Some("nested/script.sh"));

        let expected =
            fs::canonicalize(temp.path.join("nested")).expect("expected path should canonicalize");
        let actual = fs::canonicalize(cwd).expect("actual path should canonicalize");
        assert_eq!(actual, expected);
    }

    #[test]
    fn configure_terminal_env_strips_problematic_vars_and_preserves_existing_lc_ctype() {
        let mut builder = CommandBuilder::new("sh");
        builder.env("NO_COLOR", "1");
        builder.env("FORCE_COLOR", "0");
        builder.env("COLORFGBG", "15;0");
        builder.env("npm_config_prefix", "/tmp/npm");
        builder.env("npm_config_user_agent", "npm/test");
        builder.env("npm_package_name", "hermes");
        builder.env("LC_CTYPE", "zh_CN.UTF-8");

        configure_terminal_env(&mut builder);

        assert!(builder.get_env("NO_COLOR").is_none());
        assert!(builder.get_env("FORCE_COLOR").is_none());
        assert!(builder.get_env("COLORFGBG").is_none());
        assert!(builder.get_env("npm_config_prefix").is_none());
        assert!(builder.get_env("npm_config_user_agent").is_none());
        assert!(builder.get_env("npm_package_name").is_none());
        assert_eq!(
            builder.get_env("LC_CTYPE").and_then(|value| value.to_str()),
            Some("zh_CN.UTF-8")
        );
        assert_eq!(
            builder
                .get_env("COLORTERM")
                .and_then(|value| value.to_str()),
            Some("truecolor")
        );
        assert_eq!(
            builder.get_env("TERM").and_then(|value| value.to_str()),
            Some("xterm-256color")
        );
        assert_eq!(
            builder
                .get_env("TERM_PROGRAM")
                .and_then(|value| value.to_str()),
            Some("Hermes")
        );
    }

    #[test]
    fn configure_terminal_env_sets_utf8_lc_ctype_when_missing() {
        let mut builder = CommandBuilder::new("sh");
        builder.env_remove("LC_CTYPE");

        configure_terminal_env(&mut builder);

        assert_eq!(
            builder.get_env("LC_CTYPE").and_then(|value| value.to_str()),
            Some("UTF-8")
        );
    }

    #[test]
    fn resolve_hermes_cli_binary_falls_back_to_path() {
        let _env_lock = lock_test_process_env();
        let temp = TempDirGuard::new("hermes-cli-path");
        let bin_dir = temp.path.join("bin");
        fs::create_dir_all(&bin_dir).expect("bin dir should be created");
        let hermes = bin_dir.join("hermes");
        fs::write(&hermes, "#!/bin/sh\n").expect("stub hermes should be written");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let mut perms = fs::metadata(&hermes)
                .expect("stub hermes metadata should exist")
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&hermes, perms).expect("stub hermes should be executable");
        }

        let original_path = std::env::var_os("PATH").unwrap_or_default();
        let joined = std::env::join_paths(
            std::iter::once(bin_dir.clone()).chain(std::env::split_paths(&original_path)),
        )
        .expect("PATH should join");
        let _path = EnvVarGuard::set("PATH", joined);

        let resolved = resolve_hermes_cli_binary(&temp.path).expect("PATH fallback should resolve");

        assert_eq!(resolved, hermes);
    }

    #[test]
    #[cfg(not(windows))]
    fn resolve_hermes_cli_binary_falls_back_to_user_local_bin_when_path_is_missing_it() {
        let _env_lock = lock_test_process_env();
        let temp = TempDirGuard::new("hermes-cli-user-local");
        let home_dir = temp.path.join("home");
        let local_bin = home_dir.join(".local").join("bin");
        let empty_bin = temp.path.join("empty-bin");
        fs::create_dir_all(&local_bin).expect("local bin dir should be created");
        fs::create_dir_all(&empty_bin).expect("empty bin dir should be created");

        let hermes = local_bin.join("hermes");
        fs::write(&hermes, "#!/bin/sh\n").expect("stub hermes should be written");

        use std::os::unix::fs::PermissionsExt;

        let mut perms = fs::metadata(&hermes)
            .expect("stub hermes metadata should exist")
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&hermes, perms).expect("stub hermes should be executable");

        let _home = EnvVarGuard::set("HOME", home_dir.into_os_string());
        let _path = EnvVarGuard::set(
            "PATH",
            std::env::join_paths([empty_bin]).expect("PATH should join"),
        );

        let resolved = resolve_hermes_cli_binary(&temp.path.join("missing-root"))
            .expect("user-local hermes should resolve");

        assert_eq!(resolved, hermes);
    }

    #[test]
    fn manual_update_command_uses_current_checkout_branch_for_non_main_repos() {
        let temp = TempDirGuard::new("manual-update-branch");
        init_git_repo(&temp.path);
        run_git_test(&["checkout", "-b", "feature/gui-parity"], &temp.path);

        let command = manual_update_command(&temp.path);

        assert_eq!(command, "hermes update --branch feature/gui-parity");
    }

    #[test]
    fn posix_update_restart_fallback_payload_marks_backend_updated() {
        let payload = posix_update_restart_fallback_payload(Some(Path::new("/tmp/Hermes.app")));

        assert_eq!(
            payload.get("ok").and_then(|value| value.as_bool()),
            Some(true)
        );
        assert_eq!(
            payload
                .get("backendUpdated")
                .and_then(|value| value.as_bool()),
            Some(true)
        );
        assert_eq!(
            payload.get("rebuiltApp").and_then(|value| value.as_str()),
            Some("/tmp/Hermes.app")
        );
    }

    #[test]
    fn context_text_action_mode_matches_desktop_menu_fallbacks() {
        let empty = ContextMenuRequest::default();
        assert_eq!(
            context_text_action_mode(&empty, false),
            ContextTextActionMode::FallbackSelectAll
        );
        assert_eq!(
            context_text_action_mode(&empty, true),
            ContextTextActionMode::None
        );

        let selection = ContextMenuRequest {
            selection_text: "selected".to_string(),
            ..Default::default()
        };
        assert_eq!(
            context_text_action_mode(&selection, false),
            ContextTextActionMode::NonEditableSelection
        );

        let editable = ContextMenuRequest {
            is_editable: true,
            ..Default::default()
        };
        assert_eq!(
            context_text_action_mode(&editable, false),
            ContextTextActionMode::Editable
        );
    }

    #[test]
    fn context_menu_spellcheck_suggestions_match_electron_rules() {
        let non_editable = ContextMenuRequest {
            misspelled_word: Some("teh".to_string()),
            dictionary_suggestions: vec!["the".to_string()],
            ..Default::default()
        };
        assert!(context_menu_spellcheck_suggestions(&non_editable).is_empty());

        let editable = ContextMenuRequest {
            is_editable: true,
            misspelled_word: Some("teh".to_string()),
            dictionary_suggestions: vec![
                "the".to_string(),
                "tech".to_string(),
                "ten".to_string(),
                "tea".to_string(),
                "Ted".to_string(),
                "then".to_string(),
            ],
            ..Default::default()
        };
        assert_eq!(
            context_menu_spellcheck_suggestions(&editable),
            vec![
                "the".to_string(),
                "tech".to_string(),
                "ten".to_string(),
                "tea".to_string(),
                "Ted".to_string(),
            ]
        );
    }

    #[test]
    fn can_open_context_image_url_blocks_data_urls() {
        assert!(can_open_context_image_url(Some(
            "https://example.com/test.png"
        )));
        assert!(can_open_context_image_url(Some("  file:///tmp/test.png  ")));
        assert!(!can_open_context_image_url(Some(
            "data:image/png;base64,AAAA"
        )));
        assert!(!can_open_context_image_url(Some("   ")));
        assert!(!can_open_context_image_url(None));
    }

    #[test]
    fn parse_context_open_target_reuses_external_open_rules() {
        let temp = TempDirGuard::new("context-open-target");
        let file_path = temp.path.join("image.png");
        fs::write(&file_path, "png").expect("file should be written");
        let file_url = file_url_for(&file_path);

        assert_eq!(
            parse_context_open_target(Some(&file_url), true).expect("file urls should be accepted"),
            OpenExternalTarget::File(file_path)
        );
        assert_eq!(
            parse_context_open_target(Some("https://example.com/test.png"), true)
                .expect("http urls should be accepted"),
            OpenExternalTarget::Url("https://example.com/test.png".to_string())
        );
        assert!(parse_context_open_target(Some("data:image/png;base64,AAAA"), true).is_none());
        assert!(parse_context_open_target(Some("not a url"), false).is_none());
    }

    #[test]
    fn expand_user_path_matches_desktop_rules() {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

        assert_eq!(expand_user_path("~"), home);
        assert_eq!(
            expand_user_path("~/preview/index.html"),
            home.join("preview/index.html")
        );
    }

    #[test]
    fn normalize_preview_target_impl_normalizes_local_preview_hosts_and_ports() {
        let normalized = normalize_preview_target_impl("http://0.0.0.0:4173/nested/index.html", "")
            .expect("local preview urls should normalize");

        assert_eq!(normalized.kind, "url");
        assert_eq!(normalized.label, "127.0.0.1:4173/nested/index.html");
        assert_eq!(normalized.url, "http://127.0.0.1:4173/nested/index.html");
    }

    #[test]
    fn microphone_access_action_matches_desktop_permission_states() {
        assert_eq!(
            microphone_access_action(0),
            MicrophoneAccessAction::RequestSystemPrompt
        );
        assert_eq!(
            microphone_access_action(1),
            MicrophoneAccessAction::Return(false)
        );
        assert_eq!(
            microphone_access_action(2),
            MicrophoneAccessAction::Return(false)
        );
        assert_eq!(
            microphone_access_action(3),
            MicrophoneAccessAction::Return(true)
        );
        assert_eq!(
            microphone_access_action(99),
            MicrophoneAccessAction::Return(true)
        );
    }

    #[test]
    fn filename_from_url_matches_desktop_save_image_defaults() {
        assert_eq!(
            filename_from_url(
                "https://example.com/images/Hermes%20Logo.png?download=1",
                "image.png"
            ),
            "Hermes Logo.png"
        );
        assert_eq!(
            filename_from_url("https://example.com/images/latest", "image.webp"),
            "image.webp"
        );
        assert_eq!(filename_from_url("not a url", "image.gif"), "image.gif");
    }

    #[test]
    fn sanitize_link_title_filters_known_block_pages() {
        assert_eq!(sanitize_link_title("  Example Title  "), "Example Title");
        assert!(sanitize_link_title("Just a moment...").is_empty());
        assert!(sanitize_link_title("GetYourGuide - Error").is_empty());
    }

    #[test]
    fn terminal_event_target_matches_origin_window_rules() {
        assert_eq!(terminal_event_target(Some("preview")), "preview");
        assert_eq!(terminal_event_target(Some("  ")), "main");
        assert_eq!(terminal_event_target(None), "main");
    }

    #[test]
    fn dock_tile_file_url_uses_trailing_slash_like_electron() {
        let bundle = Path::new("/Applications/Hermes.app");

        assert_eq!(
            dock_tile_file_url(bundle),
            "file:///Applications/Hermes.app/"
        );
    }

    #[test]
    fn applications_bundle_target_points_at_canonical_system_applications_copy() {
        let bundle = Path::new("/Users/demo/Downloads/Hermes.app");

        assert_eq!(
            applications_bundle_target(bundle),
            PathBuf::from("/Applications/Hermes.app")
        );
    }

    #[test]
    fn resolve_timeout_ms_matches_desktop_fallback_behavior() {
        assert_eq!(
            resolve_timeout_ms(None, DEFAULT_FETCH_TIMEOUT_MS),
            DEFAULT_FETCH_TIMEOUT_MS
        );
        assert_eq!(
            resolve_timeout_ms(Some(0), DEFAULT_FETCH_TIMEOUT_MS),
            DEFAULT_FETCH_TIMEOUT_MS
        );
        assert_eq!(
            resolve_timeout_ms(Some(7_500), DEFAULT_FETCH_TIMEOUT_MS),
            7_500
        );
    }

    #[test]
    fn parse_session_rename_request_matches_patch_session_title_updates() {
        let request = ApiRequest {
            path: "/api/sessions/session_123".to_string(),
            method: Some("PATCH".to_string()),
            body: Some(serde_json::json!({ "title": "  hello   world  " })),
            timeout_ms: None,
        };

        let parsed = parse_session_rename_request(&request)
            .expect("session rename payload should be detected");

        assert_eq!(
            parsed,
            SessionRenameRequest {
                session_id: "session_123".to_string(),
                session_path: "/api/sessions/session_123".to_string(),
                title: "  hello   world  ".to_string(),
            }
        );
    }

    #[test]
    fn parse_session_rename_request_ignores_non_session_title_routes() {
        let request = ApiRequest {
            path: "/api/sessions/session_123/messages".to_string(),
            method: Some("PATCH".to_string()),
            body: Some(serde_json::json!({ "title": "hello" })),
            timeout_ms: None,
        };

        assert!(parse_session_rename_request(&request).is_none());
    }

    #[test]
    fn local_dashboard_command_args_do_not_pass_invalid_subcommand_flags() {
        assert_eq!(
            local_dashboard_command_args(9120),
            vec![
                "dashboard".to_string(),
                "--no-open".to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                "9120".to_string(),
            ]
        );
    }

    #[test]
    fn desktop_openapi_has_required_routes_checks_audio_and_session_patch_support() {
        let compatible = serde_json::json!({
            "paths": {
                "/api/audio/transcribe": { "post": {} },
                "/api/audio/speak": { "post": {} },
                "/api/sessions/{session_id}": { "patch": {} }
            }
        });
        assert!(desktop_openapi_has_required_routes(&compatible));

        let missing_audio = serde_json::json!({
            "paths": {
                "/api/audio/transcribe": { "post": {} },
                "/api/sessions/{session_id}": { "patch": {} }
            }
        });
        assert!(!desktop_openapi_has_required_routes(&missing_audio));
    }

    #[test]
    fn rename_title_fallback_collapses_whitespace_like_cli_storage() {
        assert_eq!(rename_title_fallback(""), "");
        assert_eq!(rename_title_fallback("   "), "");
        assert_eq!(rename_title_fallback("  hello   world  "), "hello world");
        assert_eq!(
            rename_title_fallback("line 1\nline 2\tline 3"),
            "line 1 line 2 line 3"
        );
    }

    #[test]
    fn parse_hermes_api_response_rejects_html_success_payloads() {
        let error = parse_hermes_api_response(
            "http://127.0.0.1:9120/api/status",
            reqwest::StatusCode::OK,
            Some("text/html"),
            "<!doctype html><html><body>missing</body></html>",
        )
        .expect_err("html success payloads should be rejected");

        assert_eq!(
            error,
            "Expected JSON from http://127.0.0.1:9120/api/status but got HTML (status 200). The endpoint is likely missing on the Hermes backend."
        );
    }

    #[test]
    fn parse_hermes_api_response_uses_status_reason_when_error_body_is_empty() {
        let error = parse_hermes_api_response(
            "http://127.0.0.1:9120/api/status",
            reqwest::StatusCode::NOT_FOUND,
            None,
            "",
        )
        .expect_err("error responses should be rejected");

        assert_eq!(error, "404: Not Found");
    }

    #[test]
    fn parse_hermes_api_response_returns_null_for_empty_success_bodies() {
        let value = parse_hermes_api_response(
            "http://127.0.0.1:9120/api/status",
            reqwest::StatusCode::NO_CONTENT,
            None,
            "",
        )
        .expect("empty success responses should resolve to null");

        assert_eq!(value, serde_json::Value::Null);
    }

    #[test]
    fn parse_titlebar_theme_payload_accepts_valid_hex_colors_only() {
        let valid = parse_titlebar_theme_payload(&serde_json::json!({
            "background": "#111111",
            "foreground": "#F7F7F7",
        }))
        .expect("valid hex colors should parse");
        assert_eq!(valid.background, "#111111");
        assert_eq!(valid.foreground, "#F7F7F7");

        assert!(parse_titlebar_theme_payload(&serde_json::json!({
            "background": "rgb(0,0,0)",
            "foreground": "#ffffff",
        }))
        .is_none());
        assert!(parse_titlebar_theme_payload(&serde_json::json!({
            "background": "#111111",
        }))
        .is_none());
    }

    #[test]
    fn titlebar_window_theme_tracks_overlay_contrast() {
        assert_eq!(
            titlebar_window_theme(&TitlebarThemePayload {
                background: "#111111".to_string(),
                foreground: "#f7f7f7".to_string(),
            }),
            tauri::Theme::Dark
        );

        assert_eq!(
            titlebar_window_theme(&TitlebarThemePayload {
                background: "#f7f7f7".to_string(),
                foreground: "#242424".to_string(),
            }),
            tauri::Theme::Light
        );
    }

    #[test]
    fn reveal_path_command_matches_platform_conventions() {
        let path = Path::new("/tmp/hermes/logs/desktop.log");
        let command = reveal_path_command(path);

        #[cfg(target_os = "macos")]
        assert_eq!(
            command,
            Some((
                "open".to_string(),
                vec!["-R".to_string(), path.to_string_lossy().to_string()],
            ))
        );

        #[cfg(target_os = "windows")]
        assert_eq!(
            command,
            Some((
                "explorer".to_string(),
                vec![format!("/select,{}", path.display())],
            ))
        );

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        assert_eq!(command, None);
    }
}

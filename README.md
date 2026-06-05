# hermes-desktop-tauri

[中文说明](./README.zh-CN.md)

hermes-desktop-tauri is a community port of Hermes Desktop from Electron to Tauri.

This project is not an attempt to turn Hermes Desktop into a different product. The aim is to keep the existing desktop workflow while replacing Electron's Chromium / Node runtime with Tauri + Rust. Compared with Electron, this combination usually means a smaller app, lower idle overhead, and a clearer split between the native desktop layer and the frontend.

In one local macOS build from this repository, the Tauri `.app` was about `30 MB`, while the corresponding Electron `.app` was about `313 MB`. That is only one measurement under the current build configuration, but the size gap is already quite visible.

> [!IMPORTANT]
> - The default connection mode is `local`
> - The app will try to reuse an existing local Hermes gateway first
> - If it needs to launch Hermes itself, it will first check common install locations for an existing Hermes CLI before showing install guidance
> - The early standalone-build startup failure where the background gateway never came up but the desktop app still fell through to the old GitHub script download path has been closed off in this build
> - This also reduces the old false negative where Hermes was already installed but the desktop app still told you to install it
> - In-app updates are now manual
> - `Check for updates` remains available in Settings, and `Update Hermes` only appears after you open the updates page yourself
> - The desktop app no longer polls for updates in the background or shows upgrade prompts automatically

## Status

This is already past the early migration stage. The current app builds, launches, connects to a local Hermes instance, and covers the main day-to-day workflows, including core chat, session switching, settings, file preview, the right-side terminal, image saving, native menus, and common desktop actions.

It is ready for continued development and everyday testing, but it should not yet be described as a perfect 1:1 replacement for the official Electron app. The remaining work is mostly in native edge cases and manual parity review, not large missing feature areas.

One small caveat worth calling out: microphone permission and device detection may still behave slightly differently from the Electron build on some platforms.

## First Launch and Connection Behavior

This Tauri build already does a fair amount of work around first launch and local connection handling.

- The default connection mode is `local`, rather than forcing a remote setup first.
- If a usable local Hermes gateway is already running, the app will try to reuse it.
- If the desktop app needs to start Hermes itself, it first looks for an existing Hermes CLI installation.
- Common install locations are detected automatically, including project-local `venv/.venv`, the system `PATH`, and common user-level install directories.

In practice, this improves one of the more annoying old failure modes: Hermes was already installed, but the desktop app still behaved as if it was missing. That case should be much less common in normal local setups now.

## Update Behavior

- `Check for updates` remains available in Settings
- `Update Hermes` is still available, but only inside the updates page after you open it yourself
- The desktop app no longer runs background update polling or automatic upgrade toasts

## What Works Today

- Local Hermes gateway startup and connection
- Core chat and session flows
- Main settings pages and key configuration actions
- File tree, file preview, and image loading
- Right-rail PTY terminal workflow
- Image saving, common clipboard actions, and external link opening
- Native app menus and context menus
- Update entry points, log entry points, and version reporting
- macOS first-launch `/Applications` migration and Dock pin behavior

## Stack

- React 19
- TypeScript
- Vite
- Tauri 2
- Rust
- `portable-pty`

## Local Development

### Prerequisites

- Node.js 20 or newer
- npm
- A working Rust toolchain
- The system dependencies required by Tauri on your platform
- A local Hermes installation

### Start the App

```bash
npm ci
npm run tauri:dev
```

The default development path is local-first. On launch, the app will try to connect to a local Hermes gateway; if Hermes is already installed and available on your machine, you usually do not need extra manual setup.

### Useful Commands

```bash
npm run build:check
npm run lint
npm run tauri:build
cd src-tauri && cargo test
```

## Project Layout

```text
src/            React app, routes, state, UI, bridge consumers
src-tauri/      Rust commands, native desktop behavior, Tauri config
public/         Static assets
MIGRATION_PLAN.md
                Current migration status, known differences, acceptance checklist
CONTRIBUTING.md Contributor guide
CODE_OF_CONDUCT.md
                Collaboration expectations for this repository
```

## Migration Notes

This repository is not trying to invent a new “Hermes-like” product. It is a migration project that stays close to the original desktop client wherever possible. When the original interaction model can be preserved, it should be preserved; where change is necessary, the focus is on handling Tauri-native differences cleanly.

## Contributing

Issues, pull requests, side-by-side testing, and parity review are all welcome. Before opening work, please read [CONTRIBUTING.md](./CONTRIBUTING.md) and [MIGRATION_PLAN.md](./MIGRATION_PLAN.md).

## Public Launch Notes

If you plan to use this directory as the initial public repository, start with [OPEN_SOURCE_RELEASE_CHECKLIST.md](./OPEN_SOURCE_RELEASE_CHECKLIST.md).

## Code of Conduct

Please treat this repository as a place for serious work done in a decent, human way. Be direct about the problem and measured in how you speak to people. The full policy lives in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

This project is released under the MIT License. The canonical license text is in [LICENSE](./LICENSE), with a Chinese reference translation in [LICENSE.zh-CN.md](./LICENSE.zh-CN.md).

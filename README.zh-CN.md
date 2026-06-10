# hermes-desktop-community

[English](./README.md)

这是 `hermes-desktop-community`，一个将 Hermes Desktop 从 Electron 迁移到 Tauri 的社区仓库。

这个项目并不是要把 Hermes Desktop 做成另一个产品，而是希望在保留原有桌面工作流的基础上，用 Tauri + Rust 替换 Electron 的 Chromium / Node 运行时。相比 Electron，这套组合通常包体更小、空闲占用更低，也让桌面原生层与前端层的分工更清晰。

在当前一次本地 macOS 构建中，Tauri `.app` 约为 `30 MB`，对应的 Electron `.app` 约为 `313 MB`。这只是当前构建配置下的一次实测结果，但体积差异已经足够直观。

> [!IMPORTANT]
> - 默认连接方式是 `local`
> - 应用会优先复用已经存在的本地 Hermes gateway
> - 如果需要自行拉起 Hermes，也会先在常见安装位置里查找已经存在的 Hermes CLI，再决定是否提示安装
> - 早期 standalone build 中那类“后台 gateway 没起来，桌面端却继续走旧 GitHub 脚本下载路径”的启动错误，已经在这版里收掉
> - 这也尽量减少了“明明已经安装 Hermes，桌面端却还提示安装”的误判
> - 应用内更新现已改为手动模式
> - 设置页保留 `Check for updates`，`Update Hermes` 只会在你主动打开更新页后出现
> - 桌面端不再后台轮询更新，也不再自动弹出升级提醒
> - 这个 Tauri 构建不会使用官方 Hermes Desktop 更新器，避免官方 Electron 产物覆盖当前 UI

## 项目状态

这个仓库已经过了早期迁移草稿阶段。当前版本可以独立编译、启动、连接本地 Hermes，并完成日常主流程，包括基础聊天、会话切换、设置、文件预览、右侧终端、图片保存、原生菜单和常见桌面操作。

它已经足够拿来继续开发和日常试用，但还没有到可以直接宣称“和官方 Electron 版 100% 完全等价”的阶段。剩下的工作主要在原生系统边界和逐页验收，不是大面积缺功能。

有一个小边界还是值得单独说明：在部分平台上，麦克风权限和设备识别的表现，和 Electron 版相比可能还会有轻微差异。

## 首次启动与连接策略

这版 Tauri 桌面端在首次启动和本地连接这件事上，已经做了不少处理。

- 默认连接策略是 `local`，不是强迫用户先配 remote
- 如果本机已经有可用的本地 Hermes gateway，应用会优先复用它
- 如果需要拉起本地 Hermes，桌面端会优先查找已经安装好的 Hermes CLI
- 常见安装路径会自动识别，包括项目内 `venv/.venv`、系统 `PATH`，以及常见的用户级安装目录

这会明显改善一种很烦人的老问题：明明已经装了 Hermes，桌面端却还把你当成没装。在常见的本地安装场景里，这类误提示现在应该会少很多。

## 更新方式

- 设置页里保留 `Check for updates`
- `Update Hermes` 仍然保留，但只会出现在你主动打开的更新页里
- 桌面端不再后台轮询更新，也不再自动弹升级提示
- 桌面端更新会检查当前 Tauri 仓库，并保持手动处理；这个构建不会走官方 Hermes Desktop 更新器

## 这个仓库现在能做什么

- 本地 Hermes gateway 连接与启动
- 基础聊天与会话流
- 设置页主结构与主要配置操作
- 文件树、文件预览、图片读取
- 右侧终端 PTY 主链路
- 图片保存、剪贴板常用操作、外链打开
- 原生应用菜单与右键菜单
- 更新入口、日志入口、版本信息
- macOS 首次启动时的 `/Applications` 迁移和 Dock pin 逻辑

## 技术栈

- React 19
- TypeScript
- Vite
- Tauri 2
- Rust
- `portable-pty`

## 本地开发

### 环境要求

- Node.js 20 或更高版本
- npm
- Rust 工具链
- Tauri 官方文档要求的系统依赖
- 本地 Hermes 安装环境

### 启动开发环境

```bash
npm ci
npm run tauri:dev
```

默认开发链路面向本地 Hermes。应用启动后会优先尝试连接本地 gateway；如果你的 Hermes 已经安装并可用，通常不需要额外手动配置。

### 常用命令

```bash
npm run build:check
npm run lint
npm run tauri:build
cd src-tauri && cargo test
```

## 项目结构

```text
src/            React app, routes, state, UI, bridge consumers
src-tauri/      Rust commands, native desktop behavior, Tauri config
public/         Static assets
.github/        CI 工作流与 issue / PR 模板
```

## 迁移说明

这个仓库不是重写一个“长得像 Hermes 的新产品”，而是尽量沿着原版桌面客户端的功能边界去迁移。能直接复用交互结构和产品语义的地方，尽量不发散；需要改造的地方，优先解决 Tauri 原生层差异。

## 协作方式

欢迎提 issue、提 PR、做对照测试，也欢迎专门帮忙做 Electron 与 Tauri 的逐页验收。

## 开源协议

本项目采用 MIT 协议发布。正式协议文本见 [LICENSE](./LICENSE)，中文对照说明见 [LICENSE.zh-CN.md](./LICENSE.zh-CN.md)。

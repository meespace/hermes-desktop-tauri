# Hermes Desktop Electron -> Tauri Migration Plan

_Last updated: 2026-06-06_

## 这份文档是给谁看的 / Who This Document Is For

中文：

这不是一份早期排工时的内部草稿了。现在这份文档主要给三类人看：

- 第一次来到仓库、想判断项目成熟度的人
- 想帮忙一起补 parity 的协作者
- 需要知道“现在到底还差什么”的维护者

English:

This is no longer an internal early-stage estimate. At this point, the document is mainly for three kinds of readers:

- people arriving at the repository for the first time and trying to judge project maturity
- contributors who want to help close the remaining parity gaps
- maintainers who need a clear answer to “what is still left”

## 项目目标 / Project Goal

中文：

这个仓库的目标不是做一个“长得像 Hermes 的新桌面应用”。目标一直都很明确：把原来的 Electron 桌面客户端迁到 Tauri，同时尽量保留原版的使用逻辑、页面结构、功能边界和桌面端行为。

English:

The goal of this repository is not to create a new desktop app that merely resembles Hermes. The goal has always been straightforward: move the original Electron desktop client to Tauri while preserving the original workflows, page structure, feature boundaries, and desktop behavior as closely as practical.

## 当前状态 / Current Status

中文：

当前迁移已经完成主干，不再属于“只有框架、没有内容”的阶段。

- 应用可以独立编译和启动
- 本地 Hermes 连接链路已经打通
- 聊天、会话、设置、文件预览、终端、图片保存、原生菜单等主流程已经落地
- 应用内更新已经调整为手动触发：设置页保留检查入口，更新按钮只在用户主动打开更新页后出现
- 当前剩余工作主要集中在原生边界收口和逐页验收

English:

The migration has already crossed the “shell only” phase.

- the app builds and launches on its own
- the local Hermes connection path is in place
- core workflows such as chat, sessions, settings, file preview, terminal, image saving, and native menus are already working
- in-app updates are now manual: Settings still exposes the check entry point, and the update button only appears after the user opens the updates page
- the remaining work is mostly about native edge-case cleanup and page-by-page acceptance review

## 已验证结果 / Verified Results

中文：

- `npm run build:check` 通过
- `cargo test` 通过（47 个测试）

English:

- `npm run build:check` passes
- `cargo test` passes (47 tests)

## 覆盖范围摘要 / Coverage Summary

### 已基本完成的部分 / Areas That Are Largely In Place

中文：

- 本地 gateway 启动与连接
- 基础聊天与会话主流程
- 设置页主结构
- 文件树与文件预览
- 右侧终端 PTY
- 图片保存与剪贴板常用操作
- 原生菜单与右键菜单
- 日志、版本信息、更新入口
- macOS 首次启动迁移逻辑

English:

- local gateway startup and connection
- core chat and session flows
- the main settings structure
- file tree and file preview
- right-rail PTY terminal
- image saving and common clipboard actions
- native app menus and context menus
- logs, version reporting, and update entry points
- macOS first-launch migration behavior

### 还在继续收口的部分 / Areas Still Being Tightened

中文：

- 非 macOS 平台的麦克风权限语义
- 原生对话框和系统控件细节
- 打包发布场景下的更新验收
- 二级页面、弹窗和异常路径的最后一轮对照

English:

- microphone permission semantics outside macOS
- fine detail in native dialogs and system controls
- update validation in packaged release scenarios
- the last round of review for secondary pages, modals, and error paths

## 已知差异清单 / Known Differences

中文：

下面这些项目不会妨碍你理解仓库状态，但它们也是当前不能直接宣称“100% 完全一致”的原因：

1. 麦克风权限
   目前 macOS 的权限请求链路已经落地；Windows 和 Linux 侧还没有完全复刻 Electron 的系统语义。

2. 原生菜单与系统对话框
   行为已经很接近，但 Tauri 和 Electron 的原生实现天然不同，细节仍然要靠人工逐项对照。

3. 更新路径
   开发态和源码 checkout 场景已经可用，但最终仍需按真实打包产物去验收发布链路。

4. 冷门路径
   主流程已经通了，但少量低频弹窗、异常提示、平台特定边界仍需要继续覆盖。

English:

The items below do not change the overall shape of the project, but they are the reason this repository should not yet be described as a perfect 100% match:

1. Microphone permissions
   The macOS permission path is implemented, but Windows and Linux do not yet reproduce Electron’s system-level semantics exactly.

2. Native menus and system dialogs
   The behavior is already close, but Tauri and Electron are different native stacks, so the finer points still need manual review.

3. Update path
   The development and source-checkout path works, but the final release flow still needs to be validated against real packaged builds.

4. Lower-frequency paths
   The main workflows are in place, but some less common modals, error messages, and platform-specific edges still need final coverage.

## 协作原则 / Collaboration Rules for This Migration

中文：

如果你准备往这个方向继续补，请默认遵守下面三条：

1. 先补 parity，再谈发散功能。
2. 如果原版已有明确行为，优先对齐原版，而不是“顺手做成自己更喜欢的样子”。
3. 一次尽量只收一类差异，这样更容易验收，也更不容易把判断搞乱。

English:

If you want to keep pushing the migration forward, please assume these three rules:

1. parity work comes before feature drift
2. if the original app has a clear behavior, align to it before improving it into something else
3. try to close one category of difference at a time so review stays simple and the result stays easy to judge

## 验收 Checklist / Acceptance Checklist

### A. 主流程验收 / Core Workflow Checklist

- [ ] 应用冷启动正常
- [ ] 本地 Hermes 自动连接正常
- [ ] 新建聊天、继续聊天、切换会话正常
- [ ] 设置页主要配置项可读可写
- [ ] 文件树可展开、可预览、可切换
- [ ] 右侧终端可启动、输入、缩放、关闭
- [ ] 图片保存、复制、外链打开行为正常

- [ ] app cold start works
- [ ] local Hermes auto-connect works
- [ ] new chat, resume chat, and session switching work
- [ ] key settings can be read and written
- [ ] the file tree expands, previews, and switches correctly
- [ ] the right-side terminal can start, accept input, resize, and close
- [ ] image save, copy, and external-link behaviors work

### B. 一致性验收 / Parity Checklist

- [ ] 页面层级与 Electron 版一致
- [ ] 主要弹窗与 Electron 版一致
- [ ] 右键菜单项与 Electron 版一致
- [ ] 文件预览与终端主链路和 Electron 版一致
- [ ] 常见错误提示不会出现明显语义偏差

- [ ] page hierarchy matches the Electron app
- [ ] main modals match the Electron app
- [ ] context menu items match the Electron app
- [ ] file preview and terminal workflows match the Electron app
- [ ] common error messages do not drift in obvious ways

### C. 原生边界验收 / Native Edge Checklist

- [ ] macOS 首次启动迁移逻辑正常
- [ ] 原生菜单快捷键可用
- [ ] 路径选择与保存对话框行为正常
- [ ] 麦克风权限在目标平台上符合预期
- [ ] 打包后应用能正常启动和连接

- [ ] macOS first-launch migration works
- [ ] native menu shortcuts work
- [ ] path picker and save dialog behavior is correct
- [ ] microphone permission behavior matches expectations on the target platform
- [ ] packaged builds launch and connect correctly

## 下一阶段重点 / What Matters Next

中文：

下一阶段不需要再重新铺一遍大框架。更重要的是：

- 做逐页对照
- 把剩余原生差异收干净
- 用打包产物做真实验收
- 持续补回归测试

English:

The next phase does not need another large architecture pass. What matters now is:

- page-by-page comparison work
- cleaning up the remaining native differences
- validating real packaged artifacts
- continuing to add regression tests

## 完成标准 / Definition of Done

中文：

对于这个仓库来说，“完成”不应该只是“功能大概能用”。更合理的完成标准是：

- 主流程稳定可用
- 和 Electron 版的差异有清晰记录
- 已知差异足够少，而且都能被解释
- 新协作者进来之后，知道该从哪里开始补

English:

For this repository, “done” should mean more than “the main feature sort of works.” A better definition is:

- the main workflows are stable
- differences from the Electron app are clearly documented
- the remaining differences are few enough to explain one by one
- a new contributor can enter the project and know where to start helping

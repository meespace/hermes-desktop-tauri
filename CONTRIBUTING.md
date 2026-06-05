# Contributing / 参与贡献

## 先说一句 / A Quick Note

中文：

欢迎来帮忙。这个仓库最需要的不是“很炫的新点子”，而是稳定、细致、能把 Electron 和 Tauri 差异一点点收平的改动。

English:

Thanks for stopping by. What this repository needs most is not flashy new ideas, but steady, careful work that closes the gap between the Electron app and the Tauri app one detail at a time.

## 这个项目欢迎什么样的贡献 / What Kind of Contributions Help Most

中文：

最有价值的贡献通常是下面几类：

- 修复 Tauri 版里的明确 bug
- 收敛和 Electron 版不一致的行为
- 完善原生系统边界，比如菜单、对话框、权限、路径处理
- 补测试，特别是桥接层、Rust commands 和异常路径
- 补双语文档，让仓库更容易被外部协作者接手

English:

The most useful contributions usually fall into one of these buckets:

- Fixing a clear bug in the Tauri app
- Tightening behavior that still differs from the Electron app
- Improving native edge cases such as menus, dialogs, permissions, or path handling
- Adding tests, especially around the bridge, Rust commands, and error paths
- Improving bilingual documentation so outside contributors can get productive faster

## 提交前先确认 / Before You Start

中文：

开始做之前，建议先看这两个文件：

- [README.md](./README.md)
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)

如果你准备做的是一致性相关工作，请先确认：

- 这是在补原版已有能力，还是在发散做新功能
- 这个改动会不会改变原本已经稳定的主链路
- 这个差异是否已经在迁移文档里记录过

English:

Before opening work, please read:

- [README.md](./README.md)
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)

If your change is parity-related, please check:

- Are you restoring an existing capability from the original app, or inventing a new one?
- Could this change disturb a workflow that is already stable?
- Is the difference already documented in the migration notes?

## 本地开发 / Local Setup

```bash
npm ci
npm run tauri:dev
```

如果你只想做静态检查或回归验证：

```bash
npm run build:check
npm run lint
cd src-tauri && cargo test
```

If you only want to run validation:

```bash
npm run build:check
npm run lint
cd src-tauri && cargo test
```

## 改动建议 / Working Style

中文：

- 尽量做小而清楚的提交
- 一个 PR 最好只解决一类问题
- 如果是 parity 修复，描述里请写清楚“原版怎么表现、现在怎么表现、你改完以后怎么表现”
- 公共文档优先保持中英双语
- 能补测试就补测试，尤其是桥接层和 Rust command

English:

- Prefer small, clear changes
- A pull request should ideally solve one kind of problem
- For parity work, explain how the original app behaves, how the current app behaves, and what the new behavior will be after the change
- Public-facing docs should stay bilingual whenever practical
- Add tests when you can, especially for the bridge layer and Rust commands

## Issue 怎么提更有效 / How to Open a Useful Issue

中文：

一个好 issue 不需要写很长，但最好把下面这些信息说清楚：

- 你在什么系统上复现的
- 你用的是开发态还是打包态
- 本地 Hermes 还是远端配置
- 复现步骤
- 预期结果
- 实际结果
- 如果方便，补一张截图或录屏

English:

A good issue does not need to be long, but it should be clear about:

- your operating system
- whether you reproduced it in dev mode or a packaged build
- whether you used a local Hermes setup or a remote config
- steps to reproduce
- expected behavior
- actual behavior
- a screenshot or short screen recording, if helpful

## Pull Request 建议 / Pull Request Notes

中文：

PR 描述里最好至少包含这几项：

- 这次改动解决了什么
- 改动范围
- 有没有影响已有行为
- 你做了哪些验证
- 如果是 UI 或原生行为改动，有没有对照 Electron 版

English:

Please include at least these points in a pull request:

- what the change fixes
- the scope of the change
- whether it affects any existing behavior
- what validation you ran
- whether you compared the result against the Electron app for UI or native behavior changes

## 我们暂时不鼓励的改动 / Changes We Are Not Prioritizing Right Now

中文：

目前不太鼓励下面这些方向：

- 和原版产品方向无关的大改版
- 只为“看起来更酷”而做的 UI 重做
- 没有明确问题背景的大面积重构
- 会让 parity 判断变难的行为发散

English:

These are not priorities right now:

- large redesigns unrelated to the original product direction
- UI overhauls done only to make things look cooler
- wide refactors without a clear problem to solve
- behavior drift that makes parity harder to judge

## 文档要求 / Documentation Expectations

中文：

如果你新增的是仓库级文档、协作说明、迁移说明、验收说明，默认请补中英双语。技术注释和测试文件不用强行双语，但对外文档尽量保持一致。

English:

If you add repository-level docs, contribution notes, migration notes, or acceptance docs, please default to bilingual Chinese and English. Code comments and test files do not need forced bilingual treatment, but public project docs should stay consistent.

## 最后 / Finally

中文：

这里欢迎认真、细心、能一起把事情做完的人。比起“出手很猛”，这个仓库更需要“判断稳、收尾干净”。

English:

This is a good place for careful people who like finishing work properly. More than bold swings, this repository benefits from steady judgment and clean follow-through.

# 开源首发检查清单

[English](./OPEN_SOURCE_RELEASE_CHECKLIST.md)

这份清单是给“第一次把这个目录公开到 GitHub”用的。

它不讨论产品方向，只做两件事：

- 帮你确认这份目录是不是适合直接首发
- 帮你在真正 push 之前把最容易漏掉的步骤过一遍

## 当前这份目录已经做过的检查

以下项目已经在这份备份目录上做过一次本地确认：

- `npm ci` 通过
- `npm run build:check` 通过
- `npm run tauri:build` 通过
- `node_modules`、`dist`、`src-tauri/target` 已清理
- README、迁移说明、贡献说明、行为准则、许可证都已经在目录里
- 根目录 `.gitignore` 已补齐常见构建缓存、`.env` 和 Tauri 生成物规则
- 做过一轮基础敏感信息扫描，没有发现明显的密钥、私钥或本地 `.env` 文件

有一个正常的“误命中”需要说明：

- 源码里有 Slack token 的占位示例，比如 `xoxb-...`
- 这些是界面提示文案，不是真实密钥

## 首次公开前，建议你再手动确认一次

### 1. 仓库名称和对外表述

- GitHub 仓库名是否确定
- README 第一段是否就是你想公开对外说的话
- 中英文 README 是否都保持当前版本

### 2. 截图和首发内容

- 是否准备好 3 到 5 张核心截图
- 是否要把公众号文章里的几张图同步到 README 或 Release 页面
- 是否要在首发说明里强调 `local` 优先和手动更新策略

### 3. 仓库元信息

当前目录已经补了基础元信息，但下面这几项最好在 GitHub 仓库建好之后再回填：

- `package.json` 如果你想补 `homepage`、`repository`、`bugs`
- `src-tauri/Cargo.toml` 如果你想补正式仓库地址
- README 里的仓库链接、发布页链接、截图链接

### 4. 首发前的最后一轮验证

建议在真正 push 前，再用这份目录跑一次：

```bash
npm ci
npm run build:check
npm run tauri:build
```

如果你准备上传首个可下载安装包，也建议顺手确认：

- App 名称
- 图标
- DMG 名称
- 首次启动流程
- 本地 Hermes 自动识别和连接

## Git 初始化建议

如果你准备用这份目录直接初始化一个新仓库，可以按这个顺序来：

```bash
cd /path/to/hermes-desktop-tauri
git init
git checkout -b main
git add .
git commit -m "Initial public release"
git remote add origin <your-github-repo-url>
git push -u origin main
```

如果你想先看哪些文件会被提交，可以在 `git add .` 之前先跑：

```bash
git status --short
```

## 建议首发时一起带上的内容

- `README.md`
- `README.zh-CN.md`
- `MIGRATION_PLAN.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `LICENSE.zh-CN.md`

这些文件已经都在目录里了。

## 现在这份目录更适合公开的地方

- 目录已经是干净源码状态，不带依赖和构建产物
- 贡献说明和迁移说明已经足够支撑外部协作者理解项目
- 已补基础 issue / PR 模板
- 已补开源首发检查清单，后续你自己回看也方便

## 还可以再做，但不是这次必须做的

- 在 GitHub 仓库页面补 Release
- 放几张实际运行截图
- 补一份 `SECURITY.md`
- 补 GitHub Actions 做自动构建或静态检查

这些不是首发必需项，可以后面慢慢补。

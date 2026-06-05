# Open-Source Launch Checklist

[中文说明](./OPEN_SOURCE_RELEASE_CHECKLIST.zh-CN.md)

This checklist is for the first public GitHub release of this directory.

It is meant to do two simple jobs:

- confirm that this snapshot is clean enough to publish
- walk through the last practical steps before the first push

## What Has Already Been Checked In This Snapshot

The following items have already been verified locally against this backup directory:

- `npm ci` passes
- `npm run build:check` passes
- `npm run tauri:build` passes
- `node_modules`, `dist`, and `src-tauri/target` have been removed
- the repository already includes README files, migration notes, contribution notes, code of conduct, and license files
- the root `.gitignore` has been tightened for common build caches, `.env` files, and Tauri-generated output
- one basic secret scan was run and did not find an obvious real key, private key, or local `.env` file

One normal false positive is worth calling out:

- the source includes Slack token examples such as `xoxb-...`
- those are UI placeholder strings, not real credentials

## What You Should Still Confirm Before The First Public Push

### 1. Repository Naming and Framing

- confirm the final GitHub repository name
- confirm that the opening README copy is exactly how you want to describe the project in public
- keep both README files aligned

### 2. Screenshots and Launch Material

- prepare 3 to 5 core screenshots
- decide whether the WeChat article screenshots should also appear in the README or the first GitHub release
- decide whether you want to highlight the local-first connection path and manual update policy in the launch copy

### 3. Repository Metadata

This directory already includes the basics, but these fields are best filled in after the real GitHub repository exists:

- `package.json` fields such as `homepage`, `repository`, and `bugs`
- the canonical repository URL in `src-tauri/Cargo.toml`
- README links to the repository, releases, and hosted screenshots

### 4. Final Validation

Before the first push, it is still worth running this once more from this directory:

```bash
npm ci
npm run build:check
npm run tauri:build
```

If you plan to attach a first downloadable build, also confirm:

- app name
- icon
- DMG name
- first-launch behavior
- local Hermes detection and connection

## Suggested Git Initialization Flow

If you want to turn this directory into a fresh repository directly, this order is a good default:

```bash
cd /path/to/hermes-desktop-tauri
git init
git checkout -b main
git add .
git commit -m "Initial public release"
git remote add origin <your-github-repo-url>
git push -u origin main
```

If you want to inspect the exact file set first, run this before `git add .`:

```bash
git status --short
```

## Files Worth Shipping In The First Public Commit

- `README.md`
- `README.zh-CN.md`
- `MIGRATION_PLAN.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `LICENSE.zh-CN.md`

Those files are already present in this directory.

## Why This Snapshot Is Closer To Public-Ready

- it is now back to a clean source-only state
- the contribution and migration docs are already strong enough for outside collaborators
- basic issue and pull-request templates are included
- the launch checklist itself is included for future maintenance

## Nice To Add Later, But Not Required For First Launch

- a GitHub Release page
- a few real product screenshots in the README
- a `SECURITY.md`
- GitHub Actions for build or validation automation

Those can wait until after the first public push.

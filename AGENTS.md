# AGENTS.md

Work style: telegraph; noun-phrases ok; drop grammar;

Short guide for AI agents in this repo. Prefer progressive loading: start with the root README, then package READMEs as needed.

## What is HAPI?

Local-first platform for running AI coding agents (Claude Code, Codex, Gemini) with remote control via web/phone. CLI wraps agents and connects to hub; hub serves web app and handles real-time sync.

## Repo layout

```
cli/     - CLI binary, agent wrappers, runner daemon
hub/     - HTTP API + Socket.IO + SSE + Telegram bot
web/     - React PWA for remote control
shared/  - Common types, schemas, utilities
docs/    - VitePress documentation site
website/ - Marketing site
```

Bun workspaces; `shared` consumed by cli, hub, web.

## Architecture overview

```
┌─────────┐  Socket.IO   ┌─────────┐   SSE/REST   ┌─────────┐
│   CLI   │ ──────────── │   Hub   │ ──────────── │   Web   │
│ (agent) │              │ (server)│              │  (PWA)  │
└─────────┘              └─────────┘              └─────────┘
     │                        │                        │
     ├─ Wraps Claude/Codex    ├─ SQLite persistence   ├─ TanStack Query
     ├─ Socket.IO client      ├─ Session cache        ├─ SSE for updates
     └─ RPC handlers          ├─ RPC gateway          └─ assistant-ui
                              └─ Telegram bot
```

**Data flow:**
1. CLI spawns agent (claude/codex/gemini), connects to hub via Socket.IO
2. Agent events → CLI → hub (socket `message` event) → DB + SSE broadcast
3. Web subscribes to SSE `/api/events`, receives live updates
4. User actions → Web → hub REST API → RPC to CLI → agent

## Reference docs

- `README.md` - User overview, quick start
- `cli/README.md` - CLI commands, config, runner
- `hub/README.md` - Hub config, HTTP API, Socket.IO events
- `web/README.md` - Routes, components, hooks
- `docs/guide/` - User guides (installation, how-it-works, FAQ)

## Shared rules

- No backward compatibility: breaking old formats freely
- TypeScript strict; no untyped code
- Bun workspaces; run `bun` commands from repo root
- Path alias `@/*` maps to `./src/*` per package
- Prefer 4-space indentation
- Zod for runtime validation (schemas in `shared/src/schemas.ts`)
- Web 基础橙色统一使用 `var(--app-orange-base)`（定义在 `web/src/index.css`，当前值 `#f59e0b`）；新增橙色 UI 时必须复用该 token

## Web notes

Current web shape; keep this section updated when layout/navigation model shifts.

### Current layout model

- Web now behaves like a workspace-style single app shell, not a set of isolated pages.
- Primary workspace tabs: `sessions` and `scheduled`.
- Workspace state persisted in `localStorage` key `hapi:workspace-state`.
- Session subviews inside workspace: `chat`, `files`, `terminal`.
- Workspace overlays: `none`, `settings`, `newSession`.
- Route layer still exposes compat URLs: `/sessions`, `/sessions/$sessionId`, `/sessions/$sessionId/files`, `/sessions/$sessionId/terminal`, `/sessions/$sessionId/file`, `/sessions/new`, `/scheduled`.
- Treat router URLs as deep-link/compat surface; real UI state often comes from `web/src/lib/workspace-store.ts`.

### Current shell behavior

- Main app bootstrap in `web/src/App.tsx`.
- App startup does: Telegram `ready()`/`expand()`, `initializeTheme()`, auth-source detection, auth/bind flow, SSE subscription, visibility reporting, push notification prompt/subscription, toast container, install prompt.
- On hub/base URL change, app clears TanStack Query cache and resets first-connect sync state.
- SSE connect invalidates session queries and refreshes latest messages for selected session.
- `Ready for input` toast should become system notification only when page not actively focused.

### Current desktop/mobile layout

- Desktop layout has resizable left sidebar; minimum width `375px`; width persisted in local storage from router shell.
- Desktop can collapse sidebar into icon strip; collapsed strip still exposes tab switcher plus header utility actions.
- Widescreen mode persisted in `localStorage` key `hapi:widescreen`; used for session detail area density/layout.
- Mobile/narrow mode behaves like drill-down panels: list/index hidden while detail/overlay visible.
- Telegram app suppresses some native web chrome, especially session header rendering.

### Current header/layout components

- `web/src/components/SessionHeader.tsx`: session title row + host/path/time metadata row; hidden in Telegram.
- `web/src/components/HeaderActionGroup.tsx`: shared header action cluster for theme/settings/new session/quick new/files/terminal/widescreen.
- `web/src/components/PageHeaderUtilityControls.tsx`: shared theme/language/settings controls path; prefer extending here instead of duplicating header utility buttons.
- `web/src/components/ScheduledTaskActionMenu.tsx`: floating anchored action menu for scheduled tasks; handles viewport-aware positioning, outside click, escape close, first-item focus.

### Current scheduled tasks UI

- Scheduled tasks are first-class top-level workspace tab, not secondary settings content.
- Scheduled pane has grouped task list + task detail + run detail selection model.
- Search, collapsed machine groups, selected task/run, and edit/delete flows live in `web/src/router.tsx` shell logic.
- If changing scheduled interactions, inspect both `ScheduledTaskActionMenu` and workspace selection helpers.

### Theme switching pitfall

- Theme switching in web relies on immediate CSS variable swap via `data-theme`; avoid adding `transition-colors`, `transition-all`, or other color/background/border transitions to theme-sensitive controls unless user explicitly wants delayed animation.
- Common failure mode: newly added sidebar/header/icon buttons look one beat slower than the rest of the page during black/white theme toggle. Root cause usually not state lag; color transition animating old -> new theme values.
- High-risk spots: collapsed sidebar buttons, floating action buttons, header utility controls, compact icon-only controls, newly introduced reusable button classes.
- Prefer no color transition for controls using `var(--app-bg)`, `var(--app-fg)`, `var(--app-hint)`, `var(--app-border)`, `var(--app-divider)`, `var(--app-secondary-bg)`, `var(--app-subtle-bg)`.
- If motion needed, prefer transform/opacity animation; do not animate theme token changes by default.
- When adding new themed component, manually verify theme toggle sync: whole page + component should switch in the same frame, no delayed recolor.

### Current web working heuristics

- Before changing layout, read `web/src/router.tsx` first; much of the shell composition lives there, not in route leaf files.
- Before adding new header buttons, check whether `HeaderActionGroup` or `PageHeaderUtilityControls` should be extended instead.
- Before assuming a route means a full page, verify whether it is a compat wrapper around workspace state.
- For session-related UI, keep parity across chat/files/terminal subviews.

## Common commands (repo root)

```bash
bun typecheck           # All packages
bun run test            # cli + hub tests
bun run dev             # hub + web concurrently
bun run build:single-exe # All-in-one binary
```

## Local debug playbook (voice correction + local hub)

Use when user says: default config points to remote hub, but needs local testing now.

Default user context (important):
- user talks to agent through this product's **online stable** deployment
- local machine's stable runner is usually configured to silently connect to **online stable hub** via config file
- therefore, local debug must use temporary env override (`HAPI_API_URL`) to avoid touching persisted config
- do **not** operate/stop/restart stable runner service unless user explicitly asks
- do **not** use runner to start debug session; use `cli/` debug version directly

Goal:
- keep persisted config untouched
- keep stable service untouched
- force one local CLI session to local hub
- verify web/ngrok can see live session

Steps:

1) Start local hub+web dev with temporary env (same shell only):
```bash
env HAPI_VOICE_CORRECTION_BASE_URL="<your-llm-base-url>" \
    HAPI_VOICE_CORRECTION_API_KEY="<your-token>" \
    HAPI_VOICE_CORRECTION_MODEL="<your-model>" \
    bun run dev
```

2) Start debug session from `cli/` with **HAPI_** temp var (do not edit settings.json):

Codex:
```bash
# 默认yolo模式启动codex 方便调试
cd cli
HAPI_API_URL="http://127.0.0.1:3006" bun run dev codex --yolo
```

Claude:
```bash
cd cli
HAPI_API_URL="http://127.0.0.1:3006" bun run dev claude --yolo
```

3) Verify connected to local hub (both Codex/Claude same checks):
- hub logs show `POST /cli/machines` 200
- hub logs show `POST /cli/sessions` 200

Notes:
- this voice-text-correction flow does **not** depend on runner; hub is enough
- voice correction config priority: env > `~/.hapi/settings.json` > default
- settings.json fields for voice correction:
  - `HAPI_VOICE_CORRECTION_BASE_URL`
  - `HAPI_VOICE_CORRECTION_API_KEY`
  - `HAPI_VOICE_CORRECTION_MODEL`
  - `ELEVENLABS_API_KEY`
- if base URL or API key missing, correction auto-fallback to raw transcript (`voice-correction-not-configured`)
- user often tests remotely via ngrok to local Vite (`:5173`)
- never store real tokens in repo docs/logs; placeholders only
- avoid impacting stable services/processes during debug; if conflict risk, ask user first

## Local debug aliases (must use for isolated dev env)

When debugging locally on this machine, do **not** reuse the default `~/.hapi` environment.
Stable local config may silently point to the online stable hub.

Use these isolated aliases instead:

```bash
alias hapidev='cd /Users/ofeiss/project/hapi && HAPI_HOME=~/.hapidev HAPI_DIAGNOSTIC_LOGGING=true bun run dev'
alias hapidevcli='cd /Users/ofeiss/project/hapi/cli && HAPI_HOME=~/.hapidev HAPI_DIAGNOSTIC_LOGGING=true bun src/index.ts'
```

Rules:
- local debug for this repo should default to `HAPI_HOME=~/.hapidev`
- do not read/write stable runner state under `~/.hapi` unless user explicitly asks
- do not verify new scheduler/runner behavior against the online stable hub
- prefer `hapidev` for hub+web and `hapidevcli` for CLI/runner/session testing

## Key source dirs

### CLI (`cli/src/`)
- `api/` - Hub connection (Socket.IO client, auth)
- `claude/` - Claude Code integration (wrapper, hooks)
- `codex/` - Codex mode integration
- `agent/` - Multi-agent support (Gemini via ACP)
- `runner/` - Background daemon for remote spawn
- `commands/` - CLI subcommands (auth, runner, doctor)
- `modules/` - Tool implementations (ripgrep, difftastic, git)
- `ui/` - Terminal UI (Ink components)

### Hub (`hub/src/`)
- `web/routes/` - REST API endpoints
- `socket/` - Socket.IO setup
- `socket/handlers/cli/` - CLI event handlers (session, terminal, machine, RPC)
- `sync/` - Core logic (sessionCache, messageService, rpcGateway)
- `store/` - SQLite persistence (better-sqlite3)
- `sse/` - Server-Sent Events manager
- `telegram/` - Bot commands, callbacks
- `notifications/` - Push (VAPID) and Telegram notifications
- `config/` - Settings loading, token generation
- `visibility/` - Client visibility tracking

### Web (`web/src/`)
- `routes/` - TanStack Router pages
- `routes/sessions/` - Session views (chat, files, terminal)
- `components/` - Reusable UI (SessionList, SessionChat, NewSession/)
- `hooks/queries/` - TanStack Query hooks
- `hooks/mutations/` - Mutation hooks
- `hooks/useSSE.ts` - SSE subscription
- `api/client.ts` - API client wrapper

### Shared (`shared/src/`)
- `types.ts` - Core types (Session, Message, Machine)
- `schemas.ts` - Zod schemas for validation
- `socket.ts` - Socket.IO event types
- `messages.ts` - Message parsing utilities
- `modes.ts` - Permission/model mode definitions

## Testing

- Test framework: Vitest (via `bun run test`)
- Test files: `*.test.ts` next to source
- Run: `bun run test` (from root) or `bun run test` (from package)
- Hub tests: `hub/src/**/*.test.ts`
- CLI tests: `cli/src/**/*.test.ts`
- No web tests currently

## Common tasks

| Task | Key files |
|------|-----------|
| Add CLI command | `cli/src/commands/`, `cli/src/index.ts` |
| Add API endpoint | `hub/src/web/routes/`, register in `hub/src/web/index.ts` |
| Add Socket.IO event | `hub/src/socket/handlers/cli/`, `shared/src/socket.ts` |
| Add web route | `web/src/routes/`, `web/src/router.tsx` |
| Add web component | `web/src/components/` |
| Modify session logic | `hub/src/sync/sessionCache.ts`, `hub/src/sync/syncEngine.ts` |
| Modify message handling | `hub/src/sync/messageService.ts` |
| Add notification type | `hub/src/notifications/` |
| Add shared type | `shared/src/types.ts`, `shared/src/schemas.ts` |

## Important patterns

- **RPC**: CLI registers handlers (`rpc-register`), hub routes requests via `rpcGateway.ts`
- **Versioned updates**: CLI sends `update-metadata`/`update-state` with version; hub rejects stale
- **Session modes**: `local` (terminal) vs `remote` (web-controlled); switchable mid-session
- **Permission modes**: `default`, `acceptEdits`, `bypassPermissions`, `plan`
- **Namespaces**: Multi-user isolation via `CLI_API_TOKEN:<namespace>` suffix

## Critical Thinking

1. Fix root cause (not band-aid).
2. Unsure: read more code; if still stuck, ask w/ short options.
3. Conflicts: call out; pick safer path.
4. Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.

## Synced from CLAUDE.md (Conflict resolution: CLAUDE.md takes precedence)

# HAPI Project Notes

## Tech Stack

- Runtime: Bun (not Node/pnpm for build/dev, use `bun run` / `bun install`)
- Monorepo: workspaces defined in root package.json (cli, shared, hub, web, website, docs)
- Frontend: React 19 + Vite 7 + Tailwind CSS 4 + TanStack Router/Query
- Shared package: `@hapi/protocol` (TypeScript source, no build step)

## Build Commands

- `bun install` - install all workspace dependencies
- `bun run build:web` - build web frontend
- `bun run dev` - run hub + web in dev mode
- `bun run typecheck` - typecheck all packages

## npm Publish (@ofeiss/hapi)

Package: `cli/package.json` -> `@ofeiss/hapi` (fork of `@twsxtd/hapi`)

### 触发工作流约定（重要）

- 当用户提到“构建 npm / 打 npm 包 / 准备 npm 发布”，默认进入本节完整流程
- 默认交付物：
  - 已完成构建与 `npm pack` 产物
  - 给出一个可直接复制执行的发布命令块；命令块最前面必须内置 `npm whoami` 身份校验
- 默认不执行 `npm publish`，除非用户明确要求“现在就发布”
- 流程开始前必须先检查并更新版本号（至少 patch +1）：
  - npm 不允许重复发布同一版本
  - 不升版本会导致发布失败
- 输出发布命令时，不要把身份校验和 `npm publish` 分开描述；要把它们放进同一个代码块里
- 默认只给一个可直接复制执行的发布命令代码块；不要再额外附带“场景 1 / 场景 2 / 示例输出”这类容易被误复制到终端的说明，除非用户明确要求看示例输出
- 该代码块必须满足：
  - 第一段先执行 `npm whoami`
  - 若结果不是 `ofeiss`，先提示用户按 ENTER，再自动执行 `npm login`
  - `npm login` 完成后，必须再次执行 `npm whoami`
  - 只有二次校验结果是 `ofeiss`，后续 `npm publish` 才能继续
  - 若二次校验仍不是 `ofeiss`，只输出失败提示，不要 `exit 1`，也不要关闭用户当前 shell
- 最终给用户的命令里，禁止出现 `cli/npm/...-<ver>.tgz` 这类 `<ver>` 占位符；zsh 会把 `<` 当输入重定向
- 必须直接替换成真实版本号，或先定义 `VERSION="0.15.18"` 这类安全变量再引用
- 不允许只口头提醒“先执行 `npm whoami`”；必须把 guard 写进最终给用户的命令块

### 架构说明

项目采用多包分发架构：
- **主包** `@ofeiss/hapi` — 只含 JS 入口脚本 (`bin/hapi.cjs`)，通过 `optionalDependencies` 引用平台包
- **平台包** `@ofeiss/hapi-{platform}-{arch}` — 包含各平台编译好的二进制文件（每个 40-90MB）

`bin/hapi.cjs` 运行时通过 `require.resolve("@ofeiss/hapi-{platform}-{arch}")` 定位二进制文件。

Fork 时必须将 `@twsxtd` 全部替换为 `@ofeiss`，涉及三个文件：
- `cli/bin/hapi.cjs` — 运行时包名解析
- `cli/package.json` — optionalDependencies
- `cli/scripts/prepare-npm-packages.ts` — 构建时包名生成

### 完整发布流程

1. 下载 tunwg 工具（构建前置依赖）：
   先检查本地是否已存在，只有缺失时才下载，避免重复下载。
   ```bash
   if ls hub/tools/tunwg/tunwg-* >/dev/null 2>&1 && [ -f hub/tools/tunwg/LICENSE ]; then
     echo "tunwg 已存在，跳过下载"
   else
     bun run download:tunwg
   fi
   ```

2. 构建 web 前端并嵌入：
   ```bash
   bun run build:web
   (cd hub && bun run generate:embedded-web-assets)
   ```

3. 构建包含 web 资源的二进制（用 `allinone`，不是 `build:exe`）：
   ```bash
   (cd cli && bun run build:exe:allinone:all)
   ```

4. 准备 npm 包：
   ```bash
   (cd cli && bun run prepare-npm-packages)
   ```

5. 打包 tarball：
   ```bash
   (cd cli/npm/darwin-arm64 && npm pack)
   (cd cli/npm/linux-x64 && npm pack)
   (cd cli/npm/win32-x64 && npm pack)
   (cd cli/npm/main && npm pack)
   ```

6. 发布（先平台包，后主包）：
   最终给用户的发布命令必须是一个完整代码块，形如：
   ```bash
   VERSION="0.15.18"
   NPM_USER="$(npm whoami 2>/dev/null || true)"
   if [ "$NPM_USER" != "ofeiss" ]; then
     echo "未登录或登录身份不正确。按 ENTER 执行 npm login，完成后会自动继续推送流程。"
     read -r _
     npm login
     NPM_USER="$(npm whoami 2>/dev/null || true)"
   fi

   if [ "$NPM_USER" = "ofeiss" ]; then
     npm publish "cli/npm/darwin-arm64/ofeiss-hapi-darwin-arm64-${VERSION}.tgz" --access public --otp=
     npm publish "cli/npm/linux-x64/ofeiss-hapi-linux-x64-${VERSION}.tgz" --access public --otp=
     npm publish "cli/npm/win32-x64/ofeiss-hapi-win32-x64-${VERSION}.tgz" --access public --otp=
     npm publish "cli/npm/main/ofeiss-hapi-${VERSION}.tgz" --access public --otp=
   else
     echo "npm 登录后身份仍不是 ofeiss，已停止推送。当前身份: ${NPM_USER:-<empty>}"
   fi
   ```
   这里的 `VERSION` 必须替换成当前真实版本号；不要输出 `<ver>` 占位符。
   Leave `--otp=` empty -> triggers browser-based auth -> macOS biometric verification.

### Known Issues

- **必须用 `build:exe:allinone:all` 而不是 `build:exe:all`**：后者不含 web 前端资源，安装后 `hapi hub` 的 Web UI (端口 3006) 会报 "Embedded Mini App is missing index.html"。
- npm 不允许重复发布同一版本，如果需要修复已发布的包必须升版本号。平台包很大（40-90MB），上传耗时较长，尽量一次发布成功。
- 以后默认发布 3 个平台包：`darwin-arm64`、`linux-x64`、`win32-x64`，然后再发布主包。
- `npm publish` runs a `prepack` script (`prepare-npm-packages`) that takes several seconds, causing OTP codes to expire if passed via `--otp=<code>`. Solution: use `npm pack` first, then publish the `.tgz`.
- The "Access token expired or revoked" notice appears even with valid tokens - it's a non-blocking npm notice, not the actual error.
- Do NOT use granular access tokens for publishing scoped packages - they consistently return E404/E403.
- `npm whoami` 必须在给出发布命令前立即执行一次；不是 `ofeiss` 就直接停止。对 `@ofeiss/*` scope，认证失效或权限不对时，npm 经常把真实权限问题伪装成 `E404 Not Found`。
- 优先使用 `npm login` 建立可发布的登录态；不要依赖不明来源或过期的 `~/.npmrc` `_authToken`。
- 给用户的整段可复制发布命令里，不要使用 `exit`；交互式 shell 中会直接退出终端会话。统一使用 `if ... else ... fi`，身份不对时只提示，不执行后续 `npm publish`。
- 给用户的整段可复制发布命令里，身份不对时要用 `read` 暂停，用户按 ENTER 后自动执行 `npm login`，登录结束后再次校验身份，再决定是否继续推包。
- 不要在可复制执行的 shell 命令里使用 `<ver>` 这类尖括号占位符；zsh/bash 会把它解析成重定向。必须用真实版本号，或先定义 `VERSION="..."` 再拼接文件名。

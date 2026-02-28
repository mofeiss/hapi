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
env ANTHROPIC_BASE_URL="<your-base-url>" \
    ANTHROPIC_AUTH_TOKEN="<your-token>" \
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
- user often tests remotely via ngrok to local Vite (`:5173`)
- never store real tokens in repo docs/logs; placeholders only
- avoid impacting stable services/processes during debug; if conflict risk, ask user first

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
   ```bash
   bun run download:tunwg
   ```

2. 构建 web 前端并嵌入：
   ```bash
   bun run build:web
   cd hub && bun run generate:embedded-web-assets && cd ..
   ```

3. 构建包含 web 资源的二进制（用 `allinone`，不是 `build:exe`）：
   ```bash
   cd cli && bun run build:exe:allinone:all
   ```

4. 准备 npm 包：
   ```bash
   bun run prepare-npm-packages
   ```

5. 打包 tarball：
   ```bash
   cd cli/npm/darwin-arm64 && npm pack
   cd cli/npm/linux-x64 && npm pack
   cd cli/npm/main && npm pack
   ```

6. 发布（先平台包，后主包）：
   ```bash
   npm publish cli/npm/darwin-arm64/ofeiss-hapi-darwin-arm64-<ver>.tgz --access public --otp=
   npm publish cli/npm/linux-x64/ofeiss-hapi-linux-x64-<ver>.tgz --access public --otp=
   npm publish cli/npm/main/ofeiss-hapi-<ver>.tgz --access public --otp=
   ```
   Leave `--otp=` empty -> triggers browser-based auth -> macOS biometric verification.

### Known Issues

- **必须用 `build:exe:allinone:all` 而不是 `build:exe:all`**：后者不含 web 前端资源，安装后 `hapi hub` 的 Web UI (端口 3006) 会报 "Embedded Mini App is missing index.html"。
- npm 不允许重复发布同一版本，如果需要修复已发布的包必须升版本号。平台包很大（40-90MB），上传耗时较长，尽量一次发布成功。
- 只需发布实际使用的平台包（darwin-arm64 + linux-x64），其他平台在 `optionalDependencies` 中找不到会被 npm 静默跳过。
- `npm publish` runs a `prepack` script (`prepare-npm-packages`) that takes several seconds, causing OTP codes to expire if passed via `--otp=<code>`. Solution: use `npm pack` first, then publish the `.tgz`.
- The "Access token expired or revoked" notice appears even with valid tokens - it's a non-blocking npm notice, not the actual error.
- Do NOT use granular access tokens for publishing scoped packages - they consistently return E404/E403.

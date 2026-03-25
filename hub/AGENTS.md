# AGENTS.md

Scope: `hub/`.

Read root `README.md` first, then `hub/README.md`.

## Purpose

Hub owns HTTP API, Socket.IO, SSE fanout, SQLite persistence, Telegram bot integration, notifications, visibility tracking, and RPC gateway between web and CLI.

## Key dirs

- `src/web/routes/` REST endpoints
- `src/socket/` Socket.IO setup and CLI event handlers
- `src/sync/` session cache, message service, RPC gateway
- `src/store/` SQLite persistence
- `src/sse/` event stream manager
- `src/telegram/` bot and callbacks
- `src/notifications/` push / Telegram notifications
- `src/visibility/` client focus / visibility tracking

## Working rules

- Hub is the source of truth for cross-client sync behavior; changes here often affect both CLI and web.
- Before changing data shape, inspect shared types and schemas in `shared/`.
- Versioned session updates matter: stale metadata/state writes should stay rejected.
- When adjusting RPC behavior, inspect registration, routing, timeout, and web call sites together.
- When changing persistence, prefer explicit migrations / direct schema edits over hidden compatibility shims.

## Important patterns

- CLI registers RPC handlers; hub routes requests through RPC gateway.
- Session updates are versioned.
- SSE is the web live-update path.
- Socket namespace `/cli` is the CLI live-sync path.
- SQLite underpins sessions, messages, machines, and bindings.

## Common tasks

- Add API endpoint: `src/web/routes/`, register in web service bootstrap
- Add Socket.IO event: `src/socket/handlers/cli/` and shared socket typing
- Modify session logic: `src/sync/sessionCache.ts`, `src/sync/syncEngine.ts`
- Modify message handling: `src/sync/messageService.ts`
- Modify persistence: `src/store/`

## Testing

- Hub tests live in `src/**/*.test.ts`
- Run package-local tests with `cd hub && bun run test`
- Run package-local typecheck with `cd hub && bun run typecheck`

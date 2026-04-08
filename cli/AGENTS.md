# AGENTS.md

Scope: `cli/`.

Read `README.md` in repo root first, then `cli/README.md`.

## Purpose

CLI owns local agent execution, runner lifecycle, hub connectivity, auth helpers, MCP bridge, and packaging of the distributable binary.

## Key dirs

- `src/api/` hub connection and auth
- `src/claude/` Claude integration
- `src/codex/` Codex integration
- `src/runner/` background runner
- `src/commands/` CLI subcommands
- `src/modules/` tool integrations
- `src/ui/` terminal diagnostics and doctor UI

## Working rules

- Active support surface: Claude and Codex. Deprecated agent integrations may still exist; avoid touching them unless explicitly requested.
- For new CLI behavior, inspect command entrypoints and runner wiring before editing helper modules.
- Prefer repo-wide commands from root unless the task is clearly package-local.
- When changing session or runner behavior, verify how hub RPC and shared protocol types are affected.
- Packaging / release logic is sensitive; use the project skill `hapi-npm-publish` for the detailed workflow instead of re-deriving it from memory.
- For npm release requests, never execute `npm publish`; build + `npm pack` + verification only, then output the canonical tarball-publish block defined by `hapi-npm-publish`.

## Local debug constraints

- Default local debug target for this repo is isolated `HAPI_HOME=~/.hapidev`, not stable `~/.hapi`.
- Do not read/write stable runner state under `~/.hapi` unless user explicitly asks.
- Do not stop or restart the stable runner service unless user explicitly asks.
- When local debug depends on hub+web, prefer isolated aliases or temporary env override instead of editing persisted config.
- Use project skill `hapi-local-debug-playbook` when the user asks for the exact local debug procedure.

## Common tasks

- Add command: `src/commands/`, wire in `src/index.ts`
- Modify runner: `src/runner/`
- Modify Codex integration: `src/codex/`
- Modify Claude integration: `src/claude/`
- Modify MCP bridge: `src/mcp/` and related handlers

## Testing

- CLI tests live in `src/**/*.test.ts`
- Run package-local tests with `cd cli && bun run test`
- Run package-local typecheck with `cd cli && bun run typecheck`

# AGENTS.md

Work style: telegraph; noun-phrases ok; drop grammar.

Short guide for AI agents in this repo. Prefer progressive loading: root README first, then package READMEs, then nearest directory `AGENTS.md`.

## What is HAPI?

Local-first platform for running AI coding agents with remote control via web / phone. CLI wraps agents, hub syncs state, web is the remote workspace.

## Repo layout

```text
cli/     CLI binary, agent wrappers, runner daemon
hub/     HTTP API, Socket.IO, SSE, Telegram bot
web/     React PWA / remote workspace
shared/  shared types, schemas, protocol helpers
docs/    docs workspace
website/ marketing site workspace may exist in some checkouts
```

Current checkout note:
- workspaces in root `package.json` still list `website`
- this checkout may or may not contain a `website/` directory
- do not assume the directory exists locally without checking first

## Architecture overview

```text
CLI --Socket.IO--> Hub --SSE/REST--> Web
```

Data flow:
1. CLI starts Claude or Codex session, connects to hub.
2. Agent events flow CLI -> hub -> DB/cache -> SSE broadcast.
3. Web subscribes to `/api/events` for live state.
4. Web actions flow hub -> RPC -> CLI -> agent.

## Read first

- `README.md` for product overview and quick start
- `cli/README.md`, `hub/README.md`, `web/README.md` for package-specific behavior
- nearest directory `AGENTS.md` before making non-trivial changes inside that subtree

## Shared rules

- No backward compatibility by default; prefer clean breaks.
- TypeScript strict; avoid untyped code.
- Bun workspaces; run repo-wide commands from root.
- Path alias `@/*` maps to `./src/*` within each package.
- Prefer 4-space indentation.
- Zod for runtime validation; shared schemas live in `shared/src/schemas.ts`.
- Supported agents for active product work: `Claude` and `Codex` only. `OpenCode` and `Gemini` paths may still exist but are deprecated; ignore them unless user explicitly asks.
- New component copy or UI text must preserve zh/en semantics together; keep product names, protocols, library names, and code identifiers in English.
- Commit titles must match recent repo history: Conventional Commit style `type(scope): summary`.

## Trader Workspace History

Use this section when the task is part of trader product exploration, especially on branch `product/trader-workspace`.

- authoritative living doc: `docs/trader-workspace-history.md`
- treat that file as both direction doc and historical evolution log; append, do not rewrite away prior stage context
- when current round intentionally skips deep product discussion for pacing, user state, or fast MVP delivery, record that honestly in the history doc instead of polishing it away
- when work changes product shape, IA, workspace roles, account/dashboard model, or MVP scope, update the history doc in the same change set
- when user issues `cp` / `commit+push` for trader product exploration work, update `docs/trader-workspace-history.md` before commit; this is part of done-ness
- if a round is implementation-only, still add a short entry stating what shipped and what design assumptions remained unchanged

## Scope map

- `cli/AGENTS.md`: CLI commands, runner, local debug constraints, npm package publishing notes
- `hub/AGENTS.md`: HTTP/socket/store/sync architecture and hub-side patterns
- `web/AGENTS.md`: workspace shell, storage policy, layout pitfalls, theming constraints
- `shared/AGENTS.md`: schemas, protocol types, validation discipline
- `docs/AGENTS.md`: docs workspace notes for this checkout

## Skills

Project-local skills live under `.codex/skills/` and are for low-frequency, high-detail workflows that should not stay resident in every session.

Current project skills:
- `hapi-local-debug-playbook` for isolated local hub/CLI debug flow
- `hapi-incident-forensics` for evidence-first session failure investigation
- `hapi-npm-publish` for npm pack / publish workflow of `@ofeiss/hapi`

## Common commands

```bash
bun typecheck
bun run test
bun run dev
bun run build:single-exe
```

## Critical thinking

1. Fix root cause, not surface symptom.
2. If unsure, read more code before proposing structure changes.
3. Call out conflicts and choose the safer path.
4. Treat unexpected edits as user or other-agent work; avoid reverting them.

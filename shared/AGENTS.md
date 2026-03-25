# AGENTS.md

Scope: `shared/`.

Read root `README.md` first.

## Purpose

`shared/` defines protocol-facing types, schemas, socket contracts, message parsing helpers, and mode definitions used by cli, hub, and web.

## Key files

- `src/types.ts` core shared types
- `src/schemas.ts` Zod runtime schemas
- `src/socket.ts` Socket.IO event typing
- `src/messages.ts` message parsing utilities
- `src/modes.ts` permission and model mode definitions

## Working rules

- Treat `shared/` as contract surface; changes here have multi-package blast radius.
- Keep TypeScript types and Zod schemas aligned.
- Prefer explicit schema updates over downstream coercion or compatibility hacks.
- When changing socket events or payload types, check both hub and cli call sites.
- Avoid package-local convenience types that drift from shared truth.

## Validation

- Runtime validation belongs here when data crosses process or network boundaries.
- If a shape is user-facing or wire-facing, prefer a schema, not just a type.

## Verification

- Run root or dependent package typechecks after `shared/` edits.

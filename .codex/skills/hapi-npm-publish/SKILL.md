---
name: hapi-npm-publish
description: Use when the user asks to build npm packages, prepare npm release artifacts, or publish `@ofeiss/hapi`. Covers version bump expectation, pack-first workflow, platform package order, and guarded `npm whoami` / `npm login` publish command generation.
---

# HAPI npm Publish

Use this skill when the user asks to build npm packages, prepare npm release artifacts, or publish `@ofeiss/hapi`.

## Core rules

- Default deliverable: build + `npm pack` artifacts + one copy-pasteable guarded publish command block.
- Do not run `npm publish` unless the user explicitly asks to publish now.
- Version must be bumped before preparing publish artifacts; npm will reject duplicate versions.
- Final command block must begin with `npm whoami` logic and handle wrong identity by pausing for `npm login`, then re-checking identity.
- Do not use `<ver>` placeholders in shell commands.
- Do not use `exit` in the user-facing publish block.

## Build flow

1. Download `tunwg` only if missing.
2. `bun run build:web`
3. `(cd hub && bun run generate:embedded-web-assets)`
4. `(cd cli && bun run build:exe:allinone:all)`
5. `(cd cli && bun run prepare-npm-packages)`
6. Run `npm pack` in platform package dirs, then main package dir.

## Package model

- Main package: `@ofeiss/hapi`
- Platform packages: `@ofeiss/hapi-{platform}-{arch}`
- Publish order: platform packages first, main package last

## Known pitfalls

- `build:exe:allinone:all` is required; plain `build:exe:all` misses embedded web assets.
- `npm publish` can hide auth problems as `E404`; guard with `npm whoami`.
- `npm pack` first avoids OTP expiry caused by `prepack` work.
- Prefer `npm login` over questionable `_authToken` state.

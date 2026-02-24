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

### Publish Flow

1. Build tarball first (avoids OTP timeout):
   ```bash
   cd cli && npm pack
   ```

2. Publish with browser auth (recommended, avoids OTP timing issues):
   ```bash
   npm publish ofeiss-hapi-<version>.tgz --access public --otp=
   ```
   Leave `--otp=` empty -> triggers browser-based auth -> macOS biometric verification.

3. Do NOT use granular access tokens for publishing scoped packages - they consistently return E404/E403.

### Known Issues

- `npm publish` runs a `prepack` script (`prepare-npm-packages`) that takes several seconds, causing OTP codes to expire if passed via `--otp=<code>`.
- Solution: use `npm pack` first, then publish the `.tgz` with `--otp=` (empty) for browser auth.
- The "Access token expired or revoked" notice appears even with valid tokens - it's a non-blocking npm notice, not the actual error.
- Binary warnings ("Binary not found: dist-exe/...") during prepack are expected if you haven't run `bun run build:exe:all`.

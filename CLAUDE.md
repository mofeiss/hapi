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

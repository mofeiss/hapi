---
name: hapi-npm-publish
description: Use when the user asks to build npm packages, prepare npm release artifacts, or needs the canonical `@ofeiss/hapi` publish command block. Enforces fixed build order, fixed verification, and a fixed user-run-only publish block.
---

# HAPI npm Publish

Use this skill for any `@ofeiss/hapi` npm packaging or release request.

## Non-negotiable rules

- This skill never runs `npm publish`. Agent responsibility ends at build + `npm pack` + verification + emitting the canonical publish block.
- Do not improvise release order, flags, directory order, shell structure, or shortened command variants.
- Do not skip steps when preparing a releasable version.
- Version must already be bumped in `cli/package.json` before preparing artifacts.
- All user-facing publish commands must use absolute paths and the concrete version from `cli/package.json`.
- Do not use placeholder tokens such as `<ver>`, `<path>`, or `<user>` in the final command block.
- Publish order is fixed: `darwin-arm64`, `darwin-x64`, `linux-arm64`, `linux-x64`, `win32-x64`, then `main`.
- Publish the verified `.tgz` tarballs produced by `npm pack`. Do not publish package directories.
- For npm release requests, do not emit `git push` or `git commit` commands unless the user explicitly asks for git operations.
- If `npm whoami` is unavailable and the expected npm account cannot be inferred from context, ask the user for the exact npm username before emitting the publish block.
- If any verification fails, stop and report the failure. Do not emit a publish block.

## Fixed build flow

1. Ensure `tunwg` exists. Download only if missing.
2. Run `bun run build:web` from repo root.
3. Run `cd hub && bun run generate:embedded-web-assets`.
4. Run `cd cli && bun run build:exe:allinone:all`.
5. Run `cd cli && bun run prepare-npm-packages`. This step must also delete stale `cli/npm/*/*.tgz` files before regenerating package contents.
6. Run `npm pack` in this exact order:
   - `cli/npm/darwin-arm64`
   - `cli/npm/darwin-x64`
   - `cli/npm/linux-arm64`
   - `cli/npm/linux-x64`
   - `cli/npm/win32-x64`
   - `cli/npm/main`
7. Verify freshness before handing the publish block to the user:
   - Compare SHA256 of each `cli/dist-exe/<target>/<bin>` and matching `cli/npm/<platform>/bin/<bin>`.
   - Run `--version` on the host-platform `dist-exe` binary.
   - Run `--version` on the matching host-platform `cli/npm/<platform>/bin/<bin>` binary.
   - Extract the host-platform tarball produced by `npm pack` and run `--version` on the extracted binary.
   - Confirm every generated tarball filename contains the exact version from `cli/package.json`.
8. Only after all checks pass, emit the canonical publish block.

## Publish Block Rendering

- Do not hand-write the publish block.
- Always render it with `scripts/render_publish_block.py` from this skill directory.
- Required arguments:
  - `--repo-root` absolute repo path
  - `--version` concrete version from `cli/package.json`
  - `--npm-user` concrete npm username
- Paste the script output unchanged into the final answer.

## Required final answer contract

When the task succeeds, the final answer must contain these sections in this order:

1. `构建结果`
2. `产物`
3. `NPM 发布命令`

Rules for the final answer:

- `构建结果` must state the exact version and that publish was not executed.
- `产物` must list the generated `.tgz` paths.
- `NPM 发布命令` must contain exactly one fenced `bash` code block.
- The publish block must come from `scripts/render_publish_block.py` with concrete values.
- Even if the user only asks “给我推送命令”, still output the full canonical publish block. Do not shorten it.

## Known pitfalls

- `build:exe:allinone:all` is required; plain `build:exe:all` misses embedded web assets.
- `cli/npm/*` is generated and gitignored. `prepare-npm-packages` must delete stale `.tgz` files before each rebuild so old tarballs do not accumulate.
- Publishing tarballs is safer than publishing package directories because it guarantees the uploaded bytes are the ones already verified.
- `npm publish` can hide auth problems as `E404`; always guard with `npm whoami` and `npm login`.
- `npm pack` must run before generating the publish block.
- Never replace the canonical block with ad-hoc single-line commands.

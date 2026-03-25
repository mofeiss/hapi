# AGENTS.md

Scope: `docs/`.

This checkout currently has a minimal `docs/` workspace and may not include the full docs site source tree.

## Working rules

- Check actual files in `docs/` before assuming VitePress structure exists locally.
- Keep documentation aligned with the current product surface: active agents are Claude and Codex.
- If a task affects product workflows or release/debug instructions, decide whether the canonical source should instead live in a project skill or package README.
- For trader-workspace branch work, `docs/trader-workspace-history.md` is branch-specific and should not be introduced into `main`.

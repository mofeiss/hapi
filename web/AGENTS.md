# AGENTS.md

Scope: `web/`.

Read root `README.md` first, then `web/README.md`.

## Purpose

Web is the React PWA / Mini App remote workspace for sessions, scheduled tasks, approvals, files, terminal, notifications, and auth flows.

## Storage policy

- Classify persistence before implementation.
- Use `sessionStorage` for per-tab workspace context.
- Use `localStorage` for cross-tab preferences, config, and history.
- Do not add new `localStorage` keys for workspace selection state or page-local layout state unless the user explicitly wants cross-tab sharing.
- Prefer shared helpers in `src/lib/storage.ts` over raw storage access.

## Current layout model

- Workspace-style single app shell, not isolated pages.
- Primary tabs: `sessions` and `scheduled`.
- Workspace state persists per tab in `sessionStorage` key `hapi:workspace-state`.
- Session subviews: `chat`, `files`, `terminal`.
- Overlays: `none`, `settings`, `newSession`.
- Router URLs are partly compat/deep-link surface; actual UI state often comes from `src/lib/workspace-store.ts`.

## Shell behavior

- Main bootstrap lives in `src/App.tsx`.
- On hub/base URL change, app clears query cache and resets first-connect sync state.
- SSE reconnect should invalidate session queries and refresh selected-session messages.
- `Ready for input` should become a system notification only when the page is not actively focused.

## Layout heuristics

- Before changing layout, read `src/router.tsx` first.
- Before adding header controls, inspect `HeaderActionGroup` and `PageHeaderUtilityControls`.
- Keep parity across chat/files/terminal session subviews.
- Desktop sidebar width is per-tab state.

## Scheduled-session scroll rule

- Normal session entry from `sessions` is editing-oriented and should land near latest context.
- Scheduler session entry from scheduled detail is review-oriented and should anchor at top.
- Do not unify these behaviors unless user explicitly asks.
- High-risk regression area: scheduler detail height changes, replacing fixed heights with `flex-1`, header row changes, chat mount timing.
- Preserve the `initialScrollAnchor="top"` chain for scheduler session review flows.

## Theme switching pitfall

- Do not add color/background/border transitions to theme-sensitive controls by default.
- Theme token changes should swap in one frame via `data-theme`.
- If motion is needed, prefer transform/opacity, not token color animation.

## Web-specific rules

- Base orange must reuse `var(--app-orange-base)` from `src/index.css`.
- New component copy and UI labels must support both Chinese and English semantics.

## Common tasks

- Add route: `src/routes/` and router shell wiring
- Add reusable UI: `src/components/`
- Add query/mutation: `src/hooks/queries/`, `src/hooks/mutations/`
- Modify API client: `src/api/client.ts`

## Testing

- Web tests are lighter than cli/hub; inspect existing coverage before assuming gaps are intentional.
- Run package-local tests with `cd web && bun run test`
- Run package-local typecheck with `cd web && bun run typecheck`

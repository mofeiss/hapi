# AGENTS.md

Web-specific notes. Read root `AGENTS.md` first.

## Theme switching pitfall

- Theme switching in web relies on immediate CSS variable swap via `data-theme`; avoid adding `transition-colors`, `transition-all`, or other color/background/border transitions to theme-sensitive controls unless user explicitly wants delayed animation.
- Common failure mode: newly added sidebar/header/icon buttons look one beat slower than the rest of the page during black/white theme toggle. Root cause usually not state lag; color transition animating old -> new theme values.
- High-risk spots: collapsed sidebar buttons, floating action buttons, header utility controls, compact icon-only controls, newly introduced reusable button classes.
- Prefer no color transition for controls using `var(--app-bg)`, `var(--app-fg)`, `var(--app-hint)`, `var(--app-border)`, `var(--app-divider)`, `var(--app-secondary-bg)`, `var(--app-subtle-bg)`.
- If motion needed, prefer transform/opacity animation; do not animate theme token changes by default.
- When adding new themed component, manually verify theme toggle sync: whole page + component should switch in the same frame, no delayed recolor.


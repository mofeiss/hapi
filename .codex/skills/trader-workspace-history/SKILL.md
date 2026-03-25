---
name: trader-workspace-history
description: Use on `product/trader-workspace` when the user mentions `trader-workspace-history`, asks about trader workspace direction, `Desk` or `Accounts`, current product shape, or branch design history. Read `docs/trader-workspace-history.md` before answering.
---

# Trader Workspace History

Use this skill only for trader product exploration on branch `product/trader-workspace`.

## Trigger cues

- user mentions `trader-workspace-history`
- user asks what this branch currently assumes or remembers
- user asks about trader workspace direction or historical reasoning
- user asks about `Desk`, `Overview`, `Accounts`, `Sessions`, or `Scheduled` in the trader product context

## Required workflow

1. Read `docs/trader-workspace-history.md` before answering.
2. Treat it as the authoritative living direction doc plus evolution log.
3. If answering from current context only, at minimum surface the resident summary from root `AGENTS.md` instead of saying you know nothing.
4. If the task changes trader product shape, update `docs/trader-workspace-history.md` in the same change set.

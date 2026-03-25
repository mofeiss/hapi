---
name: hapi-incident-forensics
description: Use for evidence-first investigation of broken HAPI sessions, fake-alive reports, resume failures, or frontend/CLI disconnection incidents. Guides log correlation across `~/.hapidev`, HAPI SQLite state, and local Claude/Codex session history.
---

# HAPI Incident Forensics

Use this skill when the user asks to analyze a historical failure, pasted traces, or a broken session timeline.

## Stance

- Evidence first.
- Do not guess root cause without artifacts.
- Separate confirmed facts from open questions.

## Investigation order

1. Reconstruct timeline from user-provided records: screenshots, pasted chat, tool traces, session title, cwd, keywords, approximate time, agent flavor.
2. Locate matching HAPI logs under `~/.hapidev/logs/` using timestamp, pid, session id, and title keywords.
3. Read failing logs before proposing causes.
4. If useful, compare with a nearby successful session.
5. If identity is unclear, inspect `~/.hapidev/hapi.db` for session rows and agent-specific metadata.
6. When Claude is involved, inspect local Claude history under `~/.claude/projects/...` and related index files.
7. When Codex is involved, inspect corresponding local Codex session history/state if available.

## Reporting rules

- Cite which file, log, DB row, or local history artifact supports each conclusion.
- Prefer disproving candidate causes with evidence over stacking speculative mitigations.
- If logs are missing or rotated, say so clearly and pivot to DB or local agent history instead of guessing.

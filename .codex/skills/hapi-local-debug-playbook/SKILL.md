---
name: hapi-local-debug-playbook
description: Use for isolated local HAPI debugging when the user needs to test against a local hub or local web instead of the stable remote setup. Covers temporary env overrides, `~/.hapidev`, and the preferred local debug aliases.
---

# HAPI Local Debug Playbook

Use this skill when the user needs local hub or local web debugging without touching stable `~/.hapi` config or runner state.

## Core rules

- Prefer isolated `HAPI_HOME=~/.hapidev`.
- Do not operate on stable `~/.hapi` runner state unless the user explicitly asks.
- Do not restart or stop the stable runner unless the user explicitly asks.
- Prefer temporary env override over editing persisted config.

## Preferred aliases

```bash
alias hapi_dev_hub='cd /Users/ofeiss/project/hapi && HAPI_HOME=~/.hapidev HAPI_DIAGNOSTIC_LOGGING=true bun run dev'
alias hapi_dev_cli='cd /Users/ofeiss/project/hapi/cli && HAPI_HOME=~/.hapidev HAPI_DIAGNOSTIC_LOGGING=true bun src/index.ts'
alias hapi_dev_cli_stop='hapi_dev_cli runner stop'
alias hapi_dev_cli_restart='hapi_dev_cli runner stop && hapi_dev_cli runner start'
```

## Local hub + web

```bash
env HAPI_VOICE_CORRECTION_BASE_URL="<your-llm-base-url>" \
    HAPI_VOICE_CORRECTION_API_KEY="<your-token>" \
    HAPI_VOICE_CORRECTION_MODEL="<your-model>" \
    bun run dev
```

## Local CLI against local hub

Codex:

```bash
cd cli
HAPI_API_URL="http://127.0.0.1:3006" bun run dev codex --yolo
```

Claude:

```bash
cd cli
HAPI_API_URL="http://127.0.0.1:3006" bun run dev claude --yolo
```

## Verification

- Hub should log `POST /cli/machines` 200.
- Hub should log `POST /cli/sessions` 200.
- Voice correction config priority is env > `~/.hapi/settings.json` > default.
- If correction config is missing, fallback to raw transcript is expected.

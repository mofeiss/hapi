import { trimIdent } from "@/utils/trimIdent";
import type { SessionTriggerMetadata } from '@/api/types';
import { shouldIncludeCoAuthoredBy } from "./claudeSettings";

/**
 * Base system prompt shared across all configurations
 */
const TITLE_SYSTEM_PROMPT = (() => trimIdent(`
    ALWAYS when you start a new chat - you must call a tool "mcp__hapi__change_title" to set a chat title. When you think chat title is not relevant anymore - call the tool again to change it. When chat name is too generic and you have a change to make it more specific - call the tool again to change it. This title is needed to easily find the chat in the future. Help human.
`))();

const SCHEDULED_GUIDANCE_PROMPT = (() => trimIdent(`
    When using HAPI scheduled task tools, ALWAYS distinguish task creation success from task execution status.

    If "mcp__hapi__schedule_create" returns success, the task has been created successfully. Focus on the delivery confirmation returned by the tool, such as taskId, nextRunAt, cron, and related scheduled-task metadata, and report that result to the user immediately.

    NEVER recreate a scheduled task only because a later check shows it has already executed, completed, or is no longer pending. This is especially important for one-time ("once") tasks, which may complete very quickly after creation.

    By default, the user cares about whether the task was scheduled successfully, not whether it has already run. Do not call "mcp__hapi__schedule_list" after creation unless the user explicitly asks for status inspection, run history, or task verification.
`))();

/**
 * Co-authored-by credits to append when enabled
 */
const CO_AUTHORED_CREDITS = (() => trimIdent(`
    When making commit messages, you SHOULD also give credit to HAPI like so:

    <main commit message>

    via [HAPI](https://hapi.run)

    Co-Authored-By: HAPI <noreply@hapi.run>
`))();

/**
 * System prompt with conditional Co-Authored-By lines based on Claude's settings.json configuration.
 * Settings are read once on startup for performance.
 */
export function shouldInjectTitlePrompt(trigger?: SessionTriggerMetadata): boolean {
  return trigger?.type !== 'scheduled-task';
}

export function buildClaudeSystemPrompt(trigger?: SessionTriggerMetadata): string {
  const includeCoAuthored = shouldIncludeCoAuthoredBy();
  const sections: string[] = [];

  if (shouldInjectTitlePrompt(trigger)) {
    sections.push(TITLE_SYSTEM_PROMPT);
  }

  sections.push(SCHEDULED_GUIDANCE_PROMPT);

  if (includeCoAuthored) {
    sections.push(CO_AUTHORED_CREDITS);
  }

  return sections.join('\n\n');
}

export const systemPrompt = buildClaudeSystemPrompt();

/**
 * Codex-specific system prompt for local mode.
 *
 * This prompt instructs Codex to call the hapi__change_title function
 * to set appropriate chat session titles.
 */

import { trimIdent } from '@/utils/trimIdent';
import type { SessionTriggerMetadata } from '@/api/types';

/**
 * Title instruction for Codex to call the hapi MCP tool.
 * Note: Codex exposes MCP tools under the `functions.` namespace,
 * so the tool is called as `functions.hapi__change_title`.
 */
export const TITLE_INSTRUCTION = trimIdent(`
    Based on this message, call functions.hapi__change_title to change chat session title that would represent the current task. If chat idea would change dramatically - call this function again to update the title.
`);

export const SCHEDULED_GUIDANCE_INSTRUCTION = trimIdent(`
    When using HAPI scheduled task tools, ALWAYS distinguish task creation success from task execution status.

    If "functions.hapi__schedule_create" returns success, the task has been created successfully. Focus on the delivery confirmation returned by the tool, such as taskId, nextRunAt, cron, and related scheduled-task metadata, and report that result to the user immediately.

    NEVER recreate a scheduled task only because a later check shows it has already executed, completed, or is no longer pending. This is especially important for one-time ("once") tasks, which may complete very quickly after creation.

    By default, the user cares about whether the task was scheduled successfully, not whether it has already run. Do not call "functions.hapi__schedule_list" after creation unless the user explicitly asks for status inspection, run history, or task verification.
`);

export function buildCodexSystemPrompt(trigger?: SessionTriggerMetadata): string {
    const sections = [
        ...(trigger?.type === 'scheduled-task' ? [] : [TITLE_INSTRUCTION]),
        SCHEDULED_GUIDANCE_INSTRUCTION
    ];

    return sections.join('\n\n');
}

/**
 * The system prompt to inject via developer_instructions in local mode.
 */
export const codexSystemPrompt = buildCodexSystemPrompt();

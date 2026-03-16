import { trimIdent } from '@/utils/trimIdent'
import type { SessionTriggerMetadata } from '@/api/types'

export const TITLE_INSTRUCTION = trimIdent(`
    Based on this message, call functions.hapi__change_title to change chat session title that would represent the current task. If chat idea would change dramatically - call this function again to update the title.
`)

export const SCHEDULE_CREATE_GUIDANCE_INSTRUCTION = trimIdent(`
    When using HAPI scheduled task tools, ALWAYS distinguish task creation success from task execution status.

    If "functions.hapi__schedule_create" returns success, the task has been created successfully. Focus on the delivery confirmation returned by the tool, such as taskId, nextRunAt, cron, scheduledSessionPermission, and related scheduled-task metadata, and report that result to the user immediately.

    NEVER recreate a scheduled task only because a later check shows it has already executed, completed, or is no longer pending. This is especially important for one-time ("once") tasks, which may complete very quickly after creation.

    By default, the user cares about whether the task was scheduled successfully, not whether it has already run. Do not call "functions.hapi__schedule_list" after creation unless the user explicitly asks for status inspection, run history, or task verification.

    HAPI scheduled tasks support three scheduled session permission types:
    1. aware: the future scheduled session knows it is running unattended and knows its task/run identity, but it cannot control the scheduler.
    2. self_control: the future scheduled session may control only its own task.
    3. system_control: the future scheduled session may control the full scheduler system.

    When the user asks to create a scheduled or looping task, you MUST ask which scheduled session permission type they want. You must not choose it yourself. There is no default. The user must explicitly specify one of: aware, self_control, system_control.
`)

function buildScheduledSessionEnvironmentInstruction(trigger: Extract<SessionTriggerMetadata, { type: 'scheduled-task' }>): string {
    const scheduleTypeText = trigger.scheduleType === 'cron' ? 'looping cron task' : 'one-time scheduled task'
    const iterationText = typeof trigger.iteration === 'number'
        ? `This is execution #${trigger.iteration}.`
        : 'The exact execution count is unavailable.'

    return trimIdent(`
        You are running inside a HAPI scheduled session.

        This session was started automatically by a ${scheduleTypeText}. There is no active user supervising this run. You must work in a fully autonomous manner.

        Scheduled task metadata:
        - taskId: ${trigger.taskId}
        - runId: ${trigger.runId}
        - scheduleType: ${trigger.scheduleType}
        - scheduledSessionPermission: ${trigger.scheduledSessionPermission}
        - iteration: ${typeof trigger.iteration === 'number' ? String(trigger.iteration) : 'unknown'}

        ${iterationText}

        If the task is blocked, missing required information, or continuing would only repeat useless attempts, stop making unproductive attempts and clearly state that user intervention is required.
    `)
}

function buildScheduledSessionToolGuidanceInstruction(trigger: Extract<SessionTriggerMetadata, { type: 'scheduled-task' }>): string {
    if (trigger.scheduledSessionPermission === 'aware') {
        return ''
    }

    if (trigger.scheduledSessionPermission === 'self_control') {
        return trimIdent(`
            You may use HAPI scheduler tools only for your own task (${trigger.taskId}).

            Use scheduler tools when needed to adapt your own future executions, for example pausing your own task, resuming it later, canceling it, or updating its prompt/schedule if that is necessary to keep the unattended workflow healthy.

            You must not attempt to manage other scheduled tasks.

            You may also use "functions.hapi__schedule_report_outcome" to report whether this run completed, partially completed, is blocked, or should be abandoned.
        `)
    }

    return trimIdent(`
        You may use the full HAPI scheduler toolset, including creating new scheduled tasks and managing existing ones.

        You may control your own task (${trigger.taskId}) and the wider scheduler system when it is necessary to fulfill the unattended workflow safely.

        You may also use "functions.hapi__schedule_report_outcome" to report whether this run completed, partially completed, is blocked, or should be abandoned.

        If you determine that this looping workflow will keep failing in the future without human intervention, you should use the available scheduler controls to prevent repeated pointless failures.
    `)
}

export function buildCodexSystemPrompt(trigger?: SessionTriggerMetadata): string {
    const sections = [
        ...(trigger?.type === 'scheduled-task' ? [] : [TITLE_INSTRUCTION]),
        SCHEDULE_CREATE_GUIDANCE_INSTRUCTION,
        ...(trigger?.type === 'scheduled-task' ? [
            buildScheduledSessionEnvironmentInstruction(trigger),
            buildScheduledSessionToolGuidanceInstruction(trigger)
        ].filter(Boolean) : [])
    ]

    return sections.join('\n\n')
}

export const codexSystemPrompt = buildCodexSystemPrompt()

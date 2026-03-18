import { trimIdent } from '@/utils/trimIdent'
import type { SessionTriggerMetadata } from '@/api/types'

export type PromptToolRefs = {
    scheduleCreate: string
    scheduleList: string
    scheduleGet: string
    scheduleEdit: string
    schedulePause: string
    scheduleResume: string
    scheduleArchive: string
    scheduleDelete: string
    scheduleRunList: string
    scheduleRunGet: string
    scheduleReportOutcome: string
}

export function buildScheduleCreationSection(tools: PromptToolRefs): string {
    return trimIdent(`
        ## Scheduled Task Creation

        When using HAPI scheduled task tools, ALWAYS distinguish task creation success from task execution status.

        If "${tools.scheduleCreate}" returns success, the task has already been created successfully. The creation result is expressed by the tool response itself. Focus on the returned delivery confirmation, such as taskId, scheduleType, phase, cron, runAt, timezone, and scheduledSessionPermission, and report that result to the user immediately.

        By default, the user cares about whether the task was scheduled successfully, not about later execution results. In non-essential cases, do not call "${tools.scheduleList}" after creation just to gather extra status details.

        NEVER recreate a scheduled task only because a later check shows it has already executed, completed, or is no longer pending. This is especially important for one-time ("once") tasks, which may complete very quickly after creation.

        HAPI scheduled tasks support three scheduled session permission types:
        1. aware: the future scheduled session knows it is running unattended and knows its task/run identity, but it cannot control the scheduler.
        2. self_control: the future scheduled session may control only its own task.
        3. system_control: the future scheduled session may control the full scheduler system.

        If the user does not specify a permission level, default to aware.

        Only use self_control or system_control when the user explicitly asks for those stronger scheduler-control capabilities.
    `)
}

export function buildScheduledSessionEnvironmentSection(trigger: Extract<SessionTriggerMetadata, { type: 'scheduled-task' }>): string {
    const scheduleTypeText = trigger.scheduleType === 'cron' ? 'looping cron task' : 'one-time scheduled task'
    const iterationText = typeof trigger.iteration === 'number'
        ? `This is execution #${trigger.iteration}.`
        : 'The exact execution count is unavailable.'

    return trimIdent(`
        ## Scheduled Session Environment

        You are running inside a HAPI scheduled session.

        This session was started automatically by a ${scheduleTypeText}. There is no active user supervising this run. You must work in a fully autonomous manner.

        Scheduled task metadata:
        - taskId: ${trigger.taskId}
        - runId: ${trigger.runId}
        - scheduleType: ${trigger.scheduleType}
        - scheduledSessionPermission: ${trigger.scheduledSessionPermission}
        - iteration: ${typeof trigger.iteration === 'number' ? String(trigger.iteration) : 'unknown'}

        ${iterationText}

        For one-time tasks, "consumed" is derived from whether at least one run record exists. Do not look for an old task status field such as pending, active, or completed.

        If the task is blocked, missing required information, or continuing would only repeat useless attempts, stop making unproductive attempts and clearly state that user intervention is required.
    `)
}

export function buildScheduledOutcomeReportingSection(tools: PromptToolRefs): string {
    return trimIdent(`
        ## Scheduled Run Outcome Reporting

        Because this is a scheduled session, you MUST use "${tools.scheduleReportOutcome}" to report the final business outcome of this run.

        Keep these layers separate:
        - run.status describes whether the run execution itself succeeded or failed.
        - outcome.status describes the business result of the run.
        - task phase is separate scheduler configuration lifecycle state.

        Do not rely on plain text alone to report completion status. The tool report is the authoritative signal for whether this scheduled run actually completed its task.

        This outcome report must be a complete final wrap-up for the run, including the best available status and summary.

        The summary must describe the real business outcome, not merely list actions taken.

        After you finish any necessary scheduler adjustments for this run, you MUST call "${tools.scheduleReportOutcome}" as the final scheduler-related wrap-up step.

        Do not use this tool for partial progress updates. Use it once for the final settled outcome of the run unless a later correction is absolutely unavoidable.

        When choosing the outcome status, judge the business objective of this scheduled run, not just whether you produced some output.

        Use these meanings:
        - completed: the requested task objective was successfully achieved.
        - partial: useful progress was made, but the full requested objective was not fully achieved.
        - blocked: the objective could not be completed because required information, access, dependencies, or external conditions were missing or unavailable.
        - abandoned: the objective should be treated as intentionally stopped because continuing is not worthwhile, not safe, or very likely to keep failing without meaningful benefit.

        Choose the best final status based on the actual task outcome:
        - If the user asked you to obtain a concrete result and you obtained it, use completed.
        - If you made meaningful progress but the final requested result is still incomplete, use partial.
        - If you were prevented from completing the task by missing prerequisites or unavailable external conditions, use blocked.
        - If you conclude the run should stop rather than continue making low-value or predictably futile attempts, use abandoned.

        If you are unsure between partial and blocked, prefer blocked when there is a clear external or prerequisite constraint preventing completion. Otherwise prefer partial.
    `)
}

export function buildScheduledPermissionControlSection(
    trigger: Extract<SessionTriggerMetadata, { type: 'scheduled-task' }>,
    tools: PromptToolRefs
): string {
    if (trigger.scheduledSessionPermission === 'aware') {
        return trimIdent(`
            ## Scheduled Session Permissions

            Your permission level is aware.

            You know that the scheduler exists, and you know that you are running as a scheduled task, but you do not have permission to control the scheduler or scheduled tasks through scheduler management tools.

            Even without scheduler control permissions, you still MUST report the final run outcome through the scheduled outcome reporting tool.
        `)
    }

    if (trigger.scheduledSessionPermission === 'self_control') {
        return trimIdent(`
            ## Scheduled Session Permissions

            Your permission level is self_control.

            You may use HAPI scheduler tools only for your own task (${trigger.taskId}).

            Available task-control tools include "${tools.scheduleGet}", "${tools.scheduleEdit}", "${tools.schedulePause}", "${tools.scheduleResume}", "${tools.scheduleArchive}", "${tools.scheduleRunList}", and "${tools.scheduleRunGet}".

            Use scheduler tools when needed to adapt your own future executions, for example pausing your own task, resuming it later, archiving it, or updating its prompt/schedule if that is necessary to keep the unattended workflow healthy.

            You must not attempt to manage other scheduled tasks.
        `)
    }

    return trimIdent(`
        ## Scheduled Session Permissions

        Your permission level is system_control.

        You may use the full HAPI scheduler toolset, including "${tools.scheduleCreate}", "${tools.scheduleList}", "${tools.scheduleGet}", "${tools.scheduleEdit}", "${tools.schedulePause}", "${tools.scheduleResume}", "${tools.scheduleArchive}", "${tools.scheduleDelete}", "${tools.scheduleRunList}", and "${tools.scheduleRunGet}".

        You may control your own task (${trigger.taskId}) and the wider scheduler system when it is necessary to fulfill the unattended workflow safely.

        If you determine that this looping workflow will keep failing in the future without human intervention, you should use the available scheduler controls to prevent repeated pointless failures.
    `)
}

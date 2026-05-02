import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ApiSessionClient } from '@/api/apiSession'
import type { SessionTriggerMetadata } from '@/api/types'
import type { ScheduledTaskRun } from '@hapi/protocol'
import { deriveScheduledTask } from '@hapi/protocol'
import { logger } from '@/ui/logger'
import {
    archiveRunnerScheduledTask,
    createRunnerScheduledTask,
    deleteRunnerScheduledTask,
    listRunnerScheduledTaskRuns,
    listRunnerScheduledTasks,
    reportRunnerScheduledTaskOutcome,
    updateRunnerScheduledTask
} from '@/runner/controlClient'

const scheduleAgentSchema = z.enum(['claude', 'codex'])
const scheduleTypeSchema = z.enum(['once', 'cron'])
const scheduleModelSchema = z.string().trim().min(1)
const scheduledSessionPermissionSchema = z.enum(['aware', 'self_control', 'system_control'])
const scheduledTaskOutcomeStatusSchema = z.enum(['completed', 'partial', 'blocked', 'abandoned'])
const scheduledTaskPhaseSchema = z.enum(['enabled', 'paused', 'archived'])
const viewSchema = z.enum(['basic', 'full']).optional()
const delaySchema = z.object({
    years: z.number().int().nonnegative().optional(),
    months: z.number().int().nonnegative().optional(),
    days: z.number().int().nonnegative().optional(),
    hours: z.number().int().nonnegative().optional(),
    minutes: z.number().int().nonnegative().optional(),
    seconds: z.number().int().nonnegative().optional()
}).refine((value) => Object.values(value).some((entry) => typeof entry === 'number' && entry > 0), {
    message: 'at least one delay unit must be greater than zero'
})

type ScheduleToolAccess = 'none' | 'self_control' | 'system_control'

type SchedulerToolResult<T> = {
    ok: boolean
    code: string
    message: string
    data?: T
}

function normalizeRunAt(value: number | string | undefined): number | undefined {
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim()) return Date.parse(value)
    return undefined
}

function getScheduleToolAccess(trigger?: SessionTriggerMetadata): ScheduleToolAccess {
    if (trigger?.type !== 'scheduled-task') return 'system_control'
    if (trigger.scheduledSessionPermission === 'system_control') return 'system_control'
    if (trigger.scheduledSessionPermission === 'self_control') return 'self_control'
    return 'none'
}

function isScheduledTrigger(trigger?: SessionTriggerMetadata): trigger is Extract<SessionTriggerMetadata, { type: 'scheduled-task' }> {
    return trigger?.type === 'scheduled-task'
}

function getCurrentTrigger(client: ApiSessionClient): Extract<SessionTriggerMetadata, { type: 'scheduled-task' }> | null {
    const trigger = client.getMetadata()?.trigger
    return isScheduledTrigger(trigger) ? trigger : null
}

function ensureSelfControlTarget(taskId: string, trigger: Extract<SessionTriggerMetadata, { type: 'scheduled-task' }> | null): SchedulerToolResult<never> | null {
    if (!trigger || trigger.taskId === taskId) return null
    return {
        ok: false,
        code: 'schedule.self_control_forbidden',
        message: `self-control sessions may only manage their own task (${trigger.taskId})`
    }
}

function validateAgentModel(agentFlavor: 'claude' | 'codex', model: string | undefined): SchedulerToolResult<never> | null {
    void agentFlavor
    if (model !== undefined && model.trim().length === 0) {
        return { ok: false, code: 'schedule.invalid_input', message: 'model must not be empty' }
    }
    return null
}

function toToolText<T>(result: SchedulerToolResult<T>): { content: Array<{ type: 'text'; text: string }>; isError: boolean } {
    return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.ok
    }
}

function getRunSortTime(run: ScheduledTaskRun): number {
    return run.triggeredAt ?? run.scheduledFor ?? run.finishedAt ?? 0
}

export async function registerScheduleTools(mcp: McpServer, client: ApiSessionClient): Promise<string[]> {
    const trigger = client.getMetadata()?.trigger
    const access = getScheduleToolAccess(trigger)
    const toolNames: string[] = []

    async function getTaskSnapshot(taskId: string) {
        const [tasks, runs] = await Promise.all([
            listRunnerScheduledTasks(),
            listRunnerScheduledTaskRuns()
        ])
        const task = tasks.find((entry) => entry.id === taskId)
        const taskRuns = runs.filter((run) => run.taskId === taskId).sort((a, b) => getRunSortTime(b) - getRunSortTime(a))
        return { task, taskRuns }
    }

    const createSchema = z.object({
        title: z.string().min(1),
        prompt: z.string().min(1),
        agentFlavor: scheduleAgentSchema,
        model: scheduleModelSchema.optional(),
        scheduleType: scheduleTypeSchema.optional(),
        runAt: z.union([z.number(), z.string()]).optional(),
        delay: delaySchema.optional(),
        cron: z.string().optional(),
        targetDirectory: z.string().min(1),
        timezone: z.string().optional(),
        scheduledSessionPermission: scheduledSessionPermissionSchema.optional()
    })

    const editSchema = z.object({
        taskId: z.string().min(1),
        title: z.string().min(1).optional(),
        prompt: z.string().min(1).optional(),
        agentFlavor: scheduleAgentSchema.optional(),
        model: z.string().optional(),
        scheduleType: scheduleTypeSchema.optional(),
        runAt: z.union([z.number(), z.string()]).optional(),
        delay: delaySchema.optional(),
        cron: z.string().optional(),
        targetDirectory: z.string().min(1).optional(),
        timezone: z.string().optional(),
        scheduledSessionPermission: scheduledSessionPermissionSchema.optional()
    })

    const listSchema = z.object({ view: viewSchema })
    const getSchema = z.object({ taskId: z.string().min(1), view: viewSchema })
    const runListSchema = z.object({ taskId: z.string().min(1).optional(), view: viewSchema })
    const runGetSchema = z.object({ runId: z.string().min(1), view: viewSchema })
    const taskIdSchema = z.object({ taskId: z.string().min(1) })
    const reportOutcomeSchema = z.object({
        status: scheduledTaskOutcomeStatusSchema,
        summary: z.string().min(1),
        needsUserIntervention: z.boolean().optional(),
        permanentFailureLikely: z.boolean().optional()
    })

    if (access === 'system_control') {
        toolNames.push('schedule_create', 'schedule_list', 'schedule_get', 'schedule_run_list', 'schedule_run_get', 'schedule_delete')

        mcp.registerTool('schedule_create', {
            description: 'Create a scheduled task managed by the HAPI runner.',
            title: 'Create Scheduled Task',
            inputSchema: createSchema
        }, async (args) => {
            const scheduleType = args.scheduleType ?? 'once'
            const runAt = normalizeRunAt(args.runAt)
            const modelValidation = validateAgentModel(args.agentFlavor, args.model)
            if (modelValidation) return toToolText(modelValidation)

            if (scheduleType === 'once' && Number.isFinite(runAt) && args.delay) {
                return toToolText({ ok: false, code: 'schedule.invalid_input', message: 'once schedule requires exactly one of runAt or delay' })
            }
            if (scheduleType === 'once' && !Number.isFinite(runAt) && !args.delay) {
                return toToolText({ ok: false, code: 'schedule.invalid_input', message: 'once schedule requires runAt or delay' })
            }
            if (scheduleType === 'cron' && (Number.isFinite(runAt) || args.delay)) {
                return toToolText({ ok: false, code: 'schedule.invalid_input', message: 'cron schedule cannot include runAt or delay' })
            }
            if (scheduleType === 'cron' && !args.cron?.trim()) {
                return toToolText({ ok: false, code: 'schedule.invalid_input', message: 'cron schedule requires a cron expression' })
            }

            const machineId = client.getMetadata()?.machineId
            if (!machineId) {
                return toToolText({ ok: false, code: 'schedule.internal_error', message: 'machineId is unavailable for the current session' })
            }

            try {
                const task = await createRunnerScheduledTask({
                    machineId,
                    createdBySessionId: client.sessionId,
                    title: args.title,
                    prompt: args.prompt,
                    agentFlavor: args.agentFlavor,
                    model: args.model,
                    scheduleType,
                    runAt,
                    delay: args.delay,
                    cron: args.cron,
                    targetDirectory: args.targetDirectory,
                    timezone: args.timezone,
                    scheduledSessionPermission: args.scheduledSessionPermission ?? 'aware'
                })

                if (!task) {
                    return toToolText({ ok: false, code: 'schedule.internal_error', message: 'runner returned no task' })
                }

                return toToolText({
                    ok: true,
                    code: 'ok',
                    message: 'Scheduled task created successfully.',
                    data: {
                        taskId: task.id,
                        title: task.title,
                        scheduleType: task.scheduleType,
                        phase: task.phase,
                        scheduledSessionPermission: task.scheduledSessionPermission,
                        runAt: task.runAt,
                        delay: task.delay,
                        cron: task.cron,
                        timezone: task.timezone
                    }
                })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_create failed', error)
                return toToolText({ ok: false, code: 'schedule.internal_error', message: String(error) })
            }
        })

        mcp.registerTool('schedule_list', {
            description: 'List scheduled tasks managed by the local HAPI runner.',
            title: 'List Scheduled Tasks',
            inputSchema: listSchema
        }, async () => {
            try {
                const tasks = await listRunnerScheduledTasks()
                return toToolText({
                    ok: true,
                    code: 'ok',
                    message: 'Scheduled tasks retrieved.',
                    data: {
                        tasks: tasks.map((task) => ({
                            id: task.id,
                            title: task.title,
                            scheduleType: task.scheduleType,
                            phase: task.phase
                        }))
                    }
                })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_list failed', error)
                return toToolText({ ok: false, code: 'schedule.internal_error', message: String(error) })
            }
        })

        mcp.registerTool('schedule_get', {
            description: 'Get one scheduled task by id.',
            title: 'Get Scheduled Task',
            inputSchema: getSchema
        }, async (args) => {
            try {
                const snapshot = await getTaskSnapshot(args.taskId)
                if (!snapshot.task) {
                    return toToolText({ ok: false, code: 'schedule.task_not_found', message: `Scheduled task not found: ${args.taskId}` })
                }

                const derived = deriveScheduledTask(snapshot.task, snapshot.taskRuns)
                return toToolText({
                    ok: true,
                    code: 'ok',
                    message: 'Scheduled task retrieved.',
                    data: {
                        taskId: snapshot.task.id,
                        title: snapshot.task.title,
                        prompt: snapshot.task.prompt,
                        scheduleType: snapshot.task.scheduleType,
                        phase: snapshot.task.phase,
                        createdBySessionId: snapshot.task.createdBySessionId,
                        scheduledSessionPermission: snapshot.task.scheduledSessionPermission,
                        targetDirectory: snapshot.task.targetDirectory,
                        agentFlavor: snapshot.task.agentFlavor,
                        model: snapshot.task.model,
                        timezone: snapshot.task.timezone,
                        runAt: snapshot.task.runAt,
                        delay: snapshot.task.delay,
                        cron: snapshot.task.cron,
                        ...(args.view === 'full' ? derived : {})
                    }
                })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_get failed', error)
                return toToolText({ ok: false, code: 'schedule.internal_error', message: String(error) })
            }
        })

        mcp.registerTool('schedule_run_list', {
            description: 'List scheduled runs.',
            title: 'List Scheduled Runs',
            inputSchema: runListSchema
        }, async (args) => {
            try {
                const [tasks, runs] = await Promise.all([listRunnerScheduledTasks(), listRunnerScheduledTaskRuns()])
                if (args.taskId && !tasks.some((task) => task.id === args.taskId)) {
                    return toToolText({ ok: false, code: 'schedule.task_not_found', message: `Scheduled task not found: ${args.taskId}` })
                }

                const filtered = runs
                    .filter((run) => !args.taskId || run.taskId === args.taskId)
                    .sort((a, b) => getRunSortTime(b) - getRunSortTime(a))

                return toToolText({
                    ok: true,
                    code: 'ok',
                    message: 'Scheduled runs retrieved.',
                    data: {
                        runs: filtered.map((run) => ({
                            id: run.id,
                            taskId: run.taskId,
                            status: run.status,
                            scheduledFor: run.scheduledFor,
                            sessionId: run.sessionId,
                            outcomeStatus: run.outcome?.status,
                            ...(args.view === 'full' ? {
                                triggeredAt: run.triggeredAt,
                                startedAt: run.startedAt,
                                finishedAt: run.finishedAt,
                                resultSummary: run.resultSummary,
                                errorMessage: run.errorMessage,
                                outcome: run.outcome
                            } : {})
                        }))
                    }
                })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_run_list failed', error)
                return toToolText({ ok: false, code: 'schedule.internal_error', message: String(error) })
            }
        })

        mcp.registerTool('schedule_run_get', {
            description: 'Get one scheduled run by id.',
            title: 'Get Scheduled Run',
            inputSchema: runGetSchema
        }, async (args) => {
            try {
                const runs = await listRunnerScheduledTaskRuns()
                const run = runs.find((entry) => entry.id === args.runId)
                if (!run) {
                    return toToolText({ ok: false, code: 'schedule.run_not_found', message: `Scheduled run not found: ${args.runId}` })
                }

                return toToolText({
                    ok: true,
                    code: 'ok',
                    message: 'Scheduled run retrieved.',
                    data: {
                        runId: run.id,
                        taskId: run.taskId,
                        status: run.status,
                        scheduledFor: run.scheduledFor,
                        triggeredAt: run.triggeredAt,
                        startedAt: run.startedAt,
                        finishedAt: run.finishedAt,
                        sessionId: run.sessionId,
                        resultSummary: run.resultSummary,
                        errorMessage: run.errorMessage,
                        ...(args.view === 'full' ? { outcome: run.outcome } : {})
                    }
                })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_run_get failed', error)
                return toToolText({ ok: false, code: 'schedule.internal_error', message: String(error) })
            }
        })

        mcp.registerTool('schedule_delete', {
            description: 'Delete a scheduled task by id. This removes the task, all of its recorded runs, and any non-creator run sessions linked to those runs. The original creator session is preserved.',
            title: 'Delete Scheduled Task',
            inputSchema: taskIdSchema
        }, async (args) => {
            try {
                const deleted = await deleteRunnerScheduledTask(args.taskId)
                if (!deleted) {
                    return toToolText({ ok: false, code: 'schedule.task_not_found', message: `Scheduled task not found: ${args.taskId}` })
                }
                return toToolText({ ok: true, code: 'ok', message: 'Scheduled task deleted.', data: { taskId: deleted.taskId, deleted: true } })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_delete failed', error)
                return toToolText({ ok: false, code: 'schedule.internal_error', message: String(error) })
            }
        })
    }

    if (access === 'system_control' || access === 'self_control') {
        toolNames.push('schedule_edit', 'schedule_pause', 'schedule_resume', 'schedule_archive')

        mcp.registerTool('schedule_edit', {
            description: access === 'self_control' ? 'Edit your own scheduled task only.' : 'Edit an existing scheduled task.',
            title: 'Edit Scheduled Task',
            inputSchema: editSchema
        }, async (args) => {
            const currentTrigger = getCurrentTrigger(client)
            if (access === 'self_control') {
                const selfControlError = ensureSelfControlTarget(args.taskId, currentTrigger)
                if (selfControlError) return toToolText(selfControlError)
            }

            const runAt = normalizeRunAt(args.runAt)
            const modelValidation = args.agentFlavor ? validateAgentModel(args.agentFlavor, args.model) : null
            if (modelValidation) return toToolText(modelValidation)

            try {
                const task = await updateRunnerScheduledTask({
                    taskId: args.taskId,
                    title: args.title,
                    prompt: args.prompt,
                    agentFlavor: args.agentFlavor,
                    model: args.model,
                    scheduleType: args.scheduleType,
                    runAt,
                    delay: args.delay,
                    cron: args.cron,
                    targetDirectory: args.targetDirectory,
                    timezone: args.timezone,
                    scheduledSessionPermission: args.scheduledSessionPermission
                })

                if (!task) {
                    return toToolText({ ok: false, code: 'schedule.task_not_found', message: `Scheduled task not found: ${args.taskId}` })
                }

                return toToolText({
                    ok: true,
                    code: 'ok',
                    message: 'Scheduled task updated.',
                    data: {
                        taskId: task.id,
                        updatedAt: task.updatedAt,
                        scheduleType: task.scheduleType,
                        scheduledSessionPermission: task.scheduledSessionPermission,
                        runAt: task.runAt,
                        delay: task.delay,
                        cron: task.cron,
                        timezone: task.timezone
                    }
                })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_edit failed', error)
                const message = error instanceof Error ? error.message : String(error)
                const code = typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
                    ? (error as { code: string }).code
                    : 'schedule.internal_error'
                return toToolText({ ok: false, code, message })
            }
        })

        mcp.registerTool('schedule_pause', {
            description: access === 'self_control' ? 'Pause your own scheduled task.' : 'Pause a scheduled task.',
            title: 'Pause Scheduled Task',
            inputSchema: taskIdSchema
        }, async (args) => {
            const currentTrigger = getCurrentTrigger(client)
            if (access === 'self_control') {
                const selfControlError = ensureSelfControlTarget(args.taskId, currentTrigger)
                if (selfControlError) return toToolText(selfControlError)
            }

            try {
                const task = await updateRunnerScheduledTask({ taskId: args.taskId, phase: 'paused' })
                if (!task) {
                    return toToolText({ ok: false, code: 'schedule.task_not_found', message: `Scheduled task not found: ${args.taskId}` })
                }
                return toToolText({ ok: true, code: 'ok', message: 'Scheduled task paused.', data: { taskId: task.id, phase: task.phase, updatedAt: task.updatedAt } })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_pause failed', error)
                const message = error instanceof Error ? error.message : String(error)
                const code = typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
                    ? (error as { code: string }).code
                    : 'schedule.internal_error'
                return toToolText({ ok: false, code, message })
            }
        })

        mcp.registerTool('schedule_resume', {
            description: access === 'self_control' ? 'Resume your own scheduled task.' : 'Resume a scheduled task.',
            title: 'Resume Scheduled Task',
            inputSchema: taskIdSchema
        }, async (args) => {
            const currentTrigger = getCurrentTrigger(client)
            if (access === 'self_control') {
                const selfControlError = ensureSelfControlTarget(args.taskId, currentTrigger)
                if (selfControlError) return toToolText(selfControlError)
            }

            try {
                const task = await updateRunnerScheduledTask({ taskId: args.taskId, phase: 'enabled' })
                if (!task) {
                    return toToolText({ ok: false, code: 'schedule.task_not_found', message: `Scheduled task not found: ${args.taskId}` })
                }
                return toToolText({ ok: true, code: 'ok', message: 'Scheduled task resumed.', data: { taskId: task.id, phase: task.phase, updatedAt: task.updatedAt } })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_resume failed', error)
                const message = error instanceof Error ? error.message : String(error)
                const code = typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
                    ? (error as { code: string }).code
                    : 'schedule.internal_error'
                return toToolText({ ok: false, code, message })
            }
        })

        mcp.registerTool('schedule_archive', {
            description: access === 'self_control' ? 'Archive your own scheduled task.' : 'Archive a scheduled task.',
            title: 'Archive Scheduled Task',
            inputSchema: taskIdSchema
        }, async (args) => {
            const currentTrigger = getCurrentTrigger(client)
            if (access === 'self_control') {
                const selfControlError = ensureSelfControlTarget(args.taskId, currentTrigger)
                if (selfControlError) return toToolText(selfControlError)
            }

            try {
                const task = await archiveRunnerScheduledTask(args.taskId)
                if (!task) {
                    return toToolText({ ok: false, code: 'schedule.task_not_found', message: `Scheduled task not found: ${args.taskId}` })
                }
                return toToolText({ ok: true, code: 'ok', message: 'Scheduled task archived.', data: { taskId: task.id, phase: task.phase, updatedAt: task.updatedAt } })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_archive failed', error)
                const message = error instanceof Error ? error.message : String(error)
                const code = typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
                    ? (error as { code: string }).code
                    : 'schedule.internal_error'
                return toToolText({ ok: false, code, message })
            }
        })
    }

    if (isScheduledTrigger(trigger)) {
        toolNames.push('schedule_report_outcome')
        mcp.registerTool('schedule_report_outcome', {
            description: 'Report the business outcome of the current scheduled run.',
            title: 'Report Scheduled Outcome',
            inputSchema: reportOutcomeSchema
        }, async (args) => {
            try {
                const currentTrigger = getCurrentTrigger(client)
                if (!currentTrigger) {
                    return toToolText({ ok: false, code: 'schedule.outcome_report_forbidden', message: 'current session is not a scheduled task run' })
                }

                const run = await reportRunnerScheduledTaskOutcome({
                    runId: currentTrigger.runId,
                    outcome: {
                        status: args.status,
                        summary: args.summary,
                        needsUserIntervention: args.needsUserIntervention,
                        permanentFailureLikely: args.permanentFailureLikely,
                        reportedAt: Date.now()
                    }
                })

                if (!run) {
                    return toToolText({ ok: false, code: 'schedule.run_not_found', message: `run not found (${currentTrigger.runId})` })
                }

                return toToolText({
                    ok: true,
                    code: 'ok',
                    message: 'Scheduled run outcome reported.',
                    data: {
                        runId: run.id,
                        outcome: run.outcome
                    }
                })
            } catch (error) {
                logger.debug('[hapiMCP] schedule_report_outcome failed', error)
                return toToolText({ ok: false, code: 'schedule.internal_error', message: String(error) })
            }
        })
    }

    return toolNames
}

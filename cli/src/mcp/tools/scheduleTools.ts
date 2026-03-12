import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ApiSessionClient } from '@/api/apiSession'
import { logger } from '@/ui/logger'
import {
    cancelRunnerScheduledTask,
    createRunnerScheduledTask,
    deleteRunnerScheduledTask,
    listRunnerScheduledTaskRuns,
    listRunnerScheduledTasks,
    updateRunnerScheduledTask
} from '@/runner/controlClient'

const scheduleAgentSchema = z.enum(['claude', 'codex'])
const scheduleTypeSchema = z.enum(['once', 'cron'])
const scheduleModelSchema = z.enum(['opus', 'sonnet', 'gpt-5.4'])

function normalizeRunAt(value: number | string | undefined): number | undefined {
    if (typeof value === 'number') {
        return value
    }
    if (typeof value === 'string' && value.trim()) {
        return Date.parse(value)
    }
    return undefined
}

function validateAgentModel(agentFlavor: 'claude' | 'codex', model: string | undefined): string | null {
    if (!model) {
        return null
    }

    if (agentFlavor === 'claude' && model !== 'opus' && model !== 'sonnet') {
        return 'Failed to create scheduled task: claude model must be opus or sonnet'
    }

    if (agentFlavor === 'codex' && model !== 'gpt-5.4') {
        return 'Failed to create scheduled task: codex model must be gpt-5.4'
    }

    return null
}

function validateScheduleArgs(args: {
    agentFlavor: 'claude' | 'codex'
    model?: string
    scheduleType: 'once' | 'cron'
    runAt?: number
    cron?: string
}): string | null {
    const modelError = validateAgentModel(args.agentFlavor, args.model)
    if (modelError) {
        return modelError
    }

    if (args.scheduleType === 'once') {
        if (!Number.isFinite(args.runAt)) {
            return 'Failed to create scheduled task: invalid runAt value'
        }
        if ((args.runAt as number) <= Date.now()) {
            return 'Failed to create scheduled task: runAt must be in the future'
        }
        return null
    }

    if (!args.cron?.trim()) {
        return 'Failed to create scheduled task: cron schedule requires a cron expression'
    }

    return null
}

export async function registerScheduleTools(mcp: McpServer, client: ApiSessionClient): Promise<void> {
    const createScheduleSchema: z.ZodTypeAny = z.object({
        title: z.string().min(1).describe('A short title describing the scheduled task'),
        prompt: z.string().min(1).describe('The prompt to send when the schedule triggers'),
        agentFlavor: scheduleAgentSchema.describe('Target agent type'),
        model: scheduleModelSchema.optional().describe('Allowed values: claude => opus/sonnet, codex => gpt-5.4'),
        scheduleType: scheduleTypeSchema.optional(),
        runAt: z.union([z.number(), z.string()]).optional().describe('For once tasks: epoch milliseconds or ISO datetime string'),
        cron: z.string().optional().describe('For cron tasks: cron expression, e.g. */5 * * * *'),
        targetDirectory: z.string().min(1).describe('Working directory for the spawned session'),
        timezone: z.string().optional(),
        paused: z.boolean().optional()
    })

    const updateScheduleSchema: z.ZodTypeAny = z.object({
        taskId: z.string().min(1),
        title: z.string().min(1).optional(),
        prompt: z.string().min(1).optional(),
        agentFlavor: scheduleAgentSchema.optional(),
        model: z.string().optional().describe('Admin override: supports custom model id in updates'),
        scheduleType: scheduleTypeSchema.optional(),
        runAt: z.union([z.number(), z.string()]).optional(),
        cron: z.string().optional(),
        targetDirectory: z.string().min(1).optional(),
        timezone: z.string().optional(),
        paused: z.boolean().optional()
    })

    const listScheduleSchema: z.ZodTypeAny = z.object({
        includeRuns: z.boolean().optional()
    })

    const taskIdSchema: z.ZodTypeAny = z.object({
        taskId: z.string().min(1)
    })

    mcp.registerTool<any, any>('schedule_create', {
        description: 'Create a scheduled task managed by the HAPI runner. Permissions are fixed to highest mode automatically.',
        title: 'Create Scheduled Task',
        inputSchema: createScheduleSchema
    }, async (args: {
        title: string
        prompt: string
        agentFlavor: 'claude' | 'codex'
        model?: 'opus' | 'sonnet' | 'gpt-5.4'
        scheduleType?: 'once' | 'cron'
        runAt?: number | string
        cron?: string
        targetDirectory: string
        timezone?: string
        paused?: boolean
    }) => {
        const scheduleType = args.scheduleType ?? 'once'
        const runAt = normalizeRunAt(args.runAt)
        const validationError = validateScheduleArgs({
            agentFlavor: args.agentFlavor,
            model: args.model,
            scheduleType,
            runAt,
            cron: args.cron
        })
        if (validationError) {
            return {
                content: [{ type: 'text' as const, text: validationError }],
                isError: true
            }
        }

        try {
            const metadata = client.getMetadata()
            const machineId = metadata?.machineId
            if (!machineId) {
                return {
                    content: [{ type: 'text' as const, text: 'Failed to create scheduled task: machineId is unavailable for the current session' }],
                    isError: true
                }
            }

            const task = await createRunnerScheduledTask({
                machineId,
                createdBySessionId: client.sessionId,
                title: args.title,
                prompt: args.prompt,
                agentFlavor: args.agentFlavor,
                model: args.model,
                scheduleType,
                runAt,
                cron: args.cron,
                targetDirectory: args.targetDirectory,
                timezone: args.timezone,
                paused: args.paused
            })

            if (!task) {
                return {
                    content: [{ type: 'text' as const, text: 'Failed to create scheduled task: runner returned no task' }],
                    isError: true
                }
            }

            return {
                content: [{
                    type: 'text' as const,
                    text: [
                        'Scheduled task created successfully.',
                        `taskId: ${task.id}`,
                        `title: ${task.title}`,
                        `createdAt: ${new Date(task.createdAt).toISOString()}`,
                        `scheduleType: ${task.scheduleType}`,
                        `nextRunAt: ${task.nextRunAt ? new Date(task.nextRunAt).toISOString() : '-'}`,
                        `cron: ${task.scheduleSpec.cron ?? '-'}`,
                        `timezone: ${task.timezone}`,
                        `agent: ${task.agentFlavor}`,
                        `model: ${task.model ?? '-'}`,
                        `directory: ${task.targetDirectory}`
                    ].join('\n')
                }],
                isError: false
            }
        } catch (error) {
            logger.debug('[hapiMCP] schedule_create failed', error)
            return {
                content: [{ type: 'text' as const, text: `Failed to create scheduled task: ${String(error)}` }],
                isError: true
            }
        }
    })

    mcp.registerTool<any, any>('schedule_update', {
        description: 'Update an existing scheduled task managed by the HAPI runner. Agent/model mismatch is rejected.',
        title: 'Update Scheduled Task',
        inputSchema: updateScheduleSchema
    }, async (args: {
        taskId: string
        title?: string
        prompt?: string
        agentFlavor?: 'claude' | 'codex'
        model?: string
        scheduleType?: 'once' | 'cron'
        runAt?: number | string
        cron?: string
        targetDirectory?: string
        timezone?: string
        paused?: boolean
    }) => {
        const runAt = normalizeRunAt(args.runAt)

        if (args.agentFlavor && args.model) {
            const modelError = validateAgentModel(args.agentFlavor, args.model)
            if (modelError) {
                return {
                    content: [{ type: 'text' as const, text: modelError.replace('create', 'update') }],
                    isError: true
                }
            }
        }

        if (args.scheduleType === 'once' && args.runAt !== undefined && !Number.isFinite(runAt)) {
            return {
                content: [{ type: 'text' as const, text: 'Failed to update scheduled task: invalid runAt value' }],
                isError: true
            }
        }

        if (args.scheduleType === 'cron' && args.cron !== undefined && !args.cron.trim()) {
            return {
                content: [{ type: 'text' as const, text: 'Failed to update scheduled task: cron schedule requires a cron expression' }],
                isError: true
            }
        }

        try {
            const task = await updateRunnerScheduledTask({
                taskId: args.taskId,
                title: args.title,
                prompt: args.prompt,
                agentFlavor: args.agentFlavor,
                model: args.model,
                scheduleType: args.scheduleType,
                runAt,
                cron: args.cron,
                targetDirectory: args.targetDirectory,
                timezone: args.timezone,
                paused: args.paused
            })

            if (!task) {
                return {
                    content: [{ type: 'text' as const, text: `Scheduled task not found: ${args.taskId}` }],
                    isError: true
                }
            }

            return {
                content: [{
                    type: 'text' as const,
                    text: [
                        `Scheduled task updated: ${task.id}`,
                        `createdAt: ${new Date(task.createdAt).toISOString()}`,
                        `updatedAt: ${new Date(task.updatedAt).toISOString()}`,
                        `model: ${task.model ?? '-'}`,
                        `paused: ${String(task.paused)}`
                    ].join('\n')
                }],
                isError: false
            }
        } catch (error) {
            logger.debug('[hapiMCP] schedule_update failed', error)
            return {
                content: [{ type: 'text' as const, text: `Failed to update scheduled task: ${String(error)}` }],
                isError: true
            }
        }
    })

    mcp.registerTool<any, any>('schedule_pause', {
        description: 'Pause a scheduled task',
        title: 'Pause Scheduled Task',
        inputSchema: taskIdSchema
    }, async (args: { taskId: string }) => {
        try {
            const task = await updateRunnerScheduledTask({ taskId: args.taskId, paused: true })
            if (!task) {
                return {
                    content: [{ type: 'text' as const, text: `Scheduled task not found: ${args.taskId}` }],
                    isError: true
                }
            }
            return {
                content: [{ type: 'text' as const, text: `Scheduled task paused: ${task.id}` }],
                isError: false
            }
        } catch (error) {
            logger.debug('[hapiMCP] schedule_pause failed', error)
            return {
                content: [{ type: 'text' as const, text: `Failed to pause scheduled task: ${String(error)}` }],
                isError: true
            }
        }
    })

    mcp.registerTool<any, any>('schedule_resume', {
        description: 'Resume a scheduled task',
        title: 'Resume Scheduled Task',
        inputSchema: taskIdSchema
    }, async (args: { taskId: string }) => {
        try {
            const task = await updateRunnerScheduledTask({ taskId: args.taskId, paused: false })
            if (!task) {
                return {
                    content: [{ type: 'text' as const, text: `Scheduled task not found: ${args.taskId}` }],
                    isError: true
                }
            }
            return {
                content: [{ type: 'text' as const, text: `Scheduled task resumed: ${task.id}` }],
                isError: false
            }
        } catch (error) {
            logger.debug('[hapiMCP] schedule_resume failed', error)
            return {
                content: [{ type: 'text' as const, text: `Failed to resume scheduled task: ${String(error)}` }],
                isError: true
            }
        }
    })

    mcp.registerTool<any, any>('schedule_list', {
        description: 'List scheduled tasks managed by the local HAPI runner',
        title: 'List Scheduled Tasks',
        inputSchema: listScheduleSchema
    }, async (args: { includeRuns?: boolean }) => {
        try {
            const tasks = await listRunnerScheduledTasks()
            const runs = args.includeRuns ? await listRunnerScheduledTaskRuns() : []
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({ tasks, runs }, null, 2)
                }],
                isError: false
            }
        } catch (error) {
            logger.debug('[hapiMCP] schedule_list failed', error)
            return {
                content: [{ type: 'text' as const, text: `Failed to list scheduled tasks: ${String(error)}` }],
                isError: true
            }
        }
    })

    mcp.registerTool<any, any>('schedule_cancel', {
        description: 'Cancel a scheduled task by id',
        title: 'Cancel Scheduled Task',
        inputSchema: taskIdSchema
    }, async (args: { taskId: string }) => {
        try {
            const task = await cancelRunnerScheduledTask(args.taskId)
            if (!task) {
                return {
                    content: [{ type: 'text' as const, text: `Scheduled task not found: ${args.taskId}` }],
                    isError: true
                }
            }
            return {
                content: [{ type: 'text' as const, text: `Scheduled task canceled: ${task.id}` }],
                isError: false
            }
        } catch (error) {
            logger.debug('[hapiMCP] schedule_cancel failed', error)
            return {
                content: [{ type: 'text' as const, text: `Failed to cancel scheduled task: ${String(error)}` }],
                isError: true
            }
        }
    })

    mcp.registerTool<any, any>('schedule_delete', {
        description: 'Delete a scheduled task by id',
        title: 'Delete Scheduled Task',
        inputSchema: taskIdSchema
    }, async (args: { taskId: string }) => {
        try {
            const deleted = await deleteRunnerScheduledTask(args.taskId)
            if (!deleted) {
                return {
                    content: [{ type: 'text' as const, text: `Scheduled task not found: ${args.taskId}` }],
                    isError: true
                }
            }
            return {
                content: [{ type: 'text' as const, text: `Scheduled task deleted: ${deleted.taskId}` }],
                isError: false
            }
        } catch (error) {
            logger.debug('[hapiMCP] schedule_delete failed', error)
            return {
                content: [{ type: 'text' as const, text: `Failed to delete scheduled task: ${String(error)}` }],
                isError: true
            }
        }
    })
}

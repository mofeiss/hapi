import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ApiSessionClient } from '@/api/apiSession'
import { logger } from '@/ui/logger'
import {
    cancelRunnerScheduledTask,
    createRunnerScheduledTask,
    listRunnerScheduledTaskRuns,
    listRunnerScheduledTasks
} from '@/runner/controlClient'

export async function registerScheduleTools(mcp: McpServer, client: ApiSessionClient): Promise<void> {
    const createScheduleSchema: z.ZodTypeAny = z.object({
        title: z.string().min(1).describe('A short title describing the scheduled task'),
        prompt: z.string().min(1).describe('The prompt to send when the schedule triggers'),
        runAt: z.union([z.number(), z.string()]).describe('The execution time as epoch milliseconds or an ISO datetime string'),
        targetDirectory: z.string().min(1).describe('Working directory for the spawned session'),
        agentFlavor: z.enum(['claude', 'codex']).optional(),
        permissionMode: z.string().optional(),
        basePermissionMode: z.string().optional(),
        model: z.string().optional(),
        reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
        timezone: z.string().optional()
    })

    const listScheduleSchema: z.ZodTypeAny = z.object({
        includeRuns: z.boolean().optional()
    })

    const cancelScheduleSchema: z.ZodTypeAny = z.object({
        taskId: z.string().min(1)
    })

    mcp.registerTool<any, any>('schedule_create', {
        description: 'Create a one-time scheduled task managed by the HAPI runner',
        title: 'Create Scheduled Task',
        inputSchema: createScheduleSchema
    }, async (args: {
        title: string
        prompt: string
        runAt: number | string
        targetDirectory: string
        agentFlavor?: 'claude' | 'codex'
        permissionMode?: string
        basePermissionMode?: string
        model?: string
        reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
        timezone?: string
    }) => {
        const runAt = typeof args.runAt === 'string' ? Date.parse(args.runAt) : args.runAt
        if (!Number.isFinite(runAt)) {
            return {
                content: [{ type: 'text' as const, text: 'Failed to create scheduled task: invalid runAt value' }],
                isError: true
            }
        }

        if (runAt <= Date.now()) {
            return {
                content: [{ type: 'text' as const, text: 'Failed to create scheduled task: runAt must be in the future' }],
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
                runAt,
                targetDirectory: args.targetDirectory,
                agentFlavor: args.agentFlavor,
                permissionMode: args.permissionMode,
                basePermissionMode: args.basePermissionMode,
                model: args.model,
                reasoningEffort: args.reasoningEffort,
                timezone: args.timezone
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
                        `Scheduled task created successfully.`,
                        `taskId: ${task.id}`,
                        `title: ${task.title}`,
                        `runAt: ${new Date(task.nextRunAt ?? runAt).toISOString()}`,
                        `timezone: ${task.timezone}`,
                        `agent: ${task.agentFlavor}`,
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
        inputSchema: cancelScheduleSchema
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
}

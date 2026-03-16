import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    createRunnerScheduledTask,
    updateRunnerScheduledTask,
    cancelRunnerScheduledTask,
    deleteRunnerScheduledTask,
    listRunnerScheduledTasks,
    listRunnerScheduledTaskRuns,
    reportRunnerScheduledTaskOutcome
} = vi.hoisted(() => ({
    createRunnerScheduledTask: vi.fn(),
    updateRunnerScheduledTask: vi.fn(),
    cancelRunnerScheduledTask: vi.fn(),
    deleteRunnerScheduledTask: vi.fn(),
    listRunnerScheduledTasks: vi.fn(),
    listRunnerScheduledTaskRuns: vi.fn(),
    reportRunnerScheduledTaskOutcome: vi.fn()
}))

vi.mock('@/runner/controlClient', () => ({
    createRunnerScheduledTask,
    updateRunnerScheduledTask,
    cancelRunnerScheduledTask,
    deleteRunnerScheduledTask,
    listRunnerScheduledTasks,
    listRunnerScheduledTaskRuns,
    reportRunnerScheduledTaskOutcome
}))

import { registerScheduleTools } from './scheduleTools'

type RegisteredTool = {
    config: { description?: string }
    handler: (args: any) => Promise<any>
}

function createMcpServerMock() {
    const tools = new Map<string, RegisteredTool>()
    return {
        tools,
        server: {
            registerTool: vi.fn((name: string, config: { description?: string }, handler: (args: any) => Promise<any>) => {
                tools.set(name, { config, handler })
            })
        }
    }
}

function createClient(trigger?: any) {
    return {
        sessionId: 'session-1',
        getMetadata: () => ({
            machineId: 'machine-1',
            trigger
        })
    } as any
}

describe('registerScheduleTools', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('exposes full scheduler controls for regular sessions', async () => {
        const { server } = createMcpServerMock()
        const toolNames = await registerScheduleTools(server as any, createClient())

        expect(toolNames).toEqual([
            'schedule_create',
            'schedule_update',
            'schedule_pause',
            'schedule_resume',
            'schedule_cancel',
            'schedule_list',
            'schedule_delete'
        ])
        expect(toolNames).not.toContain('schedule_report_outcome')
    })

    it('only exposes report_outcome for aware scheduled sessions', async () => {
        const { server } = createMcpServerMock()
        const toolNames = await registerScheduleTools(server as any, createClient({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'aware',
            iteration: 2
        }))

        expect(toolNames).toEqual(['schedule_report_outcome'])
    })

    it('limits self_control sessions to their own task plus outcome reporting', async () => {
        const { server, tools } = createMcpServerMock()
        const toolNames = await registerScheduleTools(server as any, createClient({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'self_control',
            iteration: 3
        }))

        expect(toolNames).toEqual([
            'schedule_update',
            'schedule_pause',
            'schedule_resume',
            'schedule_cancel',
            'schedule_report_outcome'
        ])
        expect(toolNames).not.toContain('schedule_create')
        expect(toolNames).not.toContain('schedule_list')
        expect(toolNames).not.toContain('schedule_delete')

        const updateResult = await tools.get('schedule_update')!.handler({ taskId: 'task-2', paused: true })
        expect(updateResult.isError).toBe(true)
        expect(String(updateResult.content[0]?.text)).toContain('self-control sessions may only manage their own task (task-1)')
        expect(updateRunnerScheduledTask).not.toHaveBeenCalled()
    })

    it('allows self_control sessions to update their own task', async () => {
        const { server, tools } = createMcpServerMock()
        updateRunnerScheduledTask.mockResolvedValue({
            id: 'task-1',
            createdAt: 1,
            updatedAt: 2,
            scheduledSessionPermission: 'self_control',
            model: 'sonnet',
            paused: true
        })

        await registerScheduleTools(server as any, createClient({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'self_control',
            iteration: 3
        }))

        const updateResult = await tools.get('schedule_update')!.handler({ taskId: 'task-1', paused: true })
        expect(updateResult.isError).toBe(false)
        expect(updateRunnerScheduledTask).toHaveBeenCalledWith({ taskId: 'task-1', paused: true, runAt: undefined, cron: undefined, title: undefined, prompt: undefined, agentFlavor: undefined, model: undefined, scheduleType: undefined, targetDirectory: undefined, timezone: undefined, scheduledSessionPermission: undefined })
    })

    it('exposes full scheduler controls and outcome reporting for system_control sessions', async () => {
        const { server } = createMcpServerMock()
        const toolNames = await registerScheduleTools(server as any, createClient({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'system_control',
            iteration: 4
        }))

        expect(toolNames).toEqual([
            'schedule_create',
            'schedule_update',
            'schedule_pause',
            'schedule_resume',
            'schedule_cancel',
            'schedule_list',
            'schedule_delete',
            'schedule_report_outcome'
        ])
    })

    it('reports outcome for any scheduled session using the current run id', async () => {
        const { server, tools } = createMcpServerMock()
        reportRunnerScheduledTaskOutcome.mockResolvedValue({
            id: 'run-1',
            taskOutcome: {
                status: 'blocked',
                summary: 'Need credentials',
                needsUserIntervention: true,
                permanentFailureLikely: false,
                reportedAt: 123
            }
        })

        await registerScheduleTools(server as any, createClient({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'aware',
            iteration: 2
        }))

        const result = await tools.get('schedule_report_outcome')!.handler({
            status: 'blocked',
            summary: 'Need credentials',
            needsUserIntervention: true,
            permanentFailureLikely: false
        })

        expect(result.isError).toBe(false)
        expect(reportRunnerScheduledTaskOutcome).toHaveBeenCalledTimes(1)
        expect(reportRunnerScheduledTaskOutcome.mock.calls[0][0]).toMatchObject({
            runId: 'run-1',
            outcome: {
                status: 'blocked',
                summary: 'Need credentials',
                needsUserIntervention: true,
                permanentFailureLikely: false
            }
        })
        expect(typeof reportRunnerScheduledTaskOutcome.mock.calls[0][0].outcome.reportedAt).toBe('number')
    })
})

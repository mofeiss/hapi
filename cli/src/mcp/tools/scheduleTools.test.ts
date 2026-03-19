import { beforeEach, describe, expect, it, vi } from 'vitest'

const createRunnerScheduledTask = vi.fn()
const updateRunnerScheduledTask = vi.fn()
const archiveRunnerScheduledTask = vi.fn()
const deleteRunnerScheduledTask = vi.fn()
const listRunnerScheduledTasks = vi.fn()
const listRunnerScheduledTaskRuns = vi.fn()
const reportRunnerScheduledTaskOutcome = vi.fn()

vi.mock('@/runner/controlClient', () => ({
    createRunnerScheduledTask,
    updateRunnerScheduledTask,
    archiveRunnerScheduledTask,
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

function parseToolResult(result: any) {
    return JSON.parse(String(result.content[0]?.text))
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
            'schedule_list',
            'schedule_get',
            'schedule_run_list',
            'schedule_run_get',
            'schedule_delete',
            'schedule_edit',
            'schedule_pause',
            'schedule_resume',
            'schedule_archive'
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
            'schedule_edit',
            'schedule_pause',
            'schedule_resume',
            'schedule_archive',
            'schedule_report_outcome'
        ])

        const updateResult = await tools.get('schedule_edit')!.handler({ taskId: 'task-2', title: 'x' })
        const parsed = parseToolResult(updateResult)
        expect(parsed.ok).toBe(false)
        expect(parsed.code).toBe('schedule.self_control_forbidden')
        expect(updateRunnerScheduledTask).not.toHaveBeenCalled()
    })

    it('allows self_control sessions to edit their own task', async () => {
        const { server, tools } = createMcpServerMock()
        updateRunnerScheduledTask.mockResolvedValue({
            id: 'task-1',
            updatedAt: 2,
            scheduleType: 'cron',
            scheduledSessionPermission: 'self_control',
            timezone: 'Asia/Shanghai',
            cron: '*/5 * * * *'
        })

        await registerScheduleTools(server as any, createClient({
            type: 'scheduled-task',
            taskId: 'task-1',
            runId: 'run-1',
            scheduleType: 'cron',
            scheduledSessionPermission: 'self_control',
            iteration: 3
        }))

        const updateResult = await tools.get('schedule_edit')!.handler({ taskId: 'task-1', cron: '*/5 * * * *' })
        const parsed = parseToolResult(updateResult)
        expect(parsed.ok).toBe(true)
        expect(updateRunnerScheduledTask).toHaveBeenCalledWith({
            taskId: 'task-1',
            title: undefined,
            prompt: undefined,
            agentFlavor: undefined,
            model: undefined,
            scheduleType: undefined,
            runAt: undefined,
            delay: undefined,
            cron: '*/5 * * * *',
            targetDirectory: undefined,
            timezone: undefined,
            scheduledSessionPermission: undefined
        })
    })

    it('reports outcome for any scheduled session using the current run id', async () => {
        const { server, tools } = createMcpServerMock()
        reportRunnerScheduledTaskOutcome.mockResolvedValue({
            id: 'run-1',
            outcome: {
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

        const parsed = parseToolResult(result)
        expect(parsed.ok).toBe(true)
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

    it('passes delay for once schedule creation without requiring runAt', async () => {
        const { server, tools } = createMcpServerMock()
        createRunnerScheduledTask.mockResolvedValue({
            id: 'task-1',
            title: 'delay task',
            scheduleType: 'once',
            phase: 'enabled',
            scheduledSessionPermission: 'aware',
            timezone: 'Asia/Shanghai',
            runAt: 1,
            delay: { minutes: 1 }
        })

        await registerScheduleTools(server as any, createClient())

        const result = await tools.get('schedule_create')!.handler({
            title: 'delay task',
            prompt: 'PONG',
            agentFlavor: 'codex',
            scheduleType: 'once',
            delay: { minutes: 1 },
            targetDirectory: '/tmp'
        })

        const parsed = parseToolResult(result)
        expect(parsed.ok).toBe(true)
        expect(createRunnerScheduledTask).toHaveBeenCalledWith(expect.objectContaining({
            scheduleType: 'once',
            runAt: undefined,
            delay: { minutes: 1 }
        }))
    })

    it('rejects once schedule when both runAt and delay are provided', async () => {
        const { server, tools } = createMcpServerMock()
        await registerScheduleTools(server as any, createClient())

        const result = await tools.get('schedule_create')!.handler({
            title: 'bad task',
            prompt: 'PONG',
            agentFlavor: 'codex',
            scheduleType: 'once',
            runAt: '2026-03-20T01:00:00+08:00',
            delay: { minutes: 1 },
            targetDirectory: '/tmp'
        })

        const parsed = parseToolResult(result)
        expect(parsed.ok).toBe(false)
        expect(parsed.code).toBe('schedule.invalid_input')
        expect(createRunnerScheduledTask).not.toHaveBeenCalled()
    })
})

import { describe, expect, it } from 'vitest'

import type { ScheduledTask, ScheduledTaskRun } from '@hapi/protocol'

import { RunnerSchedulerService } from './service'

class InMemorySchedulerStore {
    state: { tasks: ScheduledTask[]; runs: ScheduledTaskRun[] } = {
        tasks: [],
        runs: []
    }

    async read() {
        return this.state
    }

    async write(state: { tasks: ScheduledTask[]; runs: ScheduledTaskRun[] }) {
        this.state = state
    }

    async listTasks() {
        return this.state.tasks
    }

    async listRuns() {
        return this.state.runs
    }

    async update(
        updater: (state: { tasks: ScheduledTask[]; runs: ScheduledTaskRun[] }) => { tasks: ScheduledTask[]; runs: ScheduledTaskRun[] } | Promise<{ tasks: ScheduledTask[]; runs: ScheduledTaskRun[] }>
    ) {
        const next = await updater(this.state)
        this.state = next
        return next
    }
}

describe('RunnerSchedulerService', () => {
    it('keeps the triggered run id so outcome reporting can find the same run', async () => {
        const now = Date.parse('2026-03-20T02:40:12.000Z')
        const store = new InMemorySchedulerStore()
        const seenRunIds: string[] = []

        const scheduler = new RunnerSchedulerService(
            store as any,
            async ({ run }) => {
                seenRunIds.push(run.id)
                return {
                    sessionId: 'session-1',
                    resultSummary: 'Scheduled prompt delivered'
                }
            }
        )

        const task = await scheduler.createTask({
            machineId: 'machine-1',
            namespace: 'default',
            title: 'Ping once',
            prompt: 'PONG',
            agentFlavor: 'codex',
            targetDirectory: '/tmp',
            scheduleType: 'once',
            runAt: now - 1000,
            scheduledSessionPermission: 'aware'
        })

        await scheduler.processDueTasks(now)

        expect(seenRunIds).toHaveLength(1)

        const runs = await scheduler.listRuns({ taskId: task.id, machineId: 'machine-1' })
        expect(runs).toHaveLength(1)
        expect(runs[0]?.id).toBe(seenRunIds[0])

        const updatedRun = await scheduler.reportTaskOutcome({
            runId: seenRunIds[0]!,
            outcome: {
                status: 'completed',
                summary: 'PONG',
                reportedAt: now
            }
        })

        expect(updatedRun?.id).toBe(seenRunIds[0])
        expect(updatedRun?.outcome?.summary).toBe('PONG')
    })
})

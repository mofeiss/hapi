import type { ScheduledTask, ScheduledTaskDerived, ScheduledTaskRun } from './types'

function getLatestScheduledTaskRun(task: ScheduledTask, runs: readonly ScheduledTaskRun[]): ScheduledTaskRun | undefined {
    return runs
        .filter((run) => run.taskId === task.id)
        .sort((a, b) => {
            const left = a.triggeredAt ?? a.scheduledFor ?? a.finishedAt ?? 0
            const right = b.triggeredAt ?? b.scheduledFor ?? b.finishedAt ?? 0
            return right - left
        })[0]
}

export function isScheduledTaskConsumed(task: ScheduledTask, runs: readonly ScheduledTaskRun[]): boolean {
    return task.scheduleType === 'once' && runs.some((run) => run.taskId === task.id)
}

export function getScheduledTaskDisplayStatus(task: ScheduledTask, runs: readonly ScheduledTaskRun[]): ScheduledTaskDerived['displayStatus'] {
    const latestRun = getLatestScheduledTaskRun(task, runs)
    if (!latestRun) {
        return 'ready'
    }

    if (task.scheduleType === 'once') {
        if (latestRun.status !== 'succeeded') {
            return 'failed'
        }

        return latestRun.outcome ? 'completed' : 'succeeded'
    }

    return latestRun.status === 'succeeded' ? 'healthy' : 'failed'
}

export function deriveScheduledTask(task: ScheduledTask, runs: readonly ScheduledTaskRun[], nextRunAt?: number): ScheduledTaskDerived {
    const taskRuns = runs.filter((run) => run.taskId === task.id)
    const latestRun = getLatestScheduledTaskRun(task, taskRuns)
    const lastRunAt = latestRun?.finishedAt ?? latestRun?.startedAt ?? latestRun?.triggeredAt

    return {
        consumed: isScheduledTaskConsumed(task, taskRuns),
        runCount: taskRuns.length,
        lastRunAt,
        nextRunAt,
        latestRunId: latestRun?.id,
        latestRunStatus: latestRun?.status,
        latestRunOutcomeStatus: latestRun?.outcome?.status,
        displayStatus: getScheduledTaskDisplayStatus(task, taskRuns)
    }
}

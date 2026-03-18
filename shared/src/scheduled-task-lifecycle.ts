import type { ScheduledTask } from './types'

export type ScheduledTaskPauseValidationCode =
    | 'once_already_consumed'
    | 'once_expired'
    | 'unknown'

export function hasScheduledTaskExecuted(task: ScheduledTask): boolean {
    return typeof task.lastRunAt === 'number' && Number.isFinite(task.lastRunAt)
}

export function isScheduledTaskOnceExpired(task: ScheduledTask, now = Date.now()): boolean {
    if (task.scheduleType !== 'once') return false

    const runAt = task.scheduleSpec.runAt
    if (typeof runAt !== 'number' || !Number.isFinite(runAt)) {
        return true
    }

    return runAt <= now
}

export function getScheduledTaskPauseValidationCode(
    task: ScheduledTask,
    now = Date.now(),
): ScheduledTaskPauseValidationCode | null {
    if (task.scheduleType === 'cron') {
        return null
    }

    if (hasScheduledTaskExecuted(task)) {
        return 'once_already_consumed'
    }

    const runAt = task.scheduleSpec.runAt
    if (typeof runAt !== 'number' || !Number.isFinite(runAt)) {
        return 'unknown'
    }

    if (runAt <= now) {
        return 'once_expired'
    }

    return null
}

export function canScheduledTaskTogglePaused(task: ScheduledTask, now = Date.now()): boolean {
    return getScheduledTaskPauseValidationCode(task, now) === null
}

export function isScheduledTaskPauseLocked(task: ScheduledTask, now = Date.now()): boolean {
    return !canScheduledTaskTogglePaused(task, now)
}


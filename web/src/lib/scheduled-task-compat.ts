import { CronExpressionParser } from 'cron-parser'

import type { ScheduledTask } from '@/types/api'

export function hasScheduledTaskExecuted(task: ScheduledTask): boolean {
    return Boolean(task.derived.runCount > 0)
}

export function getScheduledTaskPauseValidationCode(task: ScheduledTask): 'once_already_consumed' | 'once_expired' | 'unknown' | null {
    if (task.scheduleType === 'cron') {
        return null
    }

    if (hasScheduledTaskExecuted(task)) {
        return 'once_already_consumed'
    }

    if (typeof task.runAt !== 'number') {
        return 'unknown'
    }

    if (task.runAt <= Date.now()) {
        return 'once_expired'
    }

    return null
}

export function canScheduledTaskTogglePaused(task: ScheduledTask): boolean {
    return getScheduledTaskPauseValidationCode(task) === null
}

export function isScheduledTaskPauseLocked(task: ScheduledTask): boolean {
    return !canScheduledTaskTogglePaused(task)
}

export function isScheduledCronValid(task: ScheduledTask): boolean {
    if (task.scheduleType !== 'cron') {
        return true
    }

    if (!task.cron?.trim()) {
        return false
    }

    try {
        CronExpressionParser.parse(task.cron, {
            currentDate: Date.now(),
            tz: task.timezone,
        }).next()
        return true
    } catch {
        return false
    }
}

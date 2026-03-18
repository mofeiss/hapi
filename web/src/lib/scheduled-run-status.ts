import type { ScheduledTaskRun } from '@/types/api'

export function getScheduledRunStatusToneClassName(status: ScheduledTaskRun['status']): string {
    return status === 'succeeded'
        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
        : 'bg-red-500/12 text-red-700 dark:text-red-300'
}

export function getScheduledRunFillClassName(status: ScheduledTaskRun['status']): string {
    return status === 'succeeded'
        ? 'bg-emerald-600'
        : 'bg-red-600'
}

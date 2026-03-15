import type { ScheduledTaskRun } from '@/types/api'

export function getScheduledRunStatusToneClassName(status: ScheduledTaskRun['status']): string {
    return status === 'succeeded'
        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
        : status === 'failed'
            ? 'bg-red-500/12 text-red-700 dark:text-red-300'
            : status === 'running'
                ? 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
                : 'bg-[var(--app-subtle-bg)] text-[var(--app-fg)]'
}

export function getScheduledRunFillClassName(status: ScheduledTaskRun['status']): string {
    return status === 'succeeded'
        ? 'bg-emerald-600'
        : status === 'failed'
            ? 'bg-red-600'
            : status === 'running'
                ? 'bg-sky-600'
                : 'bg-[var(--app-hint)]'
}

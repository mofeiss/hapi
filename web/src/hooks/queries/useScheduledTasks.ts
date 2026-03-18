import { useQuery } from '@tanstack/react-query'
import { deriveScheduledTask } from '@hapi/protocol'
import { CronExpressionParser } from 'cron-parser'

import type { ApiClient } from '@/api/client'
import type { ScheduledTaskRun, ScheduledTaskView } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

function resolveTaskNextRunAt(task: ScheduledTaskView | Parameters<typeof deriveScheduledTask>[0]): number | undefined {
    if (task.phase !== 'enabled') {
        return undefined
    }

    if (task.scheduleType === 'once') {
        return task.runAt
    }

    if (!task.cron?.trim()) {
        return undefined
    }

    try {
        const interval = CronExpressionParser.parse(task.cron, {
            currentDate: Date.now(),
            tz: task.timezone,
        })
        return interval.next().getTime()
    } catch {
        return undefined
    }
}

export function useScheduledTasks(api: ApiClient | null): {
    tasks: ScheduledTaskView[]
    runs: ScheduledTaskRun[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const query = useQuery({
        queryKey: queryKeys.scheduledTasks,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.getScheduledTasks()
        },
        enabled: Boolean(api),
    })

    return {
        tasks: (query.data?.tasks ?? []).map((task) => {
            const taskRuns = (query.data?.runs ?? []).filter((run) => run.taskId === task.id)
            const nextRunAt = resolveTaskNextRunAt(task)
            const derived = deriveScheduledTask(task, taskRuns, nextRunAt)

            return {
                ...task,
                derived,
                nextRunAt: derived.nextRunAt,
                lastRunAt: derived.lastRunAt,
                displayStatus: derived.displayStatus,
                latestRunStatus: derived.latestRunStatus,
                paused: task.phase === 'paused',
                status: task.phase === 'archived'
                    ? (derived.latestRunStatus === 'failed' ? 'failed' : task.scheduleType === 'once' ? 'completed' : 'archived')
                    : 'active',
                scheduleSpec: {
                    runAt: task.runAt,
                    cron: task.cron,
                },
            }
        }),
        runs: (query.data?.runs ?? []).map((run) => ({
            ...run,
            taskOutcome: run.outcome,
            error: run.errorMessage,
        })),
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load scheduled tasks' : null,
        refetch: query.refetch,
    }
}

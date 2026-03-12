import { useQuery } from '@tanstack/react-query'

import type { ApiClient } from '@/api/client'
import type { ScheduledTask, ScheduledTaskRun } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

export function useScheduledTasks(api: ApiClient | null): {
    tasks: ScheduledTask[]
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
        tasks: query.data?.tasks ?? [],
        runs: query.data?.runs ?? [],
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load scheduled tasks' : null,
        refetch: query.refetch,
    }
}


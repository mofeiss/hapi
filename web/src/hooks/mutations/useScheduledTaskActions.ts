import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiClient } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'

export function useScheduledTaskActions(api: ApiClient | null): {
    cancelScheduledTask: (taskId: string) => Promise<void>
    isPending: boolean
} {
    const queryClient = useQueryClient()

    const cancelMutation = useMutation({
        mutationFn: async (taskId: string) => {
            if (!api) {
                throw new Error('API unavailable')
            }
            await api.cancelScheduledTask(taskId)
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks })
        }
    })

    return {
        cancelScheduledTask: cancelMutation.mutateAsync,
        isPending: cancelMutation.isPending
    }
}


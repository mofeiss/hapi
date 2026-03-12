import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiClient } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'

export function useScheduledTaskActions(api: ApiClient | null): {
    cancelScheduledTask: (taskId: string) => Promise<void>
    deleteScheduledTask: (taskId: string) => Promise<void>
    updateScheduledTask: (body: Record<string, unknown>) => Promise<void>
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

    const updateMutation = useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            if (!api) {
                throw new Error('API unavailable')
            }
            await api.updateScheduledTask(body)
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (taskId: string) => {
            if (!api) {
                throw new Error('API unavailable')
            }
            await api.deleteScheduledTask(taskId)
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.scheduledTasks })
        }
    })

    return {
        cancelScheduledTask: cancelMutation.mutateAsync,
        updateScheduledTask: updateMutation.mutateAsync,
        deleteScheduledTask: deleteMutation.mutateAsync,
        isPending: cancelMutation.isPending || updateMutation.isPending || deleteMutation.isPending
    }
}

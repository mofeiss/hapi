import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { AgentModelsResponse } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

export function useAgentModels(
    api: ApiClient | null,
    machineId: string | null,
    agent: 'claude' | 'codex' | 'gemini' | 'opencode'
): {
    data: AgentModelsResponse | null
    isLoading: boolean
    error: string | null
} {
    const query = useQuery({
        queryKey: machineId ? queryKeys.agentModels(machineId, agent) : ['agent-models', 'none', agent] as const,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            if (!machineId) {
                throw new Error('Machine is required')
            }
            return await api.getAgentModels(machineId, agent)
        },
        enabled: Boolean(api && machineId && agent === 'codex'),
        staleTime: 30_000
    })

    return {
        data: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load model list' : null
    }
}

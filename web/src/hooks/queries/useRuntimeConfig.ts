import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { DiagnosticLoggingRuntimeConfig } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

const DEFAULT_CONFIG: DiagnosticLoggingRuntimeConfig = {
    enabled: false,
    initial: false,
    overridden: false
}

export function useRuntimeConfig(api: ApiClient | null, enabled: boolean): {
    diagnosticLogging: DiagnosticLoggingRuntimeConfig
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const query = useQuery({
        queryKey: queryKeys.runtimeConfig,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.getRuntimeConfig()
        },
        enabled: Boolean(api && enabled)
    })

    return {
        diagnosticLogging: query.data?.diagnosticLogging ?? DEFAULT_CONFIG,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load runtime config' : null,
        refetch: query.refetch
    }
}


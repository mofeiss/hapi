import { z } from 'zod'
import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager'
import { setDiagnosticLoggingRuntimeOverride } from '@/config/diagnosticLoggingRuntime'

const payloadSchema = z.object({
    enabled: z.boolean()
})

export function registerDiagnosticLoggingHandlers(rpcHandlerManager: RpcHandlerManager): void {
    rpcHandlerManager.registerHandler('set-diagnostic-logging', async (payload: unknown) => {
        const parsed = payloadSchema.safeParse(payload)
        if (!parsed.success) {
            throw new Error('Invalid diagnostic logging payload')
        }

        setDiagnosticLoggingRuntimeOverride(parsed.data.enabled)
        return {
            applied: {
                diagnosticLogging: parsed.data.enabled
            }
        }
    })
}


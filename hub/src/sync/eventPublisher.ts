import type { SyncEvent } from '@hapi/protocol/types'
import type { SSEManager } from '../sse/sseManager'
import { isDiagnosticLoggingEnabled } from '../config/diagnosticLogging'
import { describeTraceValue, writeTraceDebugLog } from '../utils/traceDebugLog'

export type SyncEventListener = (event: SyncEvent) => void

export class EventPublisher {
    private readonly listeners: Set<SyncEventListener> = new Set()

    constructor(
        private readonly sseManager: SSEManager,
        private readonly resolveNamespace: (event: SyncEvent) => string | undefined
    ) {
    }

    subscribe(listener: SyncEventListener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    emit(event: SyncEvent): void {
        const namespace = this.resolveNamespace(event)
        const enrichedEvent = namespace ? { ...event, namespace } : event

        if (isDiagnosticLoggingEnabled()) {
            const trace = describeTraceValue(enrichedEvent)
            writeTraceDebugLog('TRACE HUB PUBLISHER event.emit', {
                type: enrichedEvent.type,
                namespace: namespace ?? null,
                payloadBytes: trace.payloadBytes,
                payloadSha256: trace.payloadSha256,
                summary: trace.summary
            })
        }

        for (const listener of this.listeners) {
            try {
                listener(enrichedEvent)
            } catch (error) {
                console.error('[SyncEngine] Listener error:', error)
            }
        }

        this.sseManager.broadcast(enrichedEvent)
    }
}

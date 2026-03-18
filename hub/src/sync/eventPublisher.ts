import type { SyncEvent } from '@hapi/protocol/types'
import type { SSEManager } from '../sse/sseManager'

function summarizeForDebug(value: unknown, depth: number = 0): unknown {
    if (depth > 4) return '[MaxDepth]'
    if (value === null || value === undefined) return value
    if (typeof value === 'string') {
        return value.length > 240 ? `${value.slice(0, 240)}... [truncated ${value.length}]` : value
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) {
        const items = value.slice(0, 8).map((item) => summarizeForDebug(item, depth + 1))
        if (value.length > 8) items.push(`[+${value.length - 8} more]`)
        return items
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>
        const out: Record<string, unknown> = {}
        for (const [key, nested] of Object.entries(record).slice(0, 20)) {
            out[key] = summarizeForDebug(nested, depth + 1)
        }
        const extraKeys = Object.keys(record).length - Object.keys(out).length
        if (extraKeys > 0) out.__extraKeys = extraKeys
        return out
    }
    return String(value)
}

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

        if (process.env.DEBUG) {
            console.debug('[TRACE HUB PUBLISHER] event.emit', {
                type: enrichedEvent.type,
                namespace: namespace ?? null,
                summary: summarizeForDebug(enrichedEvent)
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

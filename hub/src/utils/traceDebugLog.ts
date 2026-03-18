import { appendFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { configuration } from '../configuration'

type TraceDebugPayload = Record<string, unknown>

function getTraceDebugLogPath(): string {
    return join(configuration.dataDir, 'logs', 'hub-debug.log')
}

function ensureTraceDebugLogDir(): void {
    mkdirSync(dirname(getTraceDebugLogPath()), { recursive: true })
}

export function writeTraceDebugLog(event: string, payload: TraceDebugPayload = {}): void {
    try {
        ensureTraceDebugLogDir()
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            event,
            ...payload
        })

        void appendFile(getTraceDebugLogPath(), `${line}\n`, 'utf8').catch(() => {
            // Ignore logging failures so diagnostics never affect runtime behavior.
        })
    } catch {
        // Ignore logging failures so diagnostics never affect runtime behavior.
    }
}


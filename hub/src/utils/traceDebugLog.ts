import { appendFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { configuration } from '../configuration'

type TraceDebugPayload = Record<string, unknown>

let traceDebugLogPrepared = false

function getTraceDebugLogPath(): string {
    return join(configuration.dataDir, 'logs', 'hub-debug.log')
}

function ensureTraceDebugLogDir(): void {
    mkdirSync(dirname(getTraceDebugLogPath()), { recursive: true })
}

function ensureFreshTraceDebugLogFile(): void {
    if (traceDebugLogPrepared) {
        return
    }

    const logPath = getTraceDebugLogPath()
    ensureTraceDebugLogDir()
    if (existsSync(logPath)) {
        writeFileSync(logPath, '', 'utf8')
    }
    traceDebugLogPrepared = true
}

export function summarizeForTrace(value: unknown, depth: number = 0): unknown {
    if (depth > 4) return '[MaxDepth]'
    if (value === null || value === undefined) return value
    if (typeof value === 'string') {
        return value.length > 240 ? `${value.slice(0, 240)}... [truncated ${value.length}]` : value
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) {
        const items = value.slice(0, 8).map((item) => summarizeForTrace(item, depth + 1))
        if (value.length > 8) items.push(`[+${value.length - 8} more]`)
        return items
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>
        const out: Record<string, unknown> = {}
        for (const [key, nested] of Object.entries(record).slice(0, 20)) {
            out[key] = summarizeForTrace(nested, depth + 1)
        }
        const extraKeys = Object.keys(record).length - Object.keys(out).length
        if (extraKeys > 0) out.__extraKeys = extraKeys
        return out
    }
    return String(value)
}

export function describeTraceValue(value: unknown): {
    summary: unknown
    payloadBytes: number
    payloadSha256: string
} {
    const serialized = (() => {
        try {
            return JSON.stringify(value)
        } catch {
            return JSON.stringify(summarizeForTrace(value))
        }
    })()

    return {
        summary: summarizeForTrace(value),
        payloadBytes: Buffer.byteLength(serialized, 'utf8'),
        payloadSha256: createHash('sha256').update(serialized).digest('hex')
    }
}

export function writeTraceDebugLog(event: string, payload: TraceDebugPayload = {}): void {
    try {
        ensureFreshTraceDebugLogFile()
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

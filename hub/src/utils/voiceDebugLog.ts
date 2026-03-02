import { appendFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { configuration } from '../configuration'

type VoiceDebugPayload = Record<string, unknown>

function getVoiceDebugLogPath(): string {
    return join(configuration.dataDir, 'logs', 'voice-debug.log')
}

function sanitizePayload(payload: VoiceDebugPayload): VoiceDebugPayload {
    const sanitized: VoiceDebugPayload = {}

    for (const [key, value] of Object.entries(payload)) {
        const lowerKey = key.toLowerCase()
        if (lowerKey.includes('token') || lowerKey.includes('key') || lowerKey.includes('authorization')) {
            if (typeof value === 'string') {
                sanitized[key] = value ? '[set]' : '[empty]'
                continue
            }
        }
        sanitized[key] = value
    }

    return sanitized
}

export async function writeVoiceDebugLog(
    event: string,
    payload: VoiceDebugPayload = {}
): Promise<void> {
    try {
        const path = getVoiceDebugLogPath()
        await mkdir(dirname(path), { recursive: true })
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            event,
            ...sanitizePayload(payload)
        })
        await appendFile(path, `${line}\n`, 'utf8')
    } catch {
        // Ignore all logging errors so main flow is never affected.
    }
}


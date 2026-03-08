import { existsSync, readFileSync } from 'node:fs'
import { configuration } from '@/configuration'

type DiagnosticLoggingSource = 'env' | 'file' | 'default'

type CliSettingsShape = {
    HAPI_DIAGNOSTIC_LOGGING?: boolean | string
    diagnosticLogging?: boolean | string
}

const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'on'])
const FALSY_VALUES = new Set(['false', '0', 'no', 'off'])

let cachedEnabled: boolean | null = null
let cachedSource: DiagnosticLoggingSource | null = null

function normalizeBoolean(value: boolean | string | undefined): boolean | null {
    if (value === undefined || value === null) {
        return null
    }
    if (typeof value === 'boolean') {
        return value
    }
    const normalized = value.trim().toLowerCase()
    if (TRUTHY_VALUES.has(normalized)) {
        return true
    }
    if (FALSY_VALUES.has(normalized)) {
        return false
    }
    return null
}

function readSettingsValue(): boolean | null {
    if (!existsSync(configuration.settingsFile)) {
        return null
    }

    try {
        const raw = readFileSync(configuration.settingsFile, 'utf8')
        const parsed = JSON.parse(raw) as CliSettingsShape
        return normalizeBoolean(parsed.HAPI_DIAGNOSTIC_LOGGING ?? parsed.diagnosticLogging)
    } catch {
        return null
    }
}

function resolveDiagnosticLogging(): { enabled: boolean; source: DiagnosticLoggingSource } {
    const envValue = normalizeBoolean(process.env.HAPI_DIAGNOSTIC_LOGGING)
    if (envValue !== null) {
        return { enabled: envValue, source: 'env' }
    }

    const fileValue = readSettingsValue()
    if (fileValue !== null) {
        return { enabled: fileValue, source: 'file' }
    }

    return { enabled: false, source: 'default' }
}

export function isDiagnosticLoggingEnabled(): boolean {
    if (cachedEnabled !== null) {
        return cachedEnabled
    }

    const resolved = resolveDiagnosticLogging()
    cachedEnabled = resolved.enabled
    cachedSource = resolved.source
    return resolved.enabled
}

export function getDiagnosticLoggingSource(): DiagnosticLoggingSource {
    if (cachedSource !== null) {
        return cachedSource
    }

    const resolved = resolveDiagnosticLogging()
    cachedEnabled = resolved.enabled
    cachedSource = resolved.source
    return resolved.source
}

export function resetDiagnosticLoggingCacheForTests(): void {
    cachedEnabled = null
    cachedSource = null
}
